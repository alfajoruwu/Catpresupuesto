import { useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, Tags } from 'lucide-react';
import { api } from '../../api/client';
import type { BudgetLine } from '../../api/types';
import { useQuery } from '../../lib/data';
import { currentMonth, daysInMonth, monthLabel, todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import {
  Amount,
  Button,
  Card,
  CategoryDot,
  EmptyState,
  ListRow,
  MonthSwitcher,
  ProgressBar,
  ScreenHeader,
} from '../../ui';
import { BudgetSheet } from './BudgetSheet';
import { CategoriesSheet } from './CategoriesSheet';
import './budget.css';

function barTone(spent: number, amount: number): 'default' | 'warning' | 'danger' {
  if (amount <= 0) return spent > 0 ? 'danger' : 'default';
  if (spent > amount) return 'danger';
  if (spent >= amount * 0.8) return 'warning';
  return 'default';
}

export function BudgetScreen(): ReactNode {
  const [month, setMonth] = useState(currentMonth());
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetLine | null>(null);
  const budgetQuery = useQuery(() => api.listBudget({ month }), [month]);

  const budget = budgetQuery.data;
  const isCurrent = month === currentMonth();
  const days = daysInMonth(month);
  const todayDay = Number(todayISO().slice(8, 10));
  const available = (budget?.totalBudget ?? 0) - (budget?.totalSpent ?? 0);

  function closeSheet(): void {
    setCreateOpen(false);
    setEditing(null);
  }

  return (
    <div className="bd-screen">
      <ScreenHeader
        title="Presupuesto"
        actions={
          <Button variant="ghost" onClick={() => setCategoriesOpen(true)}>
            <Tags size={20} strokeWidth={1.75} />
            Categorías
          </Button>
        }
      />
      <MonthSwitcher month={month} onChange={setMonth} />
      <div className="bd-body">
        {budgetQuery.error !== null ? <p className="bd-error">{budgetQuery.error}</p> : null}
        {budget === undefined && budgetQuery.loading ? (
          <p className="bd-muted">Cargando…</p>
        ) : budget !== undefined && budget.lines.length > 0 ? (
          <>
            <Card>
              <div className="bd-summary">
                <div>
                  <div className="bd-summary__label">Asignado</div>
                  <Amount value={budget.totalBudget} />
                </div>
                <div>
                  <div className="bd-summary__label">Gastado</div>
                  <Amount value={budget.totalSpent} />
                </div>
                <div>
                  <div className="bd-summary__label">Disponible</div>
                  <Amount value={available} tone={available < 0 ? 'expense' : 'neutral'} />
                </div>
              </div>
              <ProgressBar
                value={budget.totalSpent}
                max={budget.totalBudget}
                tone={barTone(budget.totalSpent, budget.totalBudget)}
                marker={isCurrent ? todayDay / days : undefined}
              />
              {isCurrent ? (
                <div className="bd-today-note">
                  Línea vertical: hoy, día {todayDay} de {days}
                </div>
              ) : null}
            </Card>
            {budget.unbudgetedSpent > 0 ? (
              <div className="bd-list">
                <ListRow
                  title="Gastos sin presupuesto"
                  value={<Amount value={budget.unbudgetedSpent} tone="expense" />}
                />
              </div>
            ) : null}
            {budget.lines.map((line) => (
              <Card key={line.categoryId}>
                <button type="button" className="bd-line" onClick={() => setEditing(line)}>
                  <span className="bd-line__head">
                    <span className="bd-line__title">
                      <CategoryDot color={line.color} />
                      {line.categoryName}
                    </span>
                    <span className="bd-line__amounts">
                      {formatMoney(line.spent)} de {formatMoney(line.amount)}
                    </span>
                  </span>
                  <ProgressBar
                    value={line.spent}
                    max={line.amount}
                    tone={barTone(line.spent, line.amount)}
                  />
                  <span
                    className={`bd-line__status${line.remaining < 0 ? ' bd-line__status--over' : ''}`}
                  >
                    {line.remaining >= 0
                      ? `Quedan ${formatMoney(line.remaining)}`
                      : `Excedido por ${formatMoney(-line.remaining)}`}
                  </span>
                  {line.accountName !== null ? (
                    <span className="bd-line__fund">Fondo en: {line.accountName}</span>
                  ) : null}
                </button>
              </Card>
            ))}
            <Button block onClick={() => setCreateOpen(true)}>
              <Plus size={20} strokeWidth={1.75} />
              Asignar fondo
            </Button>
          </>
        ) : budget !== undefined ? (
          <EmptyState
            title={`Sin presupuesto en ${monthLabel(month)}`}
            text="Asigna un monto mensual a cada categoría de gasto."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus size={20} strokeWidth={1.75} />
                Asignar fondo
              </Button>
            }
          />
        ) : null}
      </div>
      <BudgetSheet
        open={createOpen || editing !== null}
        month={month}
        line={editing ?? undefined}
        onClose={closeSheet}
        onOpenCategories={() => {
          closeSheet();
          setCategoriesOpen(true);
        }}
      />
      <CategoriesSheet open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
    </div>
  );
}
