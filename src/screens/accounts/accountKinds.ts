import type { AccountKind } from '../../api/types';

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  corriente: 'Cuenta corriente',
  vista: 'Cuenta vista',
  ahorro: 'Cuenta de ahorro',
  deposito_plazo: 'Depósito a plazo',
  efectivo: 'Efectivo',
};

export const ACCOUNT_KIND_OPTIONS: { value: AccountKind; label: string }[] = (
  Object.keys(ACCOUNT_KIND_LABELS) as AccountKind[]
).map((value) => ({ value, label: ACCOUNT_KIND_LABELS[value] }));
