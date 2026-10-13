/**
 * Lectura de importes en pesos chilenos (enteros, redondeados).
 */

export interface FoundAmount {
  value: number;
  index: number;
  hasCurrency: boolean;
}

const AMOUNT_RE =
  /[$]?\s*-?\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|[$]?\s*-?\d+(?:[.,]\d{1,2})?/g;

const MONTHS =
  'SEPTIEMBRE|FEBRERO|OCTUBRE|ENERO|JULIO|MARZO|ABRIL|MAYO|JUNIO|AGOSTO|DICIEMBRE|NOVIEMBRE|SETIEMBRE|JANUARY|FEBRUARY|MARCH|APRIL|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JUNE|JULY|SEPT|ABR|AGO|DIC|ENE|FEB|JUL|MAR|NOV|OCT|SET|APR|AUG|DEC|JAN|JUN|MAY|SEP';

/** Rangos que nunca son importes: fechas, horas, RUTs. Los % se filtran aparte. */
const EXCLUDE_SOURCE = [
  String.raw`\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}`,
  String.raw`\d{1,4}[\/.\-]\d{1,2}[\/.\-]\d{2,4}`,
  String.raw`\d{1,2}\s+DE\s+(?:${MONTHS})\s+DE\s+\d{2,4}`,
  String.raw`\d{1,2}[\s.\-]+(?:${MONTHS})[\s.\-]+\d{2,4}`,
  String.raw`\d{1,2}:\d{2}(?::\d{2})?`,
  String.raw`\d{1,3}(?:\.\d{3})+\s*-\s*[0-9K]`,
  String.raw`(?<![\d.])\d{7,8}\s*-\s*[0-9K](?!\d)`,
].join('|');

/**
 * Interpreta un token como importe en pesos y lo redondea.
 * Corrige confusiones del OCR (O→0, I/l/|→1, S→5, B→8) dentro de
 * tokens mayoritariamente numéricos y resuelve separadores de miles
 * y decimales ('1.234,56', '12 990'). null si no es un número o > 1e10.
 */
export function parseAmount(token: string): number | null {
  let s = token
    .replace(/CLP|USD|ARS|MXN|S\/|\$/gi, '')
    .replace(/\s+/g, '');
  if (s === '' || s === '-') return null;

  const digits = (s.match(/\d/g) ?? []).length;
  const letters = (s.match(/[A-Za-z]/g) ?? []).length;
  if (digits === 0 || letters > digits) return null;
  s = s
    .replace(/[Oo]/g, '0')
    .replace(/[IiLl|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8');
  if (/[^0-9.,-]/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let integer = s;
  let fraction = '';
  if (lastDot !== -1 && lastComma !== -1) {
    // Ambos: el último es decimal si le siguen 1 o 2 dígitos; el resto, miles.
    const last = Math.max(lastDot, lastComma);
    const tail = s.slice(last + 1);
    if (/^\d{1,2}$/.test(tail)) {
      fraction = tail;
      integer = s.slice(0, last);
    }
    integer = integer.replace(/[.,]/g, '');
  } else if (lastDot !== -1 || lastComma !== -1) {
    // Uno solo: repetido o seguido de 3+ dígitos es miles; de 1-2, decimal.
    const sep = lastDot !== -1 ? '.' : ',';
    const count = s.split('').filter((c) => c === sep).length;
    const tail = s.slice(s.lastIndexOf(sep) + 1);
    if (/^\d{1,2}$/.test(tail) && count === 1) {
      fraction = tail;
      integer = s.slice(0, s.lastIndexOf(sep));
    } else {
      integer = s.split(sep).join('');
    }
  }

  const value = Number(integer + (fraction === '' ? '' : `.${fraction}`));
  if (!Number.isFinite(value) || Math.abs(value) > 1e10) return null;
  return Math.round(value);
}

/**
 * Encuentra los importes de una línea. Ignora los números que forman
 * parte de una fecha, de una hora (hh:mm), de un RUT o de un porcentaje.
 */
export function findAmounts(line: string): FoundAmount[] {
  const excluded: Array<{ start: number; end: number }> = [];
  const spans = new RegExp(EXCLUDE_SOURCE, 'gi');
  for (let m = spans.exec(line); m !== null; m = spans.exec(line)) {
    excluded.push({ start: m.index, end: m.index + m[0].length });
  }

  const found: FoundAmount[] = [];
  const candidates = new RegExp(AMOUNT_RE.source, 'g');
  for (let m = candidates.exec(line); m !== null; m = candidates.exec(line)) {
    const start = m.index;
    const end = start + m[0].length;
    if (excluded.some((s) => start < s.end && end > s.start)) continue;
    if (/^\s*%/.test(line.slice(end))) continue;
    const value = parseAmount(m[0]);
    if (value === null) continue;
    found.push({ value, index: start, hasCurrency: m[0].startsWith('$') });
  }
  return found;
}
