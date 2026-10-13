import type { OcrBox } from './types';

/**
 * Agrupa las cajas del OCR en líneas de texto: descarta score < 0.5,
 * ordena por centro vertical, junta las que difieren menos de 0.5 veces
 * la altura más pequeña y dentro de cada línea ordena por left.
 */
export function groupIntoLines(boxes: OcrBox[]): string[] {
  const kept = boxes.filter((b) => b.score >= 0.5);
  kept.sort((a, b) => a.top + a.height / 2 - (b.top + b.height / 2));

  const lines: OcrBox[][] = [];
  for (const box of kept) {
    const center = box.top + box.height / 2;
    const current = lines.length === 0 ? undefined : lines[lines.length - 1];
    const first = current === undefined ? undefined : current[0];
    if (first !== undefined) {
      const firstCenter = first.top + first.height / 2;
      if (Math.abs(center - firstCenter) < 0.5 * Math.min(box.height, first.height)) {
        current?.push(box);
        continue;
      }
    }
    lines.push([box]);
  }

  return lines.map((line) =>
    line
      .sort((a, b) => a.left - b.left)
      .map((b) => b.text)
      .join(' '),
  );
}
