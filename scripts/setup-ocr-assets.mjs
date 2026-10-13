#!/usr/bin/env node
/**
 * Descarga y verifica los modelos PP-OCRv5 móvil + diccionario en
 * <root>/public/models y copia los .wasm/.mjs de onnxruntime-web a
 * <root>/public/ort/. Uso: node scripts/setup-ocr-assets.mjs [--root <dir>]
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES = [
  {
    name: 'PP-OCRv5_mobile_det.onnx',
    url: 'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det_onnx/resolve/e6f4fa85f00e168c862bc462aebca69eef9b3d3d/inference.onnx',
    size: 4826518,
    sha256: 'a431985659dc921974177a95adcfbb90fd9e51989a5e04d70d0b75f597b6e61d',
  },
  {
    name: 'PP-OCRv5_mobile_rec.onnx',
    url: 'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec_onnx/resolve/ed152b8b495f84de93cda5709d768548a9127622/inference.onnx',
    size: 16534782,
    sha256: 'da72dc72ca4dc220df0dfde68c1dedc31c58d3e76a25871122e5056227d50092',
  },
  {
    name: 'ppocrv5_dict.txt',
    url: 'https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/dab3fe35379033fdcb2d0e9572fac0b36c9a9ebf/ppocr/utils/dict/ppocrv5_dict.txt',
    size: 74012,
    sha256: 'd1979e9f794c464c0d2e0b70a7fe14dd978e9dc644c0e71f14158cdf8342af1b',
  },
];

function repoRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function parseArgs(argv) {
  let root = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && i + 1 < argv.length) {
      root = argv[i + 1];
      i++;
    }
  }
  return root;
}

async function sha256Of(path) {
  const data = await readFile(path);
  return createHash('sha256').update(data).digest('hex');
}

async function downloadVerified(file, dest) {
  const tmp = `${dest}.tmp`;
  const res = await fetch(file.url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`descarga de ${file.name}: HTTP ${res.status} ${res.statusText}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const { writeFile } = await import('node:fs/promises');
  await writeFile(tmp, bytes);
  const actualSize = bytes.length;
  if (actualSize !== file.size) {
    await rm(tmp, { force: true });
    throw new Error(
      `verificación de ${file.name}: tamaño ${actualSize}, se esperaban ${file.size} bytes (descarga incompleta o URL cambiada)`,
    );
  }
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== file.sha256) {
    await rm(tmp, { force: true });
    throw new Error(`verificación de ${file.name}: sha256 ${actualHash}, se esperaba ${file.sha256} (fichero corrupto o cambiado)`);
  }
  await rename(tmp, dest);
}

async function ensureModels(root) {
  const dir = join(root, 'public', 'models');
  await mkdir(dir, { recursive: true });
  for (const file of FILES) {
    const dest = join(dir, file.name);
    try {
      const st = await stat(dest);
      if (st.size === file.size && (await sha256Of(dest)) === file.sha256) {
        console.log(`${file.name}: ya existe y verifica (saltado)`);
        continue;
      }
      console.log(`${file.name}: existe pero no verifica, descargando de nuevo…`);
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
    console.log(`${file.name}: descargando ${file.url} …`);
    await downloadVerified(file, dest);
    console.log(`${file.name}: descargado y verificado (${file.size} bytes)`);
  }
}

async function copyOrt(root) {
  let entries;
  try {
    entries = await readdir(join(root, 'node_modules', 'onnxruntime-web', 'dist'));
  } catch (err) {
    if (err?.code === 'ENOENT') {
      console.error('Ejecuta npm install primero');
      process.exit(1);
    }
    throw err;
  }
  const wanted = entries.filter((name) => /^ort-wasm.*\.(wasm|mjs)$/.test(name));
  const dir = join(root, 'public', 'ort');
  await mkdir(dir, { recursive: true });
  for (const name of wanted) {
    await copyFile(join(root, 'node_modules', 'onnxruntime-web', 'dist', name), join(dir, name));
    console.log(`ort/${name}: copiado`);
  }
  if (wanted.length === 0) {
    console.log('ort: no se encontraron ort-wasm*.{wasm,mjs} en onnxruntime-web/dist');
  }
}

const here = fileURLToPath(import.meta.url);
const invoked = process.argv[1] === here;
if (invoked || repoRoot() === process.cwd()) {
  const root = process.argv[1] === here ? parseArgs(process.argv.slice(2)) : process.cwd();
  try {
    await ensureModels(root);
    await copyOrt(root);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export { FILES };
