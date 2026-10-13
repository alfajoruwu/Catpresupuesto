/**
 * Normalización de líneas y construcción de patrones tolerantes a errores de OCR.
 */

/** Clases de equivalencia de caracteres confundibles por el OCR. */
const CONFUSIONS: Record<string, string> = {
  O: 'O0Q',
  I: 'I1L|!',
  S: 'S5$',
  B: 'B8',
  A: 'A4',
  E: 'E3',
  G: 'G6',
  Z: 'Z2',
  T: 'T7',
};

const CLASS_BY_CHAR: Record<string, string> = {};
for (const cls of Object.values(CONFUSIONS)) {
  for (const c of cls) {
    CLASS_BY_CHAR[c] = cls;
  }
}

/**
 * NFKC, sin tildes, en mayúsculas, con espacios colapsados y sin bordes.
 */
export function normalizeLine(s: string): string {
  return s
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Devuelve el source de una RegExp que casa `word` admitiendo espacios
 * opcionales entre letras y las confusiones típicas del OCR
 * (O/0/Q, I/1/L/|/!, S/5/$, B/8, A/4, E/3, G/6, Z/2, T/7).
 * P. ej. kw('TOTAL') coincide con 'T0TAL', 'TOTA L' y '7OTAL'.
 * Úsese con `new RegExp(...)`, añadiendo `\b` en los extremos si hace falta.
 */
export function kw(word: string): string {
  const parts: string[] = [];
  for (const ch of word.toUpperCase()) {
    if (ch === ' ' || ch === '\t') {
      parts.push('\\s+');
    } else {
      const cls = CLASS_BY_CHAR[ch];
      if (cls === undefined) {
        parts.push(ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      } else {
        parts.push(`[${cls.replace(/\]/g, '\\]')}]`);
      }
    }
  }
  return parts.join('\\s*');
}
