import { describe, expect, it } from 'vitest';
import { formatMoney, formatPercent, parseMoneyInput } from './format';

describe('parseMoneyInput', () => {
  it("toma solo los dígitos ('1.234.567' -> 1234567)", () => {
    expect(parseMoneyInput('1.234.567')).toBe(1234567);
  });

  it("cadena vacía devuelve 0", () => {
    expect(parseMoneyInput('')).toBe(0);
  });
});

describe('formatMoney', () => {
  it('formatea 1234567 como $1.234.567', () => {
    expect(formatMoney(1234567)).toBe('$1.234.567');
  });

  it('formatea -5000 como -$5.000', () => {
    expect(formatMoney(-5000)).toBe('-$5.000');
  });
});

describe('formatPercent', () => {
  it('redondea a entero', () => {
    expect(formatPercent(45.4)).toBe('45%');
  });
});
