import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api/client';
import type { Entry } from '../../api/types';
import { useQuery } from '../../lib/data';
import { currentMonth, monthLabel, shortDate, todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import {
  Amount,
  Button,
  Card,
  CategoryDot,
  EmptyState,
  ListRow,
  MonthSwitcher,
  ScreenHeader,
  Segmented,
} from '../../ui';
import { EntrySheet } from './EntrySheet';
import { RecurringSheet } from './RecurringSheet';
import { frequencyLabel } from './recurrence';
import './movements.css';

type Tab = 'movements' | 'recurring';

interface Group {
  date: string;
  items: Entry[];
}

function entrySubtitle(e: Entry): string {
  let s = [e.categoryName, e.accountName].filter((x) => x !== null && x !== '').join(' · ');
  if (e.recurringId !== null) s += ' · Fijo';
  if (e.isBonus) s += ' · Bonificación';
  return s;
}

function recurringSubtitle(
  intervalMonths: number,
  dayOfMonth: number,
  accountName: string,
  nextDate: string,
  kind: 'income' | 'expense',
  bonusEveryMonths: number | null,
  bonusPercent: number | null,
): string {
  const lines = [`${frequencyLabel(intervalMonths, dayOfMonth)} · ${accountName}`];
  if (nextDate !== '') {
    const [y, m, d] = nextDate.split('-');
    const pretty = y !== undefined && m !== undefined && d !== undefined ? shortDate(nextDate) : nextDate;
    lines.push(`Próximo: ${pretty}`);
  }
  if (kind === 'income' && bonusEveryMonths !== null && bonusPercent !== null) {
    lines.push(`Bono ${bonusPercent}% cada ${bonusEveryMonths} meses`);
  }
  return lines.join('\n');
}

export function MovementsScreen(props: { kind: 'income' | 'expense'; extraActions?: ReactNode }): ReactNode {
  const { kind, extraActions } = props;
  const isIncome = kind === 'income';
  const title = isIncome ? 'Ingresos' : 'Gastos';
  const tone = isIncome ? 'income' : 'expense';

  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState<Tab>('movements');
  const [entryOpen, setEntryOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | undefined>(undefined);
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);

  const today = todayISO();
  const summary = useQuery(() => api.monthSummary({ month, today }), [month, today]);
  const entries = useQuery(
    () => api.listEntries({ month, kind, categoryId: null, accountId: null, limit: null }),
    [month, kind],
  );
  const rules = useQuery(() => api.listRecurring({ kind, today }), [kind, today]);
  const groups: Group[] = useMemo(() => {
    const byDate: Record<string, Entry[]> = {};
    for (const e of entries.data ?? []) {
      const arr = byDate[e.date];
      if (arr) arr.push(e);
      else byDate[e.date] = [e];
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, items]) => ({ date, items }));
  }, [entries.data]);

  const actual = isIncome ? summary.data?.incomeActual : summary.data?.expenseActual;
  const projected = isIncome ? summary.data?.incomeProjected : summary.data?.expenseProjected;
  const pending = (projected ?? 0) - (actual ?? 0);

  function openNew(): void {
    if (tab === 'movements') {
      setSelectedEntry(undefined);
      setEntryOpen(true);
    } else {
      setSelectedRuleId(null);
      setRecurringOpen(true);
    }
  }

  const selectedRule =
    selectedRuleId !== null ? rules.data?.find((r) => r.id === selectedRuleId) : undefined;

  return (
    <div className="mv-screen">
      <ScreenHeader
        title={title}
        actions={
          <span className="mv-header-actions">
            {extraActions}
            <Button onClick={openNew} data-tour="mv-new">
              <Plus size={20} strokeWidth={1.75} />
              Nuevo
            </Button>
          </span>
        }
      />
      <MonthSwitcher month={month} onChange={setMonth} />
      <div className="mv-section">
        <Card>
          <div className="mv-summary__label">Total del mes</div>
          <div className="mv-summary__total">
            <Amount value={actual ?? 0} tone={tone} size="lg" />
          </div>
          {pending > 0 ? (
            <div className="mv-pending">
              <span>{isIncome ? 'Por recibir este mes' : 'Por pagar este mes'}</span>
              <span>{formatMoney(pending)}</span>
            </div>
          ) : null}
        </Card>
      </div>
      <div className="mv-section" data-tour="mv-tabs">
        <Segmented<Tab>
          value={tab}
          options={[
            { value: 'movements', label: 'Movimientos' },
            { value: 'recurring', label: 'Fijos' },
          ]}
          onChange={setTab}
        />
      </div>
      {tab === 'movements' ? (
        entries.error !== null ? (
          <div className="mv-retry">
            <div className="mv-error">{entries.error}</div>
            <Button variant="ghost" block onClick={entries.reload}>
              Reintentar
            </Button>
          </div>
        ) : entries.data === undefined && entries.loading ? (
          <div className="mv-loading">Cargando…</div>
        ) : groups.length === 0 ? (
          <EmptyState title={`Sin ${isIncome ? 'ingresos' : 'gastos'} en ${monthLabel(month)}`} />
        ) : (
          groups.map((g) => (
            <div key={g.date}>
              <div className="mv-day">{shortDate(g.date)}</div>
              <div className="mv-list">
                {g.items.map((e) => (
                  <ListRow
                    key={e.id}
                    leading={<CategoryDot color={e.categoryColor ?? '#5B6470'} />}
                    title={e.description !== '' ? e.description : (e.categoryName ?? '')}
                    subtitle={entrySubtitle(e)}
                    value={<Amount value={e.amount} tone={tone} />}
                    onClick={() => {
                      setSelectedEntry(e);
                      setEntryOpen(true);
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        )
      ) : rules.error !== null ? (
        <div className="mv-retry">
          <div className="mv-error">{rules.error}</div>
          <Button variant="ghost" block onClick={rules.reload}>
            Reintentar
          </Button>
        </div>
      ) : rules.data === undefined && rules.loading ? (
        <div className="mv-loading">Cargando…</div>
      ) : (rules.data ?? []).length === 0 ? (
        <EmptyState
          title={isIncome ? 'Sin ingresos fijos' : 'Sin gastos fijos'}
          text="Sueldo, arriendo, suscripciones: se registran solos cada período."
        />
      ) : (
        <div className="mv-list mv-recurring">
          {(rules.data ?? []).map((r) => (
            <ListRow
              key={r.id}
              title={r.name}
              subtitle={recurringSubtitle(r.intervalMonths, r.dayOfMonth, r.accountName, r.nextDate, kind, r.bonusEveryMonths, r.bonusPercent)}
              value={<Amount value={r.amount} tone={tone} />}
              onClick={() => {
                setSelectedRuleId(r.id);
                setRecurringOpen(true);
              }}
            />
          ))}
        </div>
      )}
      <EntrySheet open={entryOpen} kind={kind} entry={selectedEntry} onClose={() => setEntryOpen(false)} />
      <RecurringSheet
        open={recurringOpen}
        kind={kind}
        rule={selectedRule}
        onClose={() => setRecurringOpen(false)}
      />
    </div>
  );
}
