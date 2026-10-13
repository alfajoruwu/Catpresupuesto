import { describe, expect, it } from 'vitest';
import { findAmounts, parseAmount } from '../amount';

describe('parseAmount', () => {
  it('interpreta miles con punto', () => {
    expect(parseAmount('1.290')).toBe(1290);
    expect(parseAmount('$ 2.440')).toBe(2440);
    expect(parseAmount('12.990')).toBe(12990);
  });

  it('interpreta coma decimal y redondea', () => {
    expect(parseAmount('1.234,56')).toBe(1235);
    expect(parseAmount('1234.56')).toBe(1235);
  });

  it('resuelve miles separados por espacio', () => {
    expect(parseAmount('12 990')).toBe(12990);
  });

  it('corrige confusiones del OCR en tokens numéricos', () => {
    expect(parseAmount('2.44O')).toBe(2440);
    expect(parseAmount('l.150')).toBe(1150);
  });

  it('devuelve null si no es número o excede 1e10', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('99.999.999.999')).toBeNull();
  });
});

describe('findAmounts', () => {
  it('ignora fechas, horas, RUTs y porcentajes', () => {
    expect(findAmounts('FECHA: 05/10/2026 13:42')).toEqual([]);
    expect(findAmounts('R.U.T.: 76.123.456-0')).toEqual([]);
    expect(findAmounts('IVA 19% 390')).toEqual([{ value: 390, index: 7, hasCurrency: false }]);
  });
  it('marca los importes con moneda', () => {
    expect(findAmounts('TOTAL $ 2.440')).toEqual([{ value: 2440, index: 6, hasCurrency: true }]);
  });
});
