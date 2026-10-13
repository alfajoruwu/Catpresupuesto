import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../api/client';
import type { Entry } from '../../api/types';
import { invalidate, useQuery } from '../../lib/data';
import { todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import { navigate } from '../../lib/router';
import {
  Button,
  ConfirmDialog,
  DateField,
  EmptyState,
  MoneyField,
  SelectField,
  Sheet,
  TextField,
  toast,
} from '../../ui';
import { CategoryPicker } from './CategoryPicker';
import './movements.css';

export function EntrySheet(props: {
  open: boolean;
  kind: 'income' | 'expense';
  entry?: Entry;
  onClose(): void;
}): ReactNode {
  const { open, kind, entry, onClose } = props;
  const isIncome = kind === 'income';
  const editing = entry !== undefined;
  const title = editing
    ? isIncome
      ? 'Editar ingreso'
      : 'Editar gasto'
    : isIncome
      ? 'Nuevo ingreso'
      : 'Nuevo gasto';

  const accounts = useQuery(() => api.listAccounts({ includeArchived: false }), [open]);

  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [amountError, setAmountError] = useState<string | undefined>(undefined);
  const [categoryError, setCategoryError] = useState<string | undefined>(undefined);
  const [accountError, setAccountError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(entry?.amount ?? 0);
    setDate(entry?.date ?? todayISO());
    setCategoryId(entry?.categoryId ?? null);
    setAccountId(entry?.accountId ?? null);
    setDescription(entry?.description ?? '');
    setAmountError(undefined);
    setCategoryError(undefined);
    setAccountError(undefined);
    setConfirmingDelete(false);
  }, [open, entry]);

  useEffect(() => {
    if (!open || editing) return;
    const list = accounts.data;
    if (list !== undefined && list.length === 1 && accountId === null) {
      setAccountId(list[0].id);
    }
  }, [open, editing, accounts.data, accountId]);

  async function handleSave(): Promise<void> {
    const aError = amount <= 0 ? 'Ingresa un monto' : undefined;
    const cError = categoryId === null ? 'Elige una categoría' : undefined;
    const accError = accountId === null ? 'Elige una cuenta' : undefined;
    setAmountError(aError);
    setCategoryError(cError);
    setAccountError(accError);
    if (aError !== undefined || cError !== undefined || accError !== undefined) return;
    setSaving(true);
    try {
      if (editing && entry !== undefined) {
        await api.updateEntry({
          id: entry.id,
          amount,
          date,
          categoryId: categoryId as number,
          accountId: accountId as number,
          description,
        });
      } else if (isIncome) {
        await api.createIncome({
          amount,
          date,
          categoryId: categoryId as number,
          accountId: accountId as number,
          description,
        });
      } else {
        await api.createExpense({
          amount,
          date,
          categoryId: categoryId as number,
          accountId: accountId as number,
          description,
          receipt: null,
        });
      }
      invalidate();
      toast('Guardado', 'ok');
      onClose();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (entry === undefined) return;
    setDeleting(true);
    try {
      await api.deleteEntry({ id: entry.id });
      invalidate();
      toast('Eliminado', 'ok');
      setConfirmingDelete(false);
      onClose();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setDeleting(false);
    }
  }

  const accountList = accounts.data ?? [];
  const noAccounts = !accounts.loading && accounts.data !== undefined && accountList.length === 0;

  const receiptRows: { label: string; value: string }[] = [];
  if (entry?.receipt) {
    const r = entry.receipt;
    if (r.merchant !== null) receiptRows.push({ label: 'Comercio', value: r.merchant });
    if (r.docType !== null) receiptRows.push({ label: 'Documento', value: r.docType });
    if (r.folio !== null) receiptRows.push({ label: 'Folio', value: r.folio });
    if (r.taxId !== null) receiptRows.push({ label: 'RUT emisor', value: r.taxId });
  }

  return (
    <Sheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
        noAccounts ? undefined : (
          <div className="mv-footer">
            <Button block loading={saving} onClick={handleSave}>
              Guardar
            </Button>
            {editing ? (
              <Button variant="ghost" block onClick={() => setConfirmingDelete(true)}>
                Eliminar
              </Button>
            ) : null}
          </div>
        )
      }
    >
      {accounts.loading && accounts.data === undefined ? (
        <div className="mv-loading">Cargando…</div>
      ) : noAccounts ? (
        <EmptyState
          title="Primero crea una cuenta"
          action={
            <Button
              onClick={() => {
                navigate('/cuentas');
                onClose();
              }}
            >
              Ir a Cuentas
            </Button>
          }
        />
      ) : (
        <>
          <MoneyField
            label="Monto"
            value={amount}
            onChange={(n) => {
              setAmount(n);
              setAmountError(undefined);
            }}
            error={amountError}
          />
          <DateField label="Fecha" value={date} onChange={setDate} />
          <CategoryPicker
            kind={kind}
            value={categoryId}
            onChange={(id) => {
              setCategoryId(id);
              setCategoryError(undefined);
            }}
          />
          {categoryError ? <div className="mv-error">{categoryError}</div> : null}
          <SelectField<number>
            label={isIncome ? 'Cuenta de destino' : 'Pagado desde'}
            value={accountId}
            options={accountList.map((a) => ({
              value: a.id,
              label: `${a.name} · ${formatMoney(a.balance)}`,
            }))}
            onChange={(v) => {
              setAccountId(v);
              setAccountError(undefined);
            }}
          />
          {accountError ? <div className="mv-error">{accountError}</div> : null}
          <TextField
            label="Descripción"
            value={description}
            onChange={setDescription}
            placeholder="Opcional"
          />
          {editing && receiptRows.length > 0 ? (
            <dl>
              {receiptRows.map((r) => (
                <div className="mv-read" key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {editing && entry !== undefined && entry.lines.length > 0 ? (
            <>
              <div className="mv-subtitle">Asiento contable</div>
              <table className="mv-ledger">
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    <th>Debe</th>
                    <th>Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.lines.map((l) => (
                    <tr key={l.ledgerAccountId}>
                      <td>{l.ledgerAccountName}</td>
                      <td>{l.debit === 0 ? '' : formatMoney(l.debit)}</td>
                      <td>{l.credit === 0 ? '' : formatMoney(l.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </>
      )}
      <ConfirmDialog
        open={confirmingDelete}
        title="Eliminar movimiento"
        message={
          entry?.recurringId != null
            ? 'Este movimiento viene de un fijo. Al eliminarlo no se volverá a generar para esa fecha.'
            : '¿Eliminar este movimiento?'
        }
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => (deleting ? undefined : setConfirmingDelete(false))}
      />
    </Sheet>
  );
}
