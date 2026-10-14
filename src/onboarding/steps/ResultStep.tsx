import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { Button, Card, ConfirmDialog, ProgressBar, toast } from '../../ui';
import { api } from '../../api/client';
import type { Account, BudgetMonth, Entry, MonthSummary } from '../../api/types';
import { currentMonth, shortDate, todayISO } from '../../lib/dates';
import { formatMoney, formatPercent } from '../../lib/format';
import { StepHead } from './StepHead';
import type { StepProps } from './types';

interface ResultData {
  summary: MonthSummary;
  budget: BudgetMonth;
  accounts: Account[];
  entries: Entry[];
}

export function ResultStep(props: StepProps): ReactNode {
  const { setFooter, finish } = props;
  const [data, setData] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [finishingLocal, setFinishingLocal] = useState(false);

  useEffect(() => {
    let alive = true;
    const month = currentMonth();
    const today = todayISO();
    Promise.all([
      api.monthSummary({ month, today }),
      api.listBudget({ month }),
      api.listAccounts({ includeArchived: false }),
      api.listEntries({ month, kind: null, categoryId: null, accountId: null, limit: 20 }),
    ])
      .then(([summary, budget, accounts, entries]) => {
        if (alive) setData({ summary, budget, accounts, entries });
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        if (alive) setError(message);
        toast(message, 'error');
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setFooter({
      kind: 'custom',
      node: (
        <div className="ob-footer-stack">
          <Button block loading={finishingLocal} onClick={() => void finish(false)}>
            Conservar datos y empezar
          </Button>
          <Button variant="secondary" block onClick={() => setConfirming(true)}>
            Borrar datos de prueba y empezar
          </Button>
        </div>
      ),
    });
  }, [setFooter, finish, finishingLocal]);

  async function handleReset(): Promise<void> {
    setFinishingLocal(true);
    try {
      await finish(true);
    } finally {
      setConfirming(false);
      setFinishingLocal(false);
    }
  }

  return (
    <>
      <StepHead icon={LayoutDashboard} title="Así se ve tu información">
        <p>Esto es lo que creaste en el recorrido, con los datos de este mes.</p>
      </StepHead>
      {error !== null ? (
        <p className="ob-error" role="alert">
          {error}
        </p>
      ) : null}
      {data === null ? (
        <p className="ob-muted">Cargando resumen…</p>
      ) : (
        <>
          <Card>
            <h3 className="ob-card-title">Este mes</h3>
            <dl className="ob-kv">
              <div className="ob-kv__row">
                <dt>Ingresos</dt>
                <dd className="ob-nums ob-kv__income">{formatMoney(data.summary.incomeActual)}</dd>
              </div>
              <div className="ob-kv__row">
                <dt>Gastos</dt>
                <dd className="ob-nums ob-kv__expense">
                  {formatMoney(data.summary.expenseActual)}
                </dd>
              </div>
              <div className="ob-kv__row">
                <dt>Disponible</dt>
                <dd className="ob-nums">
                  {formatMoney(data.summary.incomeActual - data.summary.expenseActual)}
                </dd>
              </div>
            </dl>
            <p className="ob-muted">
              Gastaste el{' '}
              {data.summary.incomeActual > 0
                ? formatPercent(
                    (data.summary.expenseActual / data.summary.incomeActual) * 100,
                  )
                : formatPercent(0)}{' '}
              de tus ingresos.
            </p>
            <ProgressBar
              value={data.summary.expenseActual}
              max={Math.max(data.summary.incomeActual, 1)}
            />
          </Card>
          <Card>
            <h3 className="ob-card-title">Presupuesto</h3>
            {data.budget.lines.length === 0 ? (
              <p className="ob-muted">Sin presupuesto asignado.</p>
            ) : (
              <ul className="ob-plain-list">
                {data.budget.lines.map((l) => (
                  <li key={l.categoryId} className="ob-budget-line">
                    <div className="ob-budget-line__head">
                      <span>{l.categoryName}</span>
                      <span className="ob-nums">
                        {formatMoney(l.spent)} de {formatMoney(l.amount)}
                      </span>
                    </div>
                    <ProgressBar value={l.spent} max={Math.max(l.amount, 1)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h3 className="ob-card-title">Cuentas</h3>
            {data.accounts.length === 0 ? (
              <p className="ob-muted">Sin cuentas.</p>
            ) : (
              <ul className="ob-plain-list">
                {data.accounts.map((a) => (
                  <li key={a.id} className="ob-kv__row">
                    <span>{a.name}</span>
                    <span className="ob-nums">{formatMoney(a.balance)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h3 className="ob-card-title">Asientos registrados</h3>
            <p className="ob-muted">
              Cada movimiento queda como un asiento: el Debe y el Haber siempre suman lo mismo.
            </p>
            {data.entries.length === 0 ? (
              <p className="ob-muted">Sin movimientos este mes.</p>
            ) : (
              <ul className="ob-plain-list">
                {data.entries.map((e) => (
                  <li key={e.id} className="ob-entry">
                    <div className="ob-entry__head">
                      <span>
                        {shortDate(e.date)} · {e.description}
                      </span>
                    </div>
                    <table className="ob-table">
                      <thead>
                        <tr>
                          <th scope="col">Cuenta</th>
                          <th scope="col">Debe</th>
                          <th scope="col">Haber</th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.lines.map((l, i) => (
                          <tr key={i}>
                            <td>{l.ledgerAccountName}</td>
                            <td className="ob-nums">
                              {l.debit > 0 ? formatMoney(l.debit) : '—'}
                            </td>
                            <td className="ob-nums">
                              {l.credit > 0 ? formatMoney(l.credit) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      <ConfirmDialog
        open={confirming}
        title="Borrar datos de prueba"
        message="Se borrarán las categorías, cuentas, presupuestos y movimientos creados. Tu usuario se mantiene."
        confirmLabel="Borrar y empezar"
        danger
        onConfirm={() => void handleReset()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
