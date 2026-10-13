/**
 * Carga de una imagen a ImageData, orientada según EXIF y acotada a maxSide.
 *
 * @param blob imagen de entrada.
 * @param maxSide lado mayor máximo en píxeles; si lo excede se reescala.
 */
export async function loadImageData(blob: Blob, maxSide: number): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (ctx === null) throw new Error('No se pudo obtener el contexto 2d');
      ctx.drawImage(bitmap, 0, 0, width, height);
      return ctx.getImageData(0, 0, width, height);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('No se pudo obtener el contexto 2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  } finally {
    bitmap.close();
  }
}
