export function frequencyLabel(intervalMonths: number, dayOfMonth: number): string {
  switch (intervalMonths) {
    case 1:
      return `Mensual · día ${dayOfMonth}`;
    case 3:
      return `Trimestral · día ${dayOfMonth}`;
    case 6:
      return `Semestral · día ${dayOfMonth}`;
    case 12:
      return `Anual · día ${dayOfMonth}`;
    default:
      return `Cada ${intervalMonths} meses · día ${dayOfMonth}`;
  }
}
