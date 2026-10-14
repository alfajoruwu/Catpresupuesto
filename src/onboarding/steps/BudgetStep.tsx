import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChartPie } from 'lucide-react';
import { MoneyField, SelectField, toast } from '../../ui';
import { api } from '../../api/client';
import type { Account, Category } from '../../api/types';
import { currentMonth } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import { StepHead } from './StepHead';
import type { StepProps } from './types';

function pickCategoryId(cats: Category[], preferred: string): number | null {
  const found = cats.find((c) => c.name === preferred) ?? cats[0];
  return found ? found.id : null;
}

export function BudgetStep(props: StepProps): ReactNode {
  const { goNext, setFooter } = props;
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [amount, setAmount] = useState(0);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.listCategories({ kind: 'expense', includeArchived: false }),
      api.listAccounts({ includeArchived: false }),
    ])
      .then(([cats, accs]) => {
        if (!alive) return;
        setCategories(cats);
        setAccounts(accs);
        setCategoryId((prev) => prev ?? pickCategoryId(cats, 'Alimentación'));
        setAccountId((prev) => prev ?? (accs[0] ? accs[0].id : null));
      })
      .catch((e: unknown) => {
        toast(e instanceof Error ? e.message : String(e), 'error');
      });
    return () => {
      alive = false;
    };
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;

  const handleNext = useCallback(async () => {
    if (categoryId === null) {
      toast('Primero crea una categoría de gastos', 'error');
      return;
    }
    if (!(amount > 0)) {
      setAmountError('Ingresa un monto mayor a 0');
      return;
    }
    setSaving(true);
    try {
      await api.setBudget({
        categoryId,
        accountId,
        amount,
        fromMonth: currentMonth(),
      });
      goNext();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  }, [categoryId, accountId, amount, goNext]);

  useEffect(() => {
    setFooter({
      kind: 'primary',
      action: { label: 'Siguiente', loading: saving, onPress: () => void handleNext() },
    });
  }, [setFooter, handleNext, saving]);

  return (
    <>
      <StepHead icon={ChartPie} title="Asigna un fondo mensual">
        <p>
          El presupuesto reserva un monto por mes para una categoría de gastos. Se mantiene cada
          mes hasta que lo cambies.
        </p>
      </StepHead>
      <SelectField<number>
        label="Categoría"
        value={categoryId}
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        onChange={setCategoryId}
      />
      <MoneyField
        label="Monto mensual"
        value={amount}
        onChange={(n) => {
          setAmount(n);
          setAmountError(null);
        }}
        error={amountError ?? undefined}
      />
      <SelectField<number>
        label="Cuenta del fondo"
        value={accountId}
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        onChange={setAccountId}
      />
      {selectedCategory !== null && amount > 0 ? (
        <p className="ob-live">
          Cada mes tendrás {formatMoney(amount)} para {selectedCategory.name}.
        </p>
      ) : null}
    </>
  );
}
