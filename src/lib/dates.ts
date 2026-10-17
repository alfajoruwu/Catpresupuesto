function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const total = year * 12 + (m - 1) + n;
  const y = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${y}-${pad2(mm)}`;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(year, m, 0).getDate();
}

export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MONTH_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

export function monthLabel(month: string): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return `${MONTH_NAMES[m - 1]} ${year}`;
}

export function shortDate(date: string): string {
  const d = Number(date.slice(8, 10));
  const m = Number(date.slice(5, 7));
  return `${d} ${MONTH_SHORT[m - 1]}`;
}

export function longDate(date: string): string {
  const d = Number(date.slice(8, 10));
  const m = Number(date.slice(5, 7));
  const y = Number(date.slice(0, 4));
  return `${d} de ${MONTH_NAMES[m - 1].toLowerCase()} de ${y}`;
}
