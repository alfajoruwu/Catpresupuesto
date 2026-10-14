import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../api/client';
import type { Account, AccountKind } from '../../api/types';
import { invalidate } from '../../lib/data';
import { todayISO } from '../../lib/dates';
import { Button, DateField, MoneyField, SelectField, Sheet, TextField, toast } from '../../ui';
import { ACCOUNT_KIND_OPTIONS } from './accountKinds';
import './accounts.css';

export function AccountFormSheet(props: {
  open: boolean;
  account?: Account;
  onClose(): void;
}): ReactNode {
  const editing = props.account !== undefined;
  const [name, setName] = useState(props.account?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(props.account?.kind ?? 'corriente');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (props.open) {
      setName(props.account?.name ?? '');
      setKind(props.account?.kind ?? 'corriente');
      setOpeningBalance(0);
      setDate(todayISO());
    }
  }, [props.open, props.account?.id, props.account?.name, props.account?.kind]);

  async function handleSave(): Promise<void> {
    const trimmed = name.trim();
    if (trimmed === '') {
      toast('Ingresa un nombre', 'error');
      return;
    }
    setSaving(true);
    try {
      if (props.account !== undefined) {
        await api.updateAccount({ id: props.account.id, name: trimmed, kind });
      } else {
        await api.createAccount({ name: trimmed, kind, openingBalance, date });
      }
      invalidate();
      toast('Guardado', 'ok');
      props.onClose();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={props.open} title={editing ? 'Editar cuenta' : 'Nueva cuenta'} onClose={props.onClose}>
      <div className="ac-sheet-body">
        <TextField
          label="Nombre"
          value={name}
          onChange={setName}
          placeholder="Cuenta corriente Banco Estado"
          autoFocus
        />
        <SelectField<AccountKind>
          label="Tipo"
          value={kind}
          options={ACCOUNT_KIND_OPTIONS}
          onChange={setKind}
        />
        {editing ? null : (
          <>
            <MoneyField label="Saldo inicial" value={openingBalance} onChange={setOpeningBalance} />
            <DateField label="Fecha del saldo" value={date} onChange={setDate} />
            <p className="ac-muted">
              El saldo inicial se registra contra Patrimonio inicial.
            </p>
          </>
        )}
        <Button block loading={saving} onClick={handleSave}>
          Guardar
        </Button>
      </div>
    </Sheet>
  );
}
