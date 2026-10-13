import * as ort from 'onnxruntime-web';
import Ocr from '@gutenye/ocr-browser';
import type { ModelCreateOptions } from '@gutenye/ocr-browser';
import type { OcrBox } from './types';

/** Rutas servidas en local (public/models); sin descargas en ejecución. */
export const OCR_MODELS = {
  detectionPath: '/models/PP-OCRv5_mobile_det.onnx',
  recognitionPath: '/models/PP-OCRv5_mobile_rec.onnx',
  dictionaryPath: '/models/ppocrv5_dict.txt',
} as const;

/** Opciones de creación con los parámetros del det v5 móvil. */
interface MobileDetectionOptions extends ModelCreateOptions {
  detectionThreshold?: number;
  boxThreshold?: number;
  unclipRatio?: number;
}

let ocrPromise: Promise<Ocr> | null = null;
let ocrLoaded = false;

/** Devuelve el singleton del OCR, creándolo con los parámetros del det v5 móvil. */
function getOcr(): Promise<Ocr> {
  if (ocrPromise === null) {
    ort.env.wasm.wasmPaths = '/ort/';
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    const args: MobileDetectionOptions = {
      models: { ...OCR_MODELS },
      detectionThreshold: 0.3,
      boxThreshold: 0.6,
      unclipRatio: 1.5,
    };
    ocrPromise = Ocr.create(args).then(
      (ocr) => {
        ocrLoaded = true;
        return ocr;
      },
      (error: unknown) => {
        ocrPromise = null;
        throw error;
      },
    );
  }
  return ocrPromise;
}

/** Precarga el modelo para no pagar la carga en el primer escaneo. */
export async function preloadOcr(): Promise<void> {
  await getOcr();
}

/** true si el modelo ya quedó cargado en RAM. */
export function isOcrLoaded(): boolean {
  return ocrLoaded;
}

/** Línea del OCR: forma documentada (score/frame) o real (mean/box). */
interface OcrLine {
  text?: unknown;
  mean?: unknown;
  score?: unknown;
  box?: unknown;
  frame?: unknown;
}

function toBox(line: OcrLine): OcrBox | null {
  if (typeof line.text !== 'string') return null;
  const score = typeof line.mean === 'number' ? line.mean : typeof line.score === 'number' ? line.score : 1;
  const raw = line.box ?? line.frame;
  if (!Array.isArray(raw) || raw.length < 4) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of raw) {
    if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') {
      xs.push(p[0]);
      ys.push(p[1]);
    } else if (p !== null && typeof p === 'object') {
      const point = p as { x?: unknown; y?: unknown };
      if (typeof point.x === 'number' && typeof point.y === 'number') {
        xs.push(point.x);
        ys.push(point.y);
      }
    }
  }
  if (xs.length === 0) return null;
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    text: line.text,
    score,
    top,
    left,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
  };
}

/** Reconoce el texto de la imagen y lo devuelve como cajas. */
export async function recognize(image: ImageData): Promise<OcrBox[]> {
  const ocr = await getOcr();
  const { texts } = await ocr.detect({ data: image.data, width: image.width, height: image.height });
  const boxes: OcrBox[] = [];
  for (const line of texts) {
    const box = toBox(line);
    if (box !== null) boxes.push(box);
  }
  return boxes;
}
