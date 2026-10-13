import { groupIntoLines } from './lines';
import { loadImageData } from './image';
import { parseBarcodePayload } from './parseBarcode';
import { parseReceiptText } from './parseText';
import { isOcrLoaded, preloadOcr, recognize } from './engine';
import { readCodes } from './barcode';
import type { ParsedFields, ReceiptData, ScanStage } from './types';

export type { OcrBox, ParsedFields, ReceiptData, ScanStage } from './types';
export { isOcrLoaded, parseBarcodePayload, parseReceiptText, preloadOcr };

export interface ScanOptions {
  /** Fecha de referencia 'YYYY-MM-DD' (por defecto, la fecha local). */
  today?: string;
  /** Aviso de cada etapa del escaneo. */
  onStage?: (stage: ScanStage) => void;
}

const READ_ERROR = 'No se pudo leer la boleta. Prueba con otra foto o ingresa el gasto a mano.';

function localToday(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Lee una boleta en el propio dispositivo: primero intenta los códigos
 * (PDF417/QR) y luego el OCR, combinando ambos en un gasto.
 */
export async function scanReceipt(file: Blob, opts?: ScanOptions): Promise<ReceiptData> {
  const today = opts?.today ?? localToday();
  const onStage = opts?.onStage;

  onStage?.('preparing');
  const fullImage = await loadImageData(file, 2400);

  onStage?.('barcode');
  let barcode: Partial<ParsedFields> | null = null;
  try {
    const texts = await readCodes(fullImage);
    for (const text of texts) {
      const parsed = parseBarcodePayload(text);
      if (parsed !== null) {
        barcode = parsed;
        break;
      }
    }
  } catch {
    barcode = null;
  }

  onStage?.('loading-model');
  try {
    await preloadOcr();
  } catch {
    if (barcode === null) throw new Error(READ_ERROR);
    return {
      total: barcode.total ?? null,
      date: barcode.date ?? null,
      merchant: null,
      taxId: barcode.taxId ?? null,
      docType: barcode.docType ?? null,
      folio: barcode.folio ?? null,
      source: 'barcode',
      rawText: '',
    };
  }

  onStage?.('ocr');
  let rawText = '';
  let parsed: ParsedFields;
  try {
    const lines = groupIntoLines(await recognize(await loadImageData(file, 1600)));
    rawText = lines.join('\n');
    onStage?.('parsing');
    parsed = parseReceiptText(lines, today);
  } catch {
    if (barcode === null) throw new Error(READ_ERROR);
    return {
      total: barcode.total ?? null,
      date: barcode.date ?? null,
      merchant: null,
      taxId: barcode.taxId ?? null,
      docType: barcode.docType ?? null,
      folio: barcode.folio ?? null,
      source: 'barcode',
      rawText: '',
    };
  }

  if (barcode === null) {
    return { ...parsed, source: 'ocr', rawText };
  }
  const fromBarcode =
    barcode.total !== undefined ||
    barcode.date !== undefined ||
    barcode.taxId !== undefined ||
    barcode.docType !== undefined ||
    barcode.folio !== undefined;
  return {
    total: barcode.total ?? parsed.total,
    date: barcode.date ?? parsed.date,
    merchant: parsed.merchant,
    taxId: barcode.taxId ?? parsed.taxId,
    docType: barcode.docType ?? parsed.docType,
    folio: barcode.folio ?? parsed.folio,
    source: fromBarcode ? 'barcode+ocr' : 'ocr',
    rawText,
  };
}
