import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../api/client';
import type { RecurringRule } from '../../api/types';
import { invalidate, useQuery } from '../../lib/data';
import { todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import {
  Button,
  ConfirmDialog,
  DateField,
  MoneyField,
  Segmented,
  SelectField,
  Sheet,
  TextField,
  toast,
} from '../../ui';
import { CategoryPicker } from './CategoryPicker';
import './movements.css';

type Freq = 1 | 3 | 6 | 12 | 'other';

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

const STANDARD_FREQS = [1, 3, 6, 12];
export function RecurringSheet(props: {
  open: boolean;
  kind: 'income' | 'expense';
  rule?: RecurringRule;
  onClose(): void;
}): ReactNode {
  const { open, kind, rule, onClose } = props;
  const isIncome = kind === 'income';
  const editing = rule !== undefined;
  const title = editing
    ? isIncome
      ? 'Editar ingreso fijo'
      : 'Editar gasto fijo'
    : isIncome
      ? 'Nuevo ingreso fijo'
      : 'Nuevo gasto fijo';

  const accounts = useQuery(() => api.listAccounts({ includeArchived: false }), [open]);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [freq, setFreq] = useState<Freq>(1);
  const [customMonths, setCustomMonths] = useState('2');
  const [day, setDay] = useState(1);
  const [startDate, setStartDate] = useState(todayISO());
  const [hasEnd, setHasEnd] = useState(false);
  const [endDate, setEndDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [hasBonus, setHasBonus] = useState(false);
  const [bonusMonths, setBonusMonths] = useState('3');
  const [bonusPercent, setBonusPercent] = useState('50');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!open) return;
    const initial = rule?.intervalMonths ?? 1;
    const standard = STANDARD_FREQS.includes(initial);
    setName(rule?.name ?? '');
    setAmount(rule?.amount ?? 0);
    setFreq(standard ? (initial as Freq) : 'other');
    setCustomMonths(standard ? '2' : String(initial));
    setDay(rule?.dayOfMonth ?? 1);
    setStartDate(rule?.startDate ?? todayISO());
    setHasEnd(rule?.endDate != null);
    setEndDate(rule?.endDate ?? todayISO());
    setCategoryId(rule?.categoryId ?? null);
    setAccountId(rule?.accountId ?? null);
    setHasBonus(isIncome && rule?.bonusEveryMonths != null && rule?.bonusPercent != null);
    setBonusMonths(rule?.bonusEveryMonths != null ? String(rule.bonusEveryMonths) : '3');
    setBonusPercent(rule?.bonusPercent != null ? String(rule.bonusPercent) : '50');
    setConfirmingDelete(false);
  }, [open, rule, isIncome]);

  useEffect(() => {
    if (!open || editing) return;
    const list = accounts.data;
    if (list !== undefined && list.length === 1 && accountId === null) {
      setAccountId(list[0].id);
    }
  }, [open, editing, accounts.data, accountId]);

  const intervalMonths = freq === 'other' ? Math.trunc(Number(customMonths)) || 0 : freq;
  const bonusEvery = Math.trunc(Number(bonusMonths)) || 0;
  const bonusPct = Math.trunc(Number(bonusPercent)) || 0;
  const bonusAmount = Math.round((amount * bonusPct) / 100);

  async function handleSave(): Promise<void> {
    const payload = {
      kind,
      name: name.trim(),
      amount,
      categoryId: categoryId as number,
      accountId: accountId as number,
      intervalMonths,
      dayOfMonth: day,
      startDate,
      endDate: hasEnd ? endDate : null,
      bonusEveryMonths: isIncome && hasBonus ? bonusEvery : null,
      bonusPercent: isIncome && hasBonus ? bonusPct : null,
      today: todayISO(),
    };
    setSaving(true);
    try {
      if (editing && rule !== undefined) {
        await api.updateRecurring({ id: rule.id, ...payload });
      } else {
        await api.createRecurring(payload);
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
    if (rule === undefined) return;
    setDeleting(true);
    try {
      await api.deleteRecurring({ id: rule.id });
      invalidate();
      toast('Eliminado', 'ok');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setDeleting(false);
    }
  }

  const accountList = accounts.data ?? [];

  return (
    <Sheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
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
      }
    >
      {accounts.loading && accounts.data === undefined ? (
        <div className="mv-loading">Cargando…</div>
      ) : (
        <>
          <TextField
            label="Nombre"
            value={name}
            onChange={setName}
            placeholder={isIncome ? 'Sueldo' : 'Arriendo'}
          />
          <MoneyField label="Monto" value={amount} onChange={setAmount} />
          <span className="mv-picker__label">Frecuencia</span>
          <Segmented<Freq>
            value={freq}
            options={[
              { value: 1, label: 'Mensual' },
              { value: 3, label: 'Trimestral' },
              { value: 6, label: 'Semestral' },
              { value: 12, label: 'Anual' },
              { value: 'other', label: 'Otra' },
            ]}
            onChange={setFreq}
          />
          {freq === 'other' ? (
            <TextField
              label="Cada cuántos meses"
              type="number"
              value={customMonths}
              onChange={setCustomMonths}
            />
          ) : null}
          <SelectField<number>
            label="Día del mes"
            value={day}
            options={DAY_OPTIONS}
            onChange={setDay}
          />
          {day > 28 ? (
            <div className="mv-muted">En meses más cortos se usa el último día.</div>
          ) : null}
          <DateField label="Desde" value={startDate} onChange={setStartDate} />
          <label className="mv-check">
            <input
              type="checkbox"
              checked={hasEnd}
              onChange={(e) => setHasEnd(e.target.checked)}
            />
            Tiene fecha de término
          </label>
          {hasEnd ? <DateField label="Hasta" value={endDate} onChange={setEndDate} /> : null}
          <CategoryPicker kind={kind} value={categoryId} onChange={setCategoryId} />
          <SelectField<number>
            label={isIncome ? 'Cuenta de destino' : 'Pagado desde'}
            value={accountId}
            options={accountList.map((a) => ({
              value: a.id,
              label: `${a.name} · ${formatMoney(a.balance)}`,
            }))}
            onChange={setAccountId}
          />
          {isIncome ? (
            <>
              <label className="mv-check">
                <input
                  type="checkbox"
                  checked={hasBonus}
                  onChange={(e) => setHasBonus(e.target.checked)}
                />
                Recibe una bonificación periódica
              </label>
              {hasBonus ? (
                <>
                  <TextField
                    label="Cada cuántos meses"
                    type="number"
                    value={bonusMonths}
                    onChange={setBonusMonths}
                  />
                  <TextField
                    label="Porcentaje del monto"
                    type="number"
                    value={bonusPercent}
                    onChange={setBonusPercent}
                  />
                  {amount > 0 && bonusEvery > 0 && bonusPct > 0 ? (
                    <div className="mv-muted">
                      Bonificación de {formatMoney(bonusAmount)} cada {bonusEvery} meses
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </>
      )}
      <ConfirmDialog
        open={confirmingDelete}
        title="Eliminar fijo"
        message="Los movimientos ya registrados se conservan."
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => (deleting ? undefined : setConfirmingDelete(false))}
      />
    </Sheet>
  );
}
