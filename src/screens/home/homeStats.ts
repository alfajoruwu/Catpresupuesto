import type { MonthSummary } from '../../api/types';
import { daysInMonth, monthOf } from '../../lib/dates';

export type BudgetStatus = 'none' | 'ok' | 'ahead' | 'over';

export interface HomeStats {
  available: number;
  projectedAvailable: number;
  incomeBase: number;
  spentOfIncomePct: number | null;
  incomeLeft: number;
  dayFraction: number | null;
  budgetStatus: BudgetStatus;
  budgetPct: number | null;
}

export interface HomeStatsOpts {
  month: string;
  today: string;
}

export function computeHomeStats(s: MonthSummary, opts: HomeStatsOpts): HomeStats {
  const available = s.incomeActual - s.expenseActual;
  const projectedAvailable = s.incomeProjected - s.expenseProjected;
  const incomeBase = s.incomeActual > 0 ? s.incomeActual : s.incomeProjected;
  const spentOfIncomePct =
    incomeBase > 0 ? (s.expenseActual * 100) / incomeBase : null;
  const incomeLeft = incomeBase - s.expenseActual;

  const isCurrentMonth = monthOf(opts.today) === opts.month;
  const dayFraction = isCurrentMonth
    ? Number(opts.today.slice(8, 10)) / daysInMonth(opts.month)
    : null;

  let budgetStatus: BudgetStatus;
  if (s.budgetTotal === 0) {
    budgetStatus = 'none';
  } else if (s.budgetSpent > s.budgetTotal) {
    budgetStatus = 'over';
  } else if (
    dayFraction !== null &&
    s.budgetSpent > s.budgetTotal * dayFraction * 1.1
  ) {
    budgetStatus = 'ahead';
  } else {
    budgetStatus = 'ok';
  }

  const budgetPct = s.budgetTotal > 0 ? (s.budgetSpent * 100) / s.budgetTotal : null;

  return {
    available,
    projectedAvailable,
    incomeBase,
    spentOfIncomePct,
    incomeLeft,
    dayFraction,
    budgetStatus,
    budgetPct,
  };
}
