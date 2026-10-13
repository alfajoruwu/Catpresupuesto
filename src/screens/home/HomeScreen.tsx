import { useState } from 'react';
import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, LogOut, TriangleAlert } from 'lucide-react';
import { api } from '../../api/client';
import type { Entry } from '../../api/types';
import { useQuery } from '../../lib/data';
import { currentMonth, shortDate, todayISO } from '../../lib/dates';
import { formatMoney, formatPercent } from '../../lib/format';
import { navigate } from '../../lib/router';
import { useSession } from '../../lib/session';
import {
  Amount,
  Button,
  Card,
  CategoryDot,
  ConfirmDialog,
  IconButton,
  ListRow,
  MonthSwitcher,
  ProgressBar,
  ScreenHeader,
} from '../../ui';
import { computeHomeStats } from './homeStats';
import './home.css';

function entryTitle(e: Entry): string {
  if (e.description !== '') return e.description;
  if (e.categoryName !== null && e.categoryName !== '') return e.categoryName;
  return 'Transferencia';
}

function entrySubtitle(e: Entry): string {
  const date = shortDate(e.date);
  if (e.kind === 'transfer') {
    const from = e.accountName ?? '';
    const to = e.toAccountName ?? '';
    const route = from !== '' && to !== '' ? `${from} → ${to}` : to !== '' ? to : from;
    return route !== '' ? `${date} · ${route}` : date;
  }
  return e.accountName !== null && e.accountName !== '' ? `${date} · ${e.accountName}` : date;
}

function entryValue(e: Entry): ReactNode {
  if (e.kind === 'income') {
    return (
      <span className="hm-signed hm-signed--income">
        +<Amount value={e.amount} tone="income" />
      </span>
    );
  }
  if (e.kind === 'expense') {
    return <Amount value={-e.amount} tone="expense" />;
  }
  return <Amount value={e.amount} tone="neutral" />;
}

export function HomeScreen(): ReactNode {
  const { logout } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  const today = todayISO();

  const summaryQ = useQuery(() => api.monthSummary({ month, today }), [month, today]);
  const budgetQ = useQuery(() => api.listBudget({ month }), [month]);
  const entriesQ = useQuery(
    () => api.listEntries({ month, kind: null, categoryId: null, accountId: null, limit: 5 }),
    [month],
  );

  const header = (
    <ScreenHeader
      title="Resumen"
      actions={
        <IconButton label="Cerrar sesión" onClick={() => setConfirming(true)}>
          <LogOut size={24} />
        </IconButton>
      }
    />
  );

  const summary = summaryQ.data;
  const budget = budgetQ.data;
  const entries = entriesQ.data;
  if (summary === undefined || budget === undefined || entries === undefined) {
    return (
      <div className="hm-screen">
        {header}
        <ConfirmDialog
          open={confirming}
          title="Cerrar sesión"
          message="¿Cerrar la sesión actual?"
          confirmLabel="Cerrar sesión"
          onConfirm={() => logout()}
          onCancel={() => setConfirming(false)}
        />
      </div>
    );
  }

  const stats = computeHomeStats(summary, { month, today });
  const barTone =
    stats.spentOfIncomePct === null
      ? 'default'
      : stats.spentOfIncomePct >= 100
        ? 'danger'
        : stats.spentOfIncomePct >= 80
          ? 'warning'
          : 'default';
  const topCats = [...budget.lines]
    .filter((l) => l.percent >= 80)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3);

  return (
    <div className="hm-screen">
      {header}
      <MonthSwitcher month={month} onChange={setMonth} />

      <Card>
        <h2 className="hm-card-title">Disponible del mes</h2>
        <Amount
          value={stats.available}
          size="xl"
          tone={stats.available < 0 ? 'expense' : 'neutral'}
        />
        <div className="hm-cols">
          <div className="hm-col">
            <span className="hm-label">Ingresos</span>
            <Amount value={summary.incomeActual} tone="income" />
          </div>
          <div className="hm-col">
            <span className="hm-label">Gastos</span>
            <Amount value={summary.expenseActual} tone="expense" />
          </div>
        </div>
        {stats.projectedAvailable !== stats.available ? (
          <div className="hm-muted">
            Proyectado a fin de mes: {formatMoney(stats.projectedAvailable)}
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="hm-card-title">Gastos sobre ingresos</h2>
        <div className="hm-big">
          {stats.spentOfIncomePct === null ? '—' : formatPercent(stats.spentOfIncomePct)}
        </div>
        <ProgressBar value={summary.expenseActual} max={stats.incomeBase} tone={barTone} />
        <div className="hm-muted">
          {stats.incomeLeft >= 0
            ? `Quedan ${formatMoney(stats.incomeLeft)} de tus ingresos`
            : `Gastaste ${formatMoney(-stats.incomeLeft)} más de lo que ingresó`}
        </div>
      </Card>

      <div
        className="hm-tap"
        role="button"
        tabIndex={0}
        onClick={() => navigate('/presupuesto')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') navigate('/presupuesto');
        }}
      >
        <Card>
          <h2 className="hm-card-title">Presupuesto</h2>
          {stats.budgetStatus === 'ok' ? (
            <div className="hm-status">
              <span className="hm-status-icon hm-status-icon--ok">
                <CircleCheck size={20} />
              </span>
              <span>Dentro del presupuesto</span>
            </div>
          ) : null}
          {stats.budgetStatus === 'ahead' ? (
            <div className="hm-status">
              <span className="hm-status-icon hm-status-icon--ahead">
                <TriangleAlert size={20} />
              </span>
              <span>Vas por sobre el ritmo del mes</span>
            </div>
          ) : null}
          {stats.budgetStatus === 'over' ? (
            <div className="hm-status">
              <span className="hm-status-icon hm-status-icon--over">
                <CircleAlert size={20} />
              </span>
              <span>
                Fuera del presupuesto por {formatMoney(budget.totalSpent - budget.totalBudget)}
              </span>
            </div>
          ) : null}
          {stats.budgetStatus === 'none' ? (
            <div className="hm-status hm-status--none">
              <span>Sin presupuesto asignado</span>
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/presupuesto');
                }}
              >
                Asignar
              </Button>
            </div>
          ) : null}
          {stats.budgetStatus !== 'none' ? (
            <>
              <div className="hm-muted">
                Gastado {formatMoney(budget.totalSpent)} de {formatMoney(budget.totalBudget)}
              </div>
              <ProgressBar
                value={budget.totalSpent}
                max={budget.totalBudget}
                marker={stats.dayFraction ?? undefined}
              />
            </>
          ) : null}
          {topCats.map((l) => (
            <div key={l.categoryId}>
              <div className="hm-cat">
                <CategoryDot color={l.color} />
                <span className="hm-cat__name">{l.categoryName}</span>
                <span className="hm-cat__pct">{formatPercent(l.percent)}</span>
              </div>
              <div className="hm-bar-thin">
                <ProgressBar value={l.percent} max={100} />
              </div>
            </div>
          ))}
          {budget.unbudgetedSpent > 0 ? (
            <div className="hm-muted">
              Fuera de presupuesto: {formatMoney(budget.unbudgetedSpent)}
            </div>
          ) : null}
        </Card>
      </div>

      <ListRow
        title="Saldo en cuentas"
        value={<Amount value={summary.totalBalance} />}
        onClick={() => navigate('/cuentas')}
      />

      {entries.length > 0 ? (
        <section>
          <h2 className="hm-section-title">Últimos movimientos</h2>
          <div>
            {entries.map((e) => (
              <ListRow
                key={e.id}
                title={entryTitle(e)}
                subtitle={entrySubtitle(e)}
                value={entryValue(e)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="Cerrar sesión"
        message="¿Cerrar la sesión actual?"
        confirmLabel="Cerrar sesión"
        onConfirm={() => logout()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
