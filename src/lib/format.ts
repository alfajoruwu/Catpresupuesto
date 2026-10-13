const moneyFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function formatMoney(n: number): string {
  const v = Math.trunc(n);
  if (v < 0) return `-${moneyFormatter.format(Math.abs(v))}`;
  return moneyFormatter.format(v);
}

export function parseMoneyInput(s: string, allowNegative = false): number {
  const t = s.trim();
  if (t === '') return 0;
  let negative = false;
  let rest = t;
  if (allowNegative && rest.startsWith('-')) {
    negative = true;
    rest = rest.slice(1);
  }
  const digits = rest.replace(/\D/g, '');
  if (digits === '') return 0;
  const value = Number(digits);
  return negative ? -value : value;
}

export function formatPercent(p: number): string {
  return `${Math.round(p)}%`;
}
