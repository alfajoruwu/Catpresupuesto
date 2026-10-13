import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../api/client';
import type { Account } from '../../api/types';
import { invalidate } from '../../lib/data';
import { todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import { Button, MoneyField, Sheet, toast } from '../../ui';
import './accounts.css';

export function AdjustSheet(props: {
  open: boolean;
  account: Account;
  onClose(): void;
}): ReactNode {
  const [balance, setBalance] = useState(props.account.balance);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (props.open) setBalance(props.account.balance);
  }, [props.open, props.account.id, props.account.balance]);

  const diff = balance - props.account.balance;

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const entry = await api.adjustAccountBalance({
        id: props.account.id,
        newBalance: balance,
        date: todayISO(),
      });
      if (entry === null) {
        toast('El saldo no cambió');
      } else {
        invalidate();
        toast('Guardado', 'ok');
        props.onClose();
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={props.open} title="Ajustar saldo" onClose={props.onClose}>
      <div className="ac-sheet-body">
        <MoneyField label="Saldo real" value={balance} onChange={setBalance} allowNegative />
        <div
          className={`ac-diff${diff > 0 ? ' ac-diff--pos' : diff < 0 ? ' ac-diff--neg' : ''}`}
        >
          {diff > 0
            ? `Diferencia: +${formatMoney(diff)}`
            : diff < 0
              ? `Diferencia: ${formatMoney(diff)}`
              : 'Diferencia: $0'}
        </div>
        <p className="ac-muted">
          Se registra un ajuste por la diferencia contra Patrimonio inicial.
        </p>
        <Button block loading={saving} onClick={handleSave}>
          Guardar
        </Button>
      </div>
    </Sheet>
  );
}
