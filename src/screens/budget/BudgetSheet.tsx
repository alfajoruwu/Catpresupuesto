import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../api/client';
import type { BudgetLine } from '../../api/types';
import { invalidate, useQuery } from '../../lib/data';
import { addMonths } from '../../lib/dates';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  MoneyField,
  Segmented,
  SelectField,
  Sheet,
  toast,
} from '../../ui';
import './budget.css';

export function BudgetSheet(props: {
  open: boolean;
  month: string;
  line?: BudgetLine;
  onClose(): void;
  onOpenCategories?(): void;
}): ReactNode {
  const editing = props.line !== undefined;
  const categoriesQuery = useQuery(
    () => api.listCategories({ kind: 'expense', includeArchived: false }),
    [],
  );
  const accountsQuery = useQuery(() => api.listAccounts({ includeArchived: false }), []);
  const [categoryId, setCategoryId] = useState<number | null>(props.line?.categoryId ?? null);
  const [amount, setAmount] = useState(props.line?.amount ?? 0);
  const [accountSel, setAccountSel] = useState(props.line?.accountId ?? 0);
  const [fromMonth, setFromMonth] = useState(props.month);
  const [saving, setSaving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    if (props.open) {
      setCategoryId(props.line?.categoryId ?? null);
      setAmount(props.line?.amount ?? 0);
      setAccountSel(props.line?.accountId ?? 0);
      setFromMonth(props.month);
      setConfirmingRemove(false);
    }
  }, [props.open, props.line, props.month]);

  const nextMonth = addMonths(props.month, 1);
  const categories = categoriesQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];

  async function handleSave(): Promise<void> {
    const cid = editing ? props.line?.categoryId : categoryId;
    if (cid === undefined || cid === null) {
      toast('Elige una categoría', 'error');
      return;
    }
    if (amount <= 0) {
      toast('Ingresa un monto mayor a 0', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.setBudget({
        categoryId: cid,
        accountId: accountSel === 0 ? null : accountSel,
        amount,
        fromMonth,
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

  async function handleRemove(): Promise<void> {
    if (props.line === undefined) return;
    try {
      await api.setBudget({
        categoryId: props.line.categoryId,
        accountId: props.line.accountId ?? null,
        amount: 0,
        fromMonth: props.month,
      });
      invalidate();
      toast('Guardado', 'ok');
      setConfirmingRemove(false);
      props.onClose();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  return (
    <>
      <Sheet
        open={props.open}
        title={editing ? 'Editar fondo' : 'Asignar fondo'}
        onClose={props.onClose}
      >
        {!editing &&
        !categoriesQuery.loading &&
        categoriesQuery.data !== undefined &&
        categories.length === 0 ? (
          <EmptyState
            title="Primero crea una categoría de gastos"
            action={
              <Button
                onClick={() => {
                  props.onClose();
                  props.onOpenCategories?.();
                }}
              >
                Crear categoría
              </Button>
            }
          />
        ) : (
          <div className="bd-sheet-body">
            {editing && props.line !== undefined ? (
              <div className="bd-disabled" aria-disabled="true">
                <SelectField<number>
                  label="Categoría"
                  value={props.line.categoryId}
                  options={[{ value: props.line.categoryId, label: props.line.categoryName }]}
                  onChange={() => undefined}
                />
              </div>
            ) : (
              <SelectField<number>
                label="Categoría"
                value={categoryId}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                onChange={setCategoryId}
                placeholder="Seleccionar categoría"
              />
            )}
            <MoneyField label="Monto mensual" value={amount} onChange={setAmount} />
            <SelectField<number>
              label="Cuenta del fondo"
              value={accountSel}
              options={[
                { value: 0, label: 'Sin cuenta específica' },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
              onChange={setAccountSel}
            />
            <div className="bd-field">
              <span className="bd-label">Aplicar desde</span>
              <Segmented
                value={fromMonth}
                options={[
                  { value: props.month, label: 'Este mes' },
                  { value: nextMonth, label: 'Próximo mes' },
                ]}
                onChange={setFromMonth}
              />
            </div>
            <p className="bd-muted">Se mantiene los meses siguientes hasta que lo cambies.</p>
            <Button block loading={saving} onClick={handleSave}>
              Guardar
            </Button>
            {editing ? (
              <div className="bd-remove-wrap">
                <Button
                  variant="ghost"
                  block
                  className="bd-remove"
                  onClick={() => setConfirmingRemove(true)}
                >
                  Quitar presupuesto
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={confirmingRemove}
        title="Quitar presupuesto"
        message="Se quita el fondo asignado a esta categoría desde este mes."
        confirmLabel="Quitar"
        danger
        onConfirm={handleRemove}
        onCancel={() => setConfirmingRemove(false)}
      />
    </>
  );
}
