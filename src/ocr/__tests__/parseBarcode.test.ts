import { describe, expect, it } from 'vitest';
import { parseBarcodePayload } from '../parseBarcode';

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
describe('parseBarcodePayload', () => {
  it('lee el timbre electrónico SII', () => {
    const ted =
      "<TED version='1.0'><DD><RE>76123456-0</RE><TD>39</TD><F>4521</F>" +
      '<FE>2026-10-05</FE><RR>66666666-6</RR><RSR>CLIENTE</RSR><MNT>2440</MNT>' +
      '<IT1>PAN</IT1><TSTED>2026-10-05T13:42:00</TSTED></DD>' +
      "<FRMT algoritmo='SHA1withRSA'>abc</FRMT></TED>";
    expect(parseBarcodePayload(ted)).toEqual({
      taxId: '76123456-0',
      docType: 'Boleta electrónica',
      folio: '4521',
      date: '2026-10-05',
      total: 2440,
    });
  });

  it('lee el QR de AFIP con base64 url-safe', () => {
    const payload = {
      ver: 1,
      fecha: '2026-10-03',
      cuit: 30712345678,
      ptoVta: 3,
      tipoCmp: 6,
      nroCmp: 154,
      importe: 1234.56,
      moneda: 'PES',
    };
    const b64 = toBase64Url(JSON.stringify(payload));
    expect(parseBarcodePayload(`https://www.afip.gob.ar/fe/qr/?p=${b64}`)).toEqual({
      total: 1235,
      date: '2026-10-03',
      taxId: '30-71234567-8',
      folio: '3-154',
      docType: 'Comprobante AFIP',
    });
  });

  it('lee el QR de SUNAT', () => {
    expect(parseBarcodePayload('20123456789|03|B001|00012345|180.00|1180.00|2026-10-04|1|12345678|')).toEqual({
      taxId: '20123456789',
      docType: 'Boleta de venta',
      folio: 'B001-00012345',
      total: 1180,
      date: '2026-10-04',
    });
  });

  it('lee el QR de CFDI', () => {
    expect(
      parseBarcodePayload(
        'https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx' +
          '?id=5803EB8D-81CD-4557-8719-26632D2FA434&re=XAXX010101000' +
          '&rr=XEXX010101000&tt=000000000000001234.560000&fe=QJ8Fsw==',
      ),
    ).toEqual({
      total: 1235,
      taxId: 'XAXX010101000',
      folio: '5803EB8D-81CD-4557-8719-26632D2FA434',
      docType: 'CFDI',
    });
  });

  it('devuelve null para un EAN de producto', () => {
    expect(parseBarcodePayload('7801234567890')).toBeNull();
  });
});
