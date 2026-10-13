import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../parseText';

const TODAY = '2026-10-12';

describe('parseReceiptText', () => {
  it('(a) boleta de supermercado con OCR ruidoso', () => {
    expect(
      parseReceiptText(
        [
          'SUPERMERCADO EL ROBLE SPA',
          'R.U.T.: 76.123.456-0',
          'GIRO: VENTA AL POR MENOR',
          'BOLETA ELECTRONICA',
          'N° 0004521',
          'FECHA: 05/10/2026 13:42',
          'PAN MARRAQUETA 1.290',
          'LECHE ENTERA 1L 1.150',
          'SUBTOTAL $ 2.440',
          'IVA 19% 390',
          'T0TAL $ 2.440',
          'EFECTIVO 5.000',
          'VUELTO 2.560',
          'Res. SII N° 80 de 22-08-2014',
        ],
        TODAY,
      ),
    ).toEqual({
      total: 2440,
      date: '2026-10-05',
      merchant: 'Supermercado El Roble',
      taxId: '76123456-0',
      docType: 'Boleta electrónica',
      folio: '0004521',
    });
  });

  it('(b) prefiere TOTAL CON PROPINA sobre TOTAL', () => {
    expect(
      parseReceiptText(
        [
          'RESTAURANT LA ESQUINA LTDA',
          'RUT 11.111.111-1',
          'FECHA 10-10-26',
          'CONSUMO 18.500',
          'PROPINA SUGERIDA 10% 1.850',
          'TOTAL 18.500',
          'TOTAL CON PROPINA 20.350',
        ],
        TODAY,
      ),
    ).toMatchObject({ total: 20350, date: '2026-10-10', taxId: '11111111-1' });
  });

  it('(c) RUC/CUIT y coma decimal', () => {
    expect(parseReceiptText(['KIOSCO SAN MARTIN', 'CUIT 30-71234567-8', 'Fecha 03/10/2026', 'TOTAL $ 1.234,56'], TODAY)).toMatchObject({
      total: 1235,
      taxId: '30-71234567-8',
    });
  });

  it('(d) total en la línea siguiente y fecha textual', () => {
    expect(parseReceiptText(['FARMACIA CRUZ VERDE', 'TOTAL A PAGAR', '$ 12.990', '06 OCT 2026'], TODAY)).toMatchObject({
      total: 12990,
      date: '2026-10-06',
    });
  });

  it('(e) sin TOTAL: el mayor importe con $', () => {
    expect(parseReceiptText(['FERRETERIA', 'TORNILLOS $ 3.200', 'PINTURA $ 15.990'], TODAY)).toMatchObject({ total: 15990 });
  });

  it('(f) RUT con dígito inválido se descarta', () => {
    expect(parseReceiptText(['TIENDA X', 'RUT 76.123.456-5', 'TOTAL 1.000'], TODAY)).toMatchObject({ taxId: null });
  });

  it('(g) la fecha futura se ignora', () => {
    expect(parseReceiptText(['TIENDA Y', 'FECHA 15/12/2026', 'TOTAL 1.000'], TODAY)).toMatchObject({ date: null });
  });
});
