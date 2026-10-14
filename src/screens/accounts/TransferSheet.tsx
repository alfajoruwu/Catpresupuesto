import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../api/client';
import type { Account } from '../../api/types';
import { invalidate, useQuery } from '../../lib/data';
import { todayISO } from '../../lib/dates';
import { Button, DateField, MoneyField, SelectField, Sheet, TextField, toast } from '../../ui';
import './accounts.css';

export function TransferSheet(props: {
  open: boolean;
  from: Account;
  onClose(): void;
}): ReactNode {
  const accountsQuery = useQuery(() => api.listAccounts({ includeArchived: false }), []);
  const [toId, setToId] = useState<number | null>(null);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (props.open) {
      setToId(null);
      setAmount(0);
      setDate(todayISO());
      setDescription('');
    }
  }, [props.open, props.from.id]);

  const destinations = (accountsQuery.data ?? []).filter((a) => a.id !== props.from.id);

  async function handleSave(): Promise<void> {
    if (toId === null) {
      toast('Elige la cuenta de destino', 'error');
      return;
    }
    if (amount <= 0) {
      toast('Ingresa un monto mayor a 0', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.createTransfer({
        fromAccountId: props.from.id,
        toAccountId: toId,
        amount,
        date,
        description: description.trim(),
      });
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
    <Sheet open={props.open} title="Transferir" onClose={props.onClose}>
      <div className="ac-sheet-body">
        <p className="ac-static">Desde: {props.from.name}</p>
        {destinations.length > 0 ? (
          <SelectField<number>
            label="Hacia"
            value={toId}
            options={destinations.map((a) => ({ value: a.id, label: a.name }))}
            onChange={setToId}
            placeholder="Seleccionar cuenta"
          />
        ) : (
          <p className="ac-muted">No hay otra cuenta para transferir.</p>
        )}
        <MoneyField label="Monto" value={amount} onChange={setAmount} />
        <DateField label="Fecha" value={date} onChange={setDate} />
        <TextField
          label="Descripción"
          value={description}
          onChange={setDescription}
          placeholder="Opcional"
        />
        <Button
          block
          loading={saving}
          disabled={toId === null || amount <= 0}
          onClick={handleSave}
        >
          Guardar
        </Button>
      </div>
    </Sheet>
  );
}
