import { defaultReaderOptions, prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import type { ReaderOptions } from 'zxing-wasm/reader';
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

let prepared = false;

/**
 * Lee los textos de los códigos de la imagen (PDF417 del timbre SII,
 * QR, DataMatrix y Aztec). Sin conexión: el .wasm se sirve en local.
 */
export async function readCodes(image: ImageData): Promise<string[]> {
  if (!prepared) {
    prepareZXingModule({
      overrides: {
        locateFile: (path: string, _prefix: string) => (path.endsWith('.wasm') ? zxingWasmUrl : path),
      },
      fireImmediately: false,
    });
    prepared = true;
  }
  const options: ReaderOptions = {
    formats: ['PDF417', 'QRCode', 'DataMatrix', 'Aztec'],
    tryHarder: true,
    maxNumberOfSymbols: 4,
  };
  // tryRotate/tryInvert solo se añaden si existen en los ReaderOptions
  // de la versión instalada.
  if ('tryRotate' in defaultReaderOptions) options.tryRotate = true;
  if ('tryInvert' in defaultReaderOptions) options.tryInvert = true;
  const results = await readBarcodes(image, options);
  return results.map((r) => r.text).filter((t) => t !== '');
}
