import { describe, expect, it } from 'vitest';
import type { MonthSummary } from '../../api/types';
import { computeHomeStats } from './homeStats';

function summary(partial: Partial<MonthSummary> & { month: string }): MonthSummary {
  return {
    incomeActual: 0,
    incomeProjected: 0,
    expenseActual: 0,
    expenseProjected: 0,
    budgetTotal: 0,
    budgetSpent: 0,
    unbudgetedSpent: 0,
    totalBalance: 0,
    ...partial,
  };
}

describe('computeHomeStats sin ingresos', () => {
  it('pct null cuando no hay ingresos reales ni proyectados', () => {
    const stats = computeHomeStats(
      summary({ month: '2026-10', incomeActual: 0, incomeProjected: 0, expenseActual: 5000 }),
      { month: '2026-10', today: '2026-10-13' },
    );
    expect(stats.spentOfIncomePct).toBeNull();
    expect(stats.incomeBase).toBe(0);
    expect(stats.incomeLeft).toBe(-5000);
  });
});

describe('computeHomeStats ingresos solo proyectados', () => {
  it('usa incomeProjected como base', () => {
    const stats = computeHomeStats(
      summary({
        month: '2026-10',
        incomeActual: 0,
        incomeProjected: 500000,
        expenseActual: 100000,
      }),
      { month: '2026-10', today: '2026-10-13' },
    );
    expect(stats.incomeBase).toBe(500000);
    expect(stats.spentOfIncomePct).toBe(20);
    expect(stats.incomeLeft).toBe(400000);
  });
});

describe('computeHomeStats gasto mayor que el ingreso', () => {
  it('pct > 100 e incomeLeft negativo', () => {
    const stats = computeHomeStats(
      summary({ month: '2026-10', incomeActual: 300000, expenseActual: 450000 }),
      { month: '2026-10', today: '2026-10-13' },
    );
    expect(stats.spentOfIncomePct).toBe(150);
    expect(stats.incomeLeft).toBe(-150000);
    expect(stats.available).toBe(-150000);
  });
});

describe('computeHomeStats budgetStatus', () => {
  const today = '2026-10-13';
  const dayFraction = 13 / 31;

  it("'none' sin presupuesto asignado", () => {
    const stats = computeHomeStats(
      summary({ month: '2026-10', budgetTotal: 0, budgetSpent: 10000 }),
      { month: '2026-10', today },
    );
    expect(stats.budgetStatus).toBe('none');
    expect(stats.budgetPct).toBeNull();
  });

  it("'over' cuando el gasto supera el total", () => {
    const stats = computeHomeStats(
      summary({ month: '2026-10', budgetTotal: 200000, budgetSpent: 250000 }),
      { month: '2026-10', today },
    );
    expect(stats.budgetStatus).toBe('over');
    expect(stats.budgetPct).toBe(125);
  });

  it("'ahead' cuando va por sobre el ritmo del mes", () => {
    const total = 310000;
    const spent = Math.ceil(total * dayFraction * 1.1) + 100;
    const stats = computeHomeStats(
      summary({ month: '2026-10', budgetTotal: total, budgetSpent: spent }),
      { month: '2026-10', today },
    );
    expect(spent).toBeLessThanOrEqual(total);
    expect(stats.budgetStatus).toBe('ahead');
  });

  it("'ok' justo en el límite de ritmo (igual a total * dayFraction * 1.1)", () => {
    const total = 310000;
    const spent = total * dayFraction * 1.1;
    const stats = computeHomeStats(
      summary({ month: '2026-10', budgetTotal: total, budgetSpent: spent }),
      { month: '2026-10', today },
    );
    expect(stats.budgetStatus).toBe('ok');
  });

  it("'ok' con gasto bajo el ritmo", () => {
    const stats = computeHomeStats(
      summary({ month: '2026-10', budgetTotal: 300000, budgetSpent: 50000 }),
      { month: '2026-10', today },
    );
    expect(stats.budgetStatus).toBe('ok');
  });
});

describe('computeHomeStats mes distinto del actual', () => {
  it('dayFraction null y nunca ahead', () => {
    const total = 300000;
    const stats = computeHomeStats(
      summary({ month: '2026-09', budgetTotal: total, budgetSpent: total }),
      { month: '2026-09', today: '2026-10-13' },
    );
    expect(stats.dayFraction).toBeNull();
    expect(stats.budgetStatus).toBe('ok');
  });
});
