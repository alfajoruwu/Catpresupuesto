export interface ParsedFields {
  /** Total en pesos chilenos (entero redondeado), o null si no se encontró. */
  total: number | null;
  /** Fecha en formato 'YYYY-MM-DD', o null si no se encontró. */
  date: string | null;
  /** Nombre del comercio en formato título, o null si no se encontró. */
  merchant: string | null;
  /** RUT/ID fiscal normalizado (p. ej. '76123456-0'), o null. */
  taxId: string | null;
  /** Etiqueta del tipo de documento (p. ej. 'Boleta electrónica'), o null. */
  docType: string | null;
  /** Folio conservando ceros a la izquierda, o null. */
  folio: string | null;
}

export interface ReceiptData extends ParsedFields {
  /** De dónde salieron los campos. */
  source: 'barcode' | 'ocr' | 'barcode+ocr';
  /** Líneas del OCR unidas con '\n' ('' si solo hubo código). */
  rawText: string;
}

export interface OcrBox {
  text: string;
  score: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

export type ScanStage = 'preparing' | 'barcode' | 'loading-model' | 'ocr' | 'parsing';
