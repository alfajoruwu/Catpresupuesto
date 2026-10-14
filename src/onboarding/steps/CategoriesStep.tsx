import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, Tags } from 'lucide-react';
import { Button, CategoryDot, TextField, toast } from '../../ui';
import { ApiError, api } from '../../api/client';
import type { CategoryKind } from '../../api/types';
import { CATEGORY_COLORS } from '../../lib/categoryPalette';
import { EXPENSE_SUGGESTIONS, INCOME_SUGGESTIONS } from '../sampleCategories';
import type { SampleCategory } from '../sampleCategories';
import { StepHead } from './StepHead';
import type { StepProps } from './types';

interface Chip extends SampleCategory {
  selected: boolean;
}

function initChips(list: SampleCategory[]): Chip[] {
  return list.map((s) => ({ ...s, selected: s.preselected }));
}

function ChipGroup(props: {
  title: string;
  chips: Chip[];
  onToggle(name: string): void;
  onAdd(name: string): void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(): void {
    const name = draft.trim();
    if (name === '') {
      setError('Escribe un nombre');
      return;
    }
    if (props.chips.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setError('Ese nombre ya está en la lista');
      return;
    }
    props.onAdd(name);
    setDraft('');
    setOpen(false);
    setError(null);
  }

  return (
    <section className="ob-group">
      <h3 className="ob-group__title">{props.title}</h3>
      <div className="ob-chips">
        {props.chips.map((c) => (
          <button
            key={c.name}
            type="button"
            className={`ob-chip${c.selected ? ' is-selected' : ''}`}
            aria-pressed={c.selected}
            onClick={() => props.onToggle(c.name)}
          >
            <CategoryDot color={c.color} size={12} />
            <span>{c.name}</span>
          </button>
        ))}
        <button
          type="button"
          className="ob-chip ob-chip--add"
          onClick={() => {
            setOpen((v) => !v);
            setError(null);
          }}
        >
          <Plus size={16} />
          <span>Agregar</span>
        </button>
      </div>
      {open ? (
        <div className="ob-add">
          <TextField
            label="Nueva categoría"
            value={draft}
            onChange={(v) => {
              setDraft(v);
              setError(null);
            }}
            error={error ?? undefined}
          />
          <Button variant="secondary" onClick={submit}>
            Añadir
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function CategoriesStep(props: StepProps): ReactNode {
  const { goNext, setFooter } = props;
  const [expense, setExpense] = useState<Chip[]>(() => initChips(EXPENSE_SUGGESTIONS));
  const [income, setIncome] = useState<Chip[]>(() => initChips(INCOME_SUGGESTIONS));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const expenseCount = expense.filter((c) => c.selected).length;
  const incomeCount = income.filter((c) => c.selected).length;
  const valid = expenseCount > 0 && incomeCount > 0;

  useEffect(() => {
    let alive = true;
    api
      .listCategories({ kind: null, includeArchived: true })
      .then((cats) => {
        if (!alive) return;
        const names = new Set(cats.map((c) => c.name));
        setExpense((prev) =>
          prev.map((c) => (names.has(c.name) ? { ...c, selected: true } : c)),
        );
        setIncome((prev) =>
          prev.map((c) => (names.has(c.name) ? { ...c, selected: true } : c)),
        );
      })
      .catch((e: unknown) => {
        toast(e instanceof Error ? e.message : String(e), 'error');
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback(
    (kind: CategoryKind, name: string) => {
      const apply = (prev: Chip[]): Chip[] =>
        prev.map((c) => (c.name === name ? { ...c, selected: !c.selected } : c));
      if (kind === 'expense') setExpense(apply);
      else setIncome(apply);
      setAttempted(false);
    },
    [],
  );

  const add = useCallback((kind: CategoryKind, name: string) => {
    const apply = (prev: Chip[]): Chip[] => [
      ...prev,
      {
        name,
        color: CATEGORY_COLORS[prev.length % CATEGORY_COLORS.length],
        preselected: false,
        selected: true,
      },
    ];
    if (kind === 'expense') setExpense(apply);
    else setIncome(apply);
    setAttempted(false);
  }, []);

  const handleNext = useCallback(async () => {
    if (!valid) {
      setAttempted(true);
      return;
    }
    setSaving(true);
    try {
      const existing = new Set(
        (await api.listCategories({ kind: null, includeArchived: true })).map((c) => c.name),
      );
      const groups: { kind: CategoryKind; chips: Chip[] }[] = [
        { kind: 'expense', chips: expense },
        { kind: 'income', chips: income },
      ];
      for (const g of groups) {
        for (const c of g.chips) {
          if (!c.selected || existing.has(c.name)) continue;
          try {
            await api.createCategory({ name: c.name, kind: g.kind, color: c.color });
            existing.add(c.name);
          } catch (e: unknown) {
            if (e instanceof ApiError && e.message.includes('Ya existe')) continue;
            throw e;
          }
        }
      }
      goNext();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  }, [expense, income, valid, goNext]);

  useEffect(() => {
    setFooter({
      kind: 'primary',
      action: { label: 'Siguiente', loading: saving, onPress: () => void handleNext() },
    });
  }, [setFooter, handleNext, saving]);

  return (
    <>
      <StepHead icon={Tags} title="Crea tus categorías">
        <p>
          Las categorías ordenan tus movimientos. Cada una funciona como una cuenta contable:
          unas registran ingresos y otras gastos.
        </p>
      </StepHead>
      <ChipGroup
        title="Para gastos"
        chips={expense}
        onToggle={(n) => toggle('expense', n)}
        onAdd={(n) => add('expense', n)}
      />
      <ChipGroup
        title="Para ingresos"
        chips={income}
        onToggle={(n) => toggle('income', n)}
        onAdd={(n) => add('income', n)}
      />
      {attempted && !valid ? (
        <p className="ob-error" role="alert">
          Elige al menos una categoría de gastos y una de ingresos.
        </p>
      ) : null}
    </>
  );
}
