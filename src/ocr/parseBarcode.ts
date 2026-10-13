import type { ParsedFields } from './types';

const TD_LABELS: Record<string, string> = {
  '33': 'Factura electrónica',
  '34': 'Factura exenta electrónica',
  '39': 'Boleta electrónica',
  '41': 'Boleta exenta electrónica',
  '46': 'Factura de compra electrónica',
  '52': 'Guía de despacho electrónica',
  '56': 'Nota de débito electrónica',
  '61': 'Nota de crédito electrónica',
};

function tedTag(text: string, name: string): string | null {
  const m = new RegExp(`<\\s*${name}\\s*>([^<]*)<\\/\\s*${name}\\s*>`, 'i').exec(text);
  return m === null ? null : m[1].trim();
}

function normalizeTID(raw: string): string {
  const clean = raw.replace(/\./g, '').replace(/\s+/g, '').toUpperCase();
  if (clean.includes('-')) return clean;
  return clean.length > 1 ? `${clean.slice(0, -1)}-${clean.slice(-1)}` : clean;
}

function parseTed(text: string): Partial<ParsedFields> | null {
  if (!/<\s*TED[\s>]|<\s*DD[\s>]/i.test(text)) return null;
  const out: Partial<ParsedFields> = {};
  const re = tedTag(text, 'RE');
  if (re !== null && re !== '') out.taxId = normalizeTID(re);
  const td = tedTag(text, 'TD');
  if (td !== null && TD_LABELS[td] !== undefined) out.docType = TD_LABELS[td];
  const folio = tedTag(text, 'F');
  if (folio !== null && folio !== '') out.folio = folio;
  const fe = tedTag(text, 'FE');
  if (fe !== null && /^\d{4}-\d{2}-\d{2}$/.test(fe)) out.date = fe;
  const mnt = tedTag(text, 'MNT');
  if (mnt !== null && mnt !== '') {
    const value = Math.round(Number(mnt.replace(/\s+/g, '')));
    if (Number.isFinite(value)) out.total = value;
  }
  return out;
}

function parseAfip(text: string): Partial<ParsedFields> | null {
  if (!/afip\.gob\.ar\/fe\/qr/i.test(text)) return null;
  try {
    const m = /[?&]p=([^&#\s]+)/.exec(text);
    if (m === null) return null;
    let b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const payload = JSON.parse(atob(b64)) as {
      fecha?: unknown;
      importe?: unknown;
      cuit?: unknown;
      ptoVta?: unknown;
      nroCmp?: unknown;
    };
    if (
      typeof payload.fecha !== 'string' ||
      typeof payload.importe !== 'number' ||
      (typeof payload.cuit !== 'number' && typeof payload.cuit !== 'string') ||
      (typeof payload.ptoVta !== 'number' && typeof payload.ptoVta !== 'string') ||
      (typeof payload.nroCmp !== 'number' && typeof payload.nroCmp !== 'string')
    ) {
      return null;
    }
    const cuit = String(payload.cuit).replace(/[^\d]/g, '').padStart(11, '0');
    if (cuit.length !== 11) return null;
    return {
      total: Math.round(payload.importe),
      date: payload.fecha,
      taxId: `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`,
      folio: `${payload.ptoVta}-${payload.nroCmp}`,
      docType: 'Comprobante AFIP',
    };
  } catch {
    return null;
  }
}

function parseSunat(text: string): Partial<ParsedFields> | null {
  if (!text.includes('|')) return null;
  const parts = text.split('|').map((p) => p.trim());
  if (parts.length < 7 || !/^\d{11}$/.test(parts[0])) return null;
  const total = Math.round(Number(parts[5]));
  if (!Number.isFinite(total)) return null;
  let date: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(parts[6])) {
    date = parts[6];
  } else {
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(parts[6]);
    if (dmy === null) return null;
    date = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  if (parts[2] === '' || parts[3] === '') return null;
  return {
    taxId: parts[0],
    docType: parts[1] === '01' ? 'Factura' : parts[1] === '03' ? 'Boleta de venta' : undefined,
    folio: `${parts[2]}-${parts[3]}`,
    total,
    date,
  };
}

function parseCfdi(text: string): Partial<ParsedFields> | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  const re = url.searchParams.get('re');
  const tt = url.searchParams.get('tt');
  if (re === null || tt === null || re === '' || tt === '') return null;
  const total = Math.round(Number(tt));
  if (!Number.isFinite(total)) return null;
  return {
    total,
    taxId: re,
    folio: url.searchParams.get('id') ?? undefined,
    docType: 'CFDI',
  };
}

/**
 * Interpreta el texto de un código de barras/QR.
 * Timbre SII, QR de AFIP, QR de SUNAT y QR de CFDI;
 * cualquier otro texto (p. ej. un EAN) devuelve null.
 */
export function parseBarcodePayload(text: string): Partial<ParsedFields> | null {
  return parseTed(text) ?? parseAfip(text) ?? parseSunat(text) ?? parseCfdi(text);
}
