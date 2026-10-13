import { describe, expect, it } from 'vitest';
import { addMonths, daysInMonth, monthLabel } from './dates';

describe('addMonths', () => {
  it("cruza de año hacia adelante ('2026-12' + 1 -> '2027-01')", () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });

  it("cruza de año hacia atrás ('2026-01' - 1 -> '2025-12')", () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
});

describe('daysInMonth', () => {
  it('febrero bisiesto de 2028 tiene 29 días', () => {
    expect(daysInMonth('2028-02')).toBe(29);
  });
});

describe('monthLabel', () => {
  it("'2026-10' es 'Octubre 2026'", () => {
    expect(monthLabel('2026-10')).toBe('Octubre 2026');
  });
});
