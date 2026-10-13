import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDownToLine, Check, Receipt } from 'lucide-react';
import { Button, Card, DateField, MoneyField, SelectField, TextField, toast } from '../../ui';
import { api } from '../../api/client';
import type { Account, Category, CategoryKind } from '../../api/types';
import { currentMonth, todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import { StepHead } from './StepHead';
import type { StepProps } from './types';

export type MovementKind = 'income' | 'expense';

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));

function pickId(items: { id: number; name: string }[], preferred: string): number | null {
  const found = items.find((c) => c.name === preferred) ?? items[0];
  return found ? found.id : null;
}

const TEXT: Record<
  MovementKind,
  {
    title: string;
    intro: string;
    fixedTitle: string;
    fixedDefaultName: string;
    fixedDefaultDay: number;
    fixedDefaultCategory: string;
    fixedSave: string;
    variableTitle: string;
    variableDefaultDesc: string;
    variableDefaultCategory: string;
    variableSave: string;
  }
> = {
  income: {
    title: 'Registra tus ingresos',
    intro:
      'Un ingreso fijo se repite solo (por ejemplo, el sueldo). Uno variable ocurre una vez (una venta, un trabajo extra).',
    fixedTitle: 'Ingreso fijo',
    fixedDefaultName: 'Sueldo',
    fixedDefaultDay: 1,
    fixedDefaultCategory: 'Sueldo',
    fixedSave: 'Guardar ingreso fijo',
    variableTitle: 'Ingreso variable',
    variableDefaultDesc: 'Venta de bicicleta',
    variableDefaultCategory: 'Otros ingresos',
    variableSave: 'Guardar ingreso variable',
  },
  expense: {
    title: 'Registra tus gastos',
    intro:
      'Un gasto fijo se repite cada mes, año u otro período (arriendo, plan de celular). Uno variable ocurre cuando ocurre (supermercado, un imprevisto).',
    fixedTitle: 'Gasto fijo',
    fixedDefaultName: 'Arriendo',
    fixedDefaultDay: 5,
    fixedDefaultCategory: 'Vivienda',
    fixedSave: 'Guardar gasto fijo',
    variableTitle: 'Gasto variable',
    variableDefaultDesc: 'Supermercado',
    variableDefaultCategory: 'Alimentación',
    variableSave: 'Guardar gasto variable',
  },
};

export function MovementStep(props: StepProps & { movementKind: MovementKind }): ReactNode {
  const { goNext, setFooter, movementKind: kind } = props;
  const t = TEXT[kind];
  const Icon = kind === 'income' ? ArrowDownToLine : Receipt;

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [fixedName, setFixedName] = useState(t.fixedDefaultName);
  const [fixedAmount, setFixedAmount] = useState(0);
  const [fixedDay, setFixedDay] = useState(t.fixedDefaultDay);
  const [fixedCategoryId, setFixedCategoryId] = useState<number | null>(null);
  const [fixedAccountId, setFixedAccountId] = useState<number | null>(null);
  const [fixedNameError, setFixedNameError] = useState<string | null>(null);
  const [fixedAmountError, setFixedAmountError] = useState<string | null>(null);
  const [fixedSaving, setFixedSaving] = useState(false);
  const [fixedSaved, setFixedSaved] = useState<string | null>(null);

  const [varDesc, setVarDesc] = useState(t.variableDefaultDesc);
  const [varAmount, setVarAmount] = useState(0);
  const [varDate, setVarDate] = useState(todayISO());
  const [varCategoryId, setVarCategoryId] = useState<number | null>(null);
  const [varAccountId, setVarAccountId] = useState<number | null>(null);
  const [varDescError, setVarDescError] = useState<string | null>(null);
  const [varAmountError, setVarAmountError] = useState<string | null>(null);
  const [varSaving, setVarSaving] = useState(false);
  const [varSaved, setVarSaved] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.listCategories({ kind: kind as CategoryKind, includeArchived: false }),
      api.listAccounts({ includeArchived: false }),
    ])
      .then(([cats, accs]) => {
        if (!alive) return;
        setCategories(cats);
        setAccounts(accs);
        setFixedCategoryId((prev) => prev ?? pickId(cats, t.fixedDefaultCategory));
        setVarCategoryId((prev) => prev ?? pickId(cats, t.variableDefaultCategory));
        setFixedAccountId((prev) => prev ?? (accs[0] ? accs[0].id : null));
        setVarAccountId((prev) => prev ?? (accs[0] ? accs[0].id : null));
      })
      .catch((e: unknown) => {
        toast(e instanceof Error ? e.message : String(e), 'error');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const todayDay = Number(todayISO().slice(8, 10));
  const fixedAlreadyPosted = todayDay >= fixedDay;

  const saveFixed = useCallback(async () => {
    let ok = true;
    if (fixedName.trim() === '') {
      setFixedNameError('Escribe un nombre');
      ok = false;
    } else {
      setFixedNameError(null);
    }
    if (!(fixedAmount > 0)) {
      setFixedAmountError('Ingresa un monto mayor a 0');
      ok = false;
    } else {
      setFixedAmountError(null);
    }
    if (fixedCategoryId === null || fixedAccountId === null) {
      toast('Faltan datos: revisa la categoría y la cuenta', 'error');
      ok = false;
    }
    if (!ok) return;
    setFixedSaving(true);
    try {
      await api.createRecurring({
        kind: kind as CategoryKind,
        name: fixedName.trim(),
        amount: fixedAmount,
        categoryId: fixedCategoryId as number,
        accountId: fixedAccountId as number,
        intervalMonths: 1,
        dayOfMonth: fixedDay,
        startDate: `${currentMonth()}-01`,
        endDate: null,
        bonusEveryMonths: null,
        bonusPercent: null,
        today: todayISO(),
      });
      setFixedSaved(`${fixedName.trim()} · ${formatMoney(fixedAmount)} · mensual, día ${fixedDay}`);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setFixedSaving(false);
    }
  }, [fixedName, fixedAmount, fixedDay, fixedCategoryId, fixedAccountId, kind]);

  const saveVariable = useCallback(async () => {
    let ok = true;
    if (varDesc.trim() === '') {
      setVarDescError('Escribe una descripción');
      ok = false;
    } else {
      setVarDescError(null);
    }
    if (!(varAmount > 0)) {
      setVarAmountError('Ingresa un monto mayor a 0');
      ok = false;
    } else {
      setVarAmountError(null);
    }
    if (varCategoryId === null || varAccountId === null) {
      toast('Faltan datos: revisa la categoría y la cuenta', 'error');
      ok = false;
    }
    if (!ok) return;
    setVarSaving(true);
    try {
      if (kind === 'income') {
        await api.createIncome({
          amount: varAmount,
          date: varDate,
          categoryId: varCategoryId as number,
          accountId: varAccountId as number,
          description: varDesc.trim(),
        });
      } else {
        await api.createExpense({
          amount: varAmount,
          date: varDate,
          categoryId: varCategoryId as number,
          accountId: varAccountId as number,
          description: varDesc.trim(),
          receipt: null,
        });
      }
      setVarSaved(`${varDesc.trim()} · ${formatMoney(varAmount)} · ${varDate}`);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setVarSaving(false);
    }
  }, [varDesc, varAmount, varDate, varCategoryId, varAccountId, kind]);

  useEffect(() => {
    setFooter({
      kind: 'custom',
      node: (
        <div className="ob-footer-stack">
          <Button block onClick={goNext}>
            Siguiente
          </Button>
          <button type="button" className="ob-skip" onClick={goNext}>
            Omitir este paso
          </button>
        </div>
      ),
    });
  }, [goNext, setFooter]);

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  return (
    <>
      <StepHead icon={Icon} title={t.title}>
        <p>{t.intro}</p>
      </StepHead>
      <Card>
        <h3 className="ob-card-title">{t.fixedTitle}</h3>
        {fixedSaved !== null ? (
          <p className="ob-saved">
            <span className="ob-saved__check" aria-hidden="true">
              <Check size={18} />
            </span>
            <span>{fixedSaved}</span>
          </p>
        ) : (
          <>
            <TextField
              label="Nombre"
              value={fixedName}
              onChange={(v) => {
                setFixedName(v);
                setFixedNameError(null);
              }}
              error={fixedNameError ?? undefined}
            />
            <MoneyField
              label="Monto"
              value={fixedAmount}
              onChange={(n) => {
                setFixedAmount(n);
                setFixedAmountError(null);
              }}
              error={fixedAmountError ?? undefined}
            />
            <SelectField<number>
              label="Día de pago"
              value={fixedDay}
              options={DAY_OPTIONS}
              onChange={setFixedDay}
            />
            {fixedAlreadyPosted ? (
              <p className="ob-muted">
                Como el día {fixedDay} ya pasó, este mes ya quedó registrado.
              </p>
            ) : null}
            <SelectField<number>
              label="Categoría"
              value={fixedCategoryId}
              options={categoryOptions}
              onChange={setFixedCategoryId}
            />
            <SelectField<number>
              label="Cuenta"
              value={fixedAccountId}
              options={accountOptions}
              onChange={setFixedAccountId}
            />
            <Button block loading={fixedSaving} onClick={() => void saveFixed()}>
              {t.fixedSave}
            </Button>
          </>
        )}
      </Card>
      <Card>
        <h3 className="ob-card-title">{t.variableTitle}</h3>
        {varSaved !== null ? (
          <p className="ob-saved">
            <span className="ob-saved__check" aria-hidden="true">
              <Check size={18} />
            </span>
            <span>{varSaved}</span>
          </p>
        ) : (
          <>
            <TextField
              label="Descripción"
              value={varDesc}
              onChange={(v) => {
                setVarDesc(v);
                setVarDescError(null);
              }}
              error={varDescError ?? undefined}
            />
            <MoneyField
              label="Monto"
              value={varAmount}
              onChange={(n) => {
                setVarAmount(n);
                setVarAmountError(null);
              }}
              error={varAmountError ?? undefined}
            />
            <DateField label="Fecha" value={varDate} onChange={setVarDate} />
            <SelectField<number>
              label="Categoría"
              value={varCategoryId}
              options={categoryOptions}
              onChange={setVarCategoryId}
            />
            <SelectField<number>
              label="Cuenta"
              value={varAccountId}
              options={accountOptions}
              onChange={setVarAccountId}
            />
            <Button block loading={varSaving} onClick={() => void saveVariable()}>
              {t.variableSave}
            </Button>
          </>
        )}
      </Card>
    </>
  );
}
