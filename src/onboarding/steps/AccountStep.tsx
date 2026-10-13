import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Landmark } from 'lucide-react';
import { Card, MoneyField, SelectField, TextField, toast } from '../../ui';
import { api } from '../../api/client';
import type { Account, AccountKind } from '../../api/types';
import { formatMoney } from '../../lib/format';
import { todayISO } from '../../lib/dates';
import { StepHead } from './StepHead';
import type { StepProps } from './types';

const KIND_OPTIONS: { value: AccountKind; label: string }[] = [
  { value: 'corriente', label: 'Cuenta corriente' },
  { value: 'vista', label: 'Cuenta vista' },
  { value: 'ahorro', label: 'Cuenta de ahorro' },
  { value: 'deposito_plazo', label: 'Depósito a plazo' },
  { value: 'efectivo', label: 'Efectivo' },
];

export interface AccountDraft {
  name: string;
  kind: AccountKind;
  openingBalance: number;
}

export const EMPTY_ACCOUNT_DRAFT: AccountDraft = {
  name: 'Cuenta corriente',
  kind: 'corriente',
  openingBalance: 0,
};

export function AccountStep(props: StepProps & { draft: AccountDraft; setDraft(d: AccountDraft): void }): ReactNode {
  const { goNext, setFooter, draft, setDraft } = props;
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .listAccounts({ includeArchived: true })
      .then((list) => {
        if (alive) setAccounts(list);
      })
      .catch((e: unknown) => {
        toast(e instanceof Error ? e.message : String(e), 'error');
        if (alive) setAccounts([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const hasAccounts = (accounts?.length ?? 0) > 0;
  const displayName = draft.name.trim() === '' ? 'Cuenta corriente' : draft.name.trim();

  const handleNext = useCallback(async () => {
    if (hasAccounts) {
      goNext();
      return;
    }
    let ok = true;
    if (draft.name.trim() === '') {
      setNameError('Escribe un nombre');
      ok = false;
    } else {
      setNameError(null);
    }
    if (!(draft.openingBalance > 0)) {
      setAmountError('Ingresa un monto mayor a 0');
      ok = false;
    } else {
      setAmountError(null);
    }
    if (!ok) return;
    setSaving(true);
    try {
      await api.createAccount({
        name: draft.name.trim(),
        kind: draft.kind,
        openingBalance: draft.openingBalance,
        date: todayISO(),
      });
      goNext();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  }, [draft, hasAccounts, goNext]);

  useEffect(() => {
    setFooter({
      kind: 'primary',
      action: { label: 'Siguiente', loading: saving, onPress: () => void handleNext() },
    });
  }, [setFooter, handleNext, saving]);

  return (
    <>
      <StepHead icon={Landmark} title="Crea una cuenta">
        <p>
          Una cuenta es donde está tu dinero: cuenta corriente, vista, ahorro, depósito a plazo
          o efectivo.
        </p>
      </StepHead>
      {hasAccounts ? (
        <Card>
          <p className="ob-note-strong">Ya tienes {accounts?.length} cuenta(s) creada(s):</p>
          <ul className="ob-plain-list">
            {accounts?.map((a) => (
              <li key={a.id}>
                {a.name} · {formatMoney(a.balance)}
              </li>
            ))}
          </ul>
          <p className="ob-muted">Puedes continuar sin crear otra.</p>
        </Card>
      ) : (
        <>
          <TextField
            label="Nombre"
            value={draft.name}
            onChange={(v) => {
              setDraft({ ...draft, name: v });
              setNameError(null);
            }}
            error={nameError ?? undefined}
          />
          <SelectField<AccountKind>
            label="Tipo"
            value={draft.kind}
            options={KIND_OPTIONS}
            onChange={(v) => setDraft({ ...draft, kind: v })}
          />
          <MoneyField
            label="Saldo inicial"
            value={draft.openingBalance}
            onChange={(n) => {
              setDraft({ ...draft, openingBalance: n });
              setAmountError(null);
            }}
            error={amountError ?? undefined}
          />
          <p className="ob-muted">Por ejemplo, {formatMoney(1000000)}.</p>
          <Card>
            <p className="ob-note-strong">Así se registra</p>
            <table className="ob-table">
              <thead>
                <tr>
                  <th scope="col">Cuenta</th>
                  <th scope="col">Debe</th>
                  <th scope="col">Haber</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{displayName}</td>
                  <td className="ob-nums">{formatMoney(draft.openingBalance)}</td>
                  <td className="ob-nums">—</td>
                </tr>
                <tr>
                  <td>Patrimonio inicial</td>
                  <td className="ob-nums">—</td>
                  <td className="ob-nums">{formatMoney(draft.openingBalance)}</td>
                </tr>
              </tbody>
            </table>
            <p className="ob-muted">
              Todo movimiento se registra así: lo que entra a una cuenta sale de otra, y ambos
              lados suman lo mismo.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
