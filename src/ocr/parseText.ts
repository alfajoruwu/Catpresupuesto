import { findAmounts } from './amount';
import { kw, normalizeLine } from './normalize';
import type { ParsedFields } from './types';

/** Casa `phrase` como palabra completa dentro de una línea ya normalizada. */
function hasWord(line: string, phrase: string): boolean {
  return new RegExp(`(?<![A-Z0-9Ñ])${kw(phrase)}(?![A-Z0-9Ñ])`).test(line);
}

/* ---------------------------------- TOTAL ---------------------------------- */

const TOTAL_EXCLUSIONS = [
  'SUBTOTAL',
  'NETO',
  'IVA',
  'EXENTO',
  'DESCUENTO',
  'DCTO',
  'AHORRO',
  'VUELTO',
  'CAMBIO',
  'EFECTIVO',
  'RECIBIDO',
  'PROPINA SUGERIDA',
  'ARTICULOS',
  'ITEMS',
  'UNIDADES',
  'CANTIDAD',
  'PUNTOS',
];

const TOTAL_OVERRIDES = ['TOTAL A PAGAR', 'TOTAL CON PROPINA'];

const TOTAL_PHRASES_3 = [
  'TOTAL A PAGAR',
  'MONTO TOTAL',
  'IMPORTE TOTAL',
  'TOTAL BOLETA',
  'VALOR TOTAL',
  'TOTAL VENTA',
  'TOTAL CON PROPINA',
];

const TOTAL_PHRASES_1 = ['A PAGAR', 'MONTO', 'IMPORTE'];

function isTotalExcluded(line: string): boolean {
  if (TOTAL_OVERRIDES.some((p) => hasWord(line, p))) return false;
  return TOTAL_EXCLUSIONS.some((p) => hasWord(line, p));
}

function totalScore(line: string): number {
  if (TOTAL_PHRASES_3.some((p) => hasWord(line, p))) return 3;
  if (hasWord(line, 'TOTAL')) return 2;
  if (TOTAL_PHRASES_1.some((p) => hasWord(line, p))) return 1;
  return 0;
}

/** La línea siguiente solo aporta el importe si no tiene palabras aparte de la moneda. */
function isAmountOnlyLine(line: string): boolean {
  return !/[A-ZÑ]/.test(line.replace(/\$/g, ''));
}

function extractTotal(norm: string[]): number | null {
  let bestScore = 0;
  let bestIndex = -1;
  let bestValue = 0;
  for (let i = 0; i < norm.length; i++) {
    const line = norm[i];
    if (isTotalExcluded(line)) continue;
    const score = totalScore(line);
    if (score === 0) continue;
    const own = findAmounts(line);
    let value: number | null = own.length > 0 ? own[own.length - 1].value : null;
    if (value === null && i + 1 < norm.length && isAmountOnlyLine(norm[i + 1])) {
      const next = findAmounts(norm[i + 1]);
      value = next.length > 0 ? next[0].value : null;
    }
    if (value === null) continue;
    if (score > bestScore || (score === bestScore && i > bestIndex)) {
      bestScore = score;
      bestIndex = i;
      bestValue = value;
    }
  }
  if (bestIndex !== -1) return bestValue;
  let fallback: number | null = null;
  for (const line of norm) {
    if (isTotalExcluded(line)) continue;
    for (const amount of findAmounts(line)) {
      if (amount.hasCurrency && (fallback === null || amount.value > fallback)) {
        fallback = amount.value;
      }
    }
  }
  return fallback;
}

/* ---------------------------------- FECHA ---------------------------------- */

const MONTH_TO_NUM: Record<string, number> = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SEPTIEMBRE: 9,
  SETIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
  JANUARY: 1,
  FEBRUARY: 2,
  MARCH: 3,
  APRIL: 4,
  MAY: 5,
  JUNE: 6,
  JULY: 7,
  AUGUST: 8,
  SEPTEMBER: 9,
  OCTOBER: 10,
  NOVEMBER: 11,
  DECEMBER: 12,
  ENE: 1,
  FEB: 2,
  MAR: 3,
  ABR: 4,
  APR: 4,
  AGO: 8,
  AUG: 8,
  SEP: 9,
  SET: 9,
  OCT: 10,
  NOV: 11,
  DIC: 12,
  DEC: 12,
  JUN: 6,
  JUL: 7,
};
const MONTH_ALT = Object.keys(MONTH_TO_NUM).sort((a, b) => b.length - a.length).join('|');
const DATE_EXCLUSIONS = ['RES', 'RESOLUCION', 'SII', 'VENCE', 'VENCIMIENTO', 'VALIDO HASTA'];
const DATE_BOOSTERS = ['FECHA', 'EMISION', 'DATE'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1) return null;
  if (y < 100) y += 2000;
  if (y < 1000 || y > 9999) return null;
  if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function extractDate(norm: string[], today: string): string | null {
  const todayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!todayMatch) return null;
  const day = new Date(Date.UTC(Number(todayMatch[1]), Number(todayMatch[2]) - 1, Number(todayMatch[3])));
  const maxDay = new Date(day.getTime() + 86400000);
  const maxStr = `${maxDay.getUTCFullYear()}-${pad2(maxDay.getUTCMonth() + 1)}-${pad2(maxDay.getUTCDate())}`;
  const minStr = `${day.getUTCFullYear() - 2}-${pad2(day.getUTCMonth() + 1)}-${pad2(day.getUTCDate())}`;

  interface Hit {
    iso: string;
    boost: number;
    line: number;
    pos: number;
  }
  const hits: Hit[] = [];
  for (let i = 0; i < norm.length; i++) {
    const line = norm[i];
    if (DATE_EXCLUSIONS.some((p) => hasWord(line, p))) continue;
    const boost = DATE_BOOSTERS.some((p) => hasWord(line, p)) ? 2 : 0;
    const longSpans: Array<{ start: number; end: number }> = [];
    const longRe = new RegExp(`(\\d{1,2})\\s+DE\\s+(${MONTH_ALT})\\s+DE\\s+(\\d{2,4})(?!\\d)`, 'g');
    for (let m = longRe.exec(line); m !== null; m = longRe.exec(line)) {
      const iso = toIso(Number(m[3]), MONTH_TO_NUM[m[2]], Number(m[1]));
      if (iso !== null) {
        hits.push({ iso, boost, line: i, pos: m.index });
        longSpans.push({ start: m.index, end: m.index + m[0].length });
      }
    }
    const textRe = new RegExp(`(\\d{1,2})[\\s.\\-]+(${MONTH_ALT})[\\s.\\-]+(\\d{2,4})(?!\\d)`, 'g');
    for (let m = textRe.exec(line); m !== null; m = textRe.exec(line)) {
      if (longSpans.some((s) => m.index < s.end && m.index + m[0].length > s.start)) continue;
      const iso = toIso(Number(m[3]), MONTH_TO_NUM[m[2]], Number(m[1]));
      if (iso !== null) hits.push({ iso, boost, line: i, pos: m.index });
    }
    const isoRe = /(?:^|[^\d])(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})(?!\d)/g;
    for (let m = isoRe.exec(line); m !== null; m = isoRe.exec(line)) {
      const iso = toIso(Number(m[1]), Number(m[2]), Number(m[3]));
      if (iso !== null) hits.push({ iso, boost, line: i, pos: m.index });
    }
    const dmyRe = /(?:^|[^\d])(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?!\d)/g;
    for (let m = dmyRe.exec(line); m !== null; m = dmyRe.exec(line)) {
      // Evita releer la cola de un aaaa-mm-dd como dd-mm-aa.
      if (m.index > 0 && /\d/.test(line[m.index - 1])) continue;
      const iso = toIso(Number(m[3]), Number(m[2]), Number(m[1]));
      if (iso !== null) hits.push({ iso, boost, line: i, pos: m.index });
    }
  }
  hits.sort((a, b) => b.boost - a.boost || a.line - b.line || a.pos - b.pos);
  for (const hit of hits) {
    if (hit.iso >= minStr && hit.iso <= maxStr) return hit.iso;
  }
  return null;
}

/* ------------------------------- RUT / ID ---------------------------------- */

const ID_SKIP = ['CLIENTE', 'RECEPTOR', 'SENOR'];

function validRut(body: string, dv: string): boolean {
  let sum = 0;
  let mult = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const r = 11 - (sum % 11);
  const expected = r === 11 ? '0' : r === 10 ? 'K' : String(r);
  return expected === dv;
}

function extractTaxId(norm: string[]): string | null {
  const usable = norm.filter((line) => !ID_SKIP.some((p) => hasWord(line, p)));
  interface RutHit {
    body: string;
    dv: string;
    line: number;
    pos: number;
  }
  const hits: RutHit[] = [];
  const dottedRe = /(?<![\d.])(\d{1,2}(?:\.\d{3}){2})\s*-?\s*([0-9K])(?!\d)/g;
  const plainRe = /(?<![\d\-])(\d{7,8})\s*-\s*([0-9K])(?!\d)/g;
  usable.forEach((line, i) => {
    for (let m = dottedRe.exec(line); m !== null; m = dottedRe.exec(line)) {
      hits.push({ body: m[1].replace(/\./g, ''), dv: m[2], line: i, pos: m.index });
    }
    for (let m = plainRe.exec(line); m !== null; m = plainRe.exec(line)) {
      hits.push({ body: m[1], dv: m[2], line: i, pos: m.index });
    }
  });
  hits.sort((a, b) => a.line - b.line || a.pos - b.pos);
  for (const hit of hits) {
    if (validRut(hit.body, hit.dv)) return `${hit.body}-${hit.dv}`;
  }
  interface OtherHit {
    value: string;
    line: number;
    pos: number;
  }
  const others: OtherHit[] = [];
  usable.forEach((line, i) => {
    const cuit = new RegExp(`${kw('CUIT')}\\D{0,12}(\\d{2})[\\s.\\-]*(\\d{8})[\\s.\\-]*(\\d)(?!\\d)`).exec(line);
    if (cuit) others.push({ value: `${cuit[1]}-${cuit[2]}-${cuit[3]}`, line: i, pos: cuit.index });
    const ruc = new RegExp(`${kw('RUC')}\\D{0,12}(\\d{11})(?!\\d)`).exec(line);
    if (ruc) others.push({ value: ruc[1], line: i, pos: ruc.index });
    const rfc = new RegExp(`${kw('RFC')}\\D{0,12}([A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3})(?![A-Z0-9])`).exec(line);
    if (rfc) others.push({ value: rfc[1], line: i, pos: rfc.index });
  });
  others.sort((a, b) => a.line - b.line || a.pos - b.pos);
  return others.length > 0 ? others[0].value : null;
}

/* --------------------------- TIPO Y FOLIO ---------------------------------- */

const DOC_TYPES: Array<{ phrase: string; label: string }> = [
  { phrase: 'NOTA DE CREDITO', label: 'Nota de crédito' },
  { phrase: 'BOLETA EXENTA', label: 'Boleta exenta electrónica' },
  { phrase: 'BOLETA ELECTRONICA', label: 'Boleta electrónica' },
  { phrase: 'FACTURA ELECTRONICA', label: 'Factura electrónica' },
  { phrase: 'FACTURA EXENTA', label: 'Factura electrónica' },
  { phrase: 'BOLETA', label: 'Boleta' },
  { phrase: 'FACTURA', label: 'Factura' },
  { phrase: 'TICKET', label: 'Ticket' },
  { phrase: 'COMPROBANTE', label: 'Comprobante' },
];

function extractDocType(norm: string[]): { docType: string | null; line: number } {
  for (let i = 0; i < norm.length; i++) {
    for (const doc of DOC_TYPES) {
      if (hasWord(norm[i], doc.phrase)) return { docType: doc.label, line: i };
    }
  }
  return { docType: null, line: -1 };
}

function findFolioInLine(line: string): string | null {
  const keyword = `(?:${kw('FOLIO')}|N°|Nº|${kw('NRO')}|${kw('NUMERO')}|${kw('NUM')})`;
  const re = new RegExp(`(?<![A-Z0-9Ñ])${keyword}\\s*[:#\\-.°º]?\\s*(\\d[\\d.\\s]{0,17}\\d|\\d)`, 'g');
  for (let m = re.exec(line); m !== null; m = re.exec(line)) {
    const digits = m[1].replace(/[^\d]/g, '');
    if (digits.length >= 1 && digits.length <= 12) return digits;
  }
  return null;
}

function extractFolio(norm: string[], docLine: number): string | null {
  const order: number[] = [];
  for (let i = docLine; i <= docLine + 2 && i < norm.length; i++) {
    if (i >= 0) order.push(i);
  }
  for (let i = 0; i < norm.length; i++) {
    if (!order.includes(i)) order.push(i);
  }
  for (const i of order) {
    const folio = findFolioInLine(norm[i]);
    if (folio !== null) return folio;
  }
  return null;
}

/* -------------------------------- COMERCIO --------------------------------- */

function isDocNoise(line: string): boolean {
  if (line.includes('@') || line.includes('WWW') || line.includes('R.U.T')) return true;
  return ['BOLETA', 'FACTURA', 'ELECTRONICA', 'RUT', 'GIRO', 'DIRECCION', 'FECHA', 'SII', 'CASA MATRIZ', 'SUCURSAL', 'TEL', 'TELEFONO', 'FONO'].some((w) => hasWord(line, w));
}

function stripSuffixes(name: string): string {
  let current = name.replace(/[.,;:\s]+$/, '');
  for (;;) {
    const next = current.replace(/\s+(S\.A\.\s+DE\s+C\.V\.|S\.A\.|SPA|LTDA\.?|LIMITADA|E\.I\.R\.L\.|SAC|S\.R\.L\.)$/, '');
    if (next === current) return current;
    current = next.replace(/[.,;:\s]+$/, '');
  }
}

function toTitle(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w === '' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function extractMerchant(norm: string[]): string | null {
  for (const line of norm.slice(0, 6)) {
    if (isDocNoise(line)) continue;
    const letters = (line.match(/[A-ZÑ]/g) ?? []).length;
    if (letters < 3) continue;
    const digits = (line.match(/\d/g) ?? []).length;
    if (line.length > 0 && digits / line.length >= 0.4) continue;
    const name = stripSuffixes(line);
    if (name === '') continue;
    return toTitle(name);
  }
  return null;
}

/* --------------------------------- ENTRY ----------------------------------- */

/**
 * Convierte las líneas del OCR en los campos del gasto:
 * total, fecha, comercio, RUT/ID, tipo de documento y folio.
 */
export function parseReceiptText(lines: string[], today: string): ParsedFields {
  const norm = lines.map(normalizeLine);
  const { docType, line: docLine } = extractDocType(norm);
  return {
    total: extractTotal(norm),
    date: extractDate(norm, today),
    merchant: extractMerchant(norm),
    taxId: extractTaxId(norm),
    docType,
    folio: extractFolio(norm, docLine),
  };
}
