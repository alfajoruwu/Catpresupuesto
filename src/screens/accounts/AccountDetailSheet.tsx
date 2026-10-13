import { useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeftRight, Pencil, Scale } from 'lucide-react';
import { api } from '../../api/client';
import type { Account, Entry } from '../../api/types';
import { invalidate, useQuery } from '../../lib/data';
import { shortDate } from '../../lib/dates';
import { Amount, Button, ConfirmDialog, ListRow, Sheet, toast } from '../../ui';
import { ACCOUNT_KIND_LABELS } from './accountKinds';
import { AccountFormSheet } from './AccountFormSheet';
import { AdjustSheet } from './AdjustSheet';
import { TransferSheet } from './TransferSheet';
import './accounts.css';

function entryTitle(entry: Entry): string {
  if (entry.description !== '') return entry.description;
  if (entry.categoryName !== null && entry.categoryName !== '') return entry.categoryName;
  switch (entry.kind) {
    case 'opening':
      return 'Saldo inicial';
    case 'transfer':
      return 'Transferencia';
    case 'adjustment':
      return 'Ajuste de saldo';
    default:
      return 'Movimiento';
  }
}

export function AccountDetailSheet(props: {
  open: boolean;
  account: Account | null;
  onClose(): void;
}): ReactNode {
  const [transferOpen, setTransferOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const accountId = props.account?.id ?? null;

  const accountsQuery = useQuery(() => api.listAccounts({ includeArchived: false }), []);
  const entriesQuery = useQuery(
    () =>
      accountId === null
        ? Promise.resolve<Entry[]>([])
        : api.listEntries({ month: null, kind: null, categoryId: null, accountId, limit: 50 }),
    [accountId],
  );

  if (!props.open || props.account === null) return null;

  const initial = props.account;
  const current = accountsQuery.data?.find((a) => a.id === initial.id) ?? initial;
  const entries = entriesQuery.data ?? [];

  async function handleArchive(): Promise<void> {
    try {
      await api.archiveAccount({ id: current.id });
      invalidate();
      toast('Guardado', 'ok');
      setConfirmingArchive(false);
      props.onClose();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  return (
    <>
      <Sheet open={props.open} title={current.name} onClose={props.onClose}>
        <div className="ac-sheet-body">
          <div>
            <Amount value={current.balance} size="xl" />
            <p className="ac-muted">{ACCOUNT_KIND_LABELS[current.kind]}</p>
          </div>
          <div className="ac-actions">
            <Button variant="secondary" onClick={() => setTransferOpen(true)}>
              <ArrowLeftRight size={20} strokeWidth={1.75} />
              Transferir
            </Button>
            <Button variant="secondary" onClick={() => setAdjustOpen(true)}>
              <Scale size={20} strokeWidth={1.75} />
              Ajustar saldo
            </Button>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={20} strokeWidth={1.75} />
              Editar
            </Button>
          </div>
          <div className="ac-section-title">Movimientos</div>
          {entriesQuery.error !== null ? (
            <p className="ac-error">{entriesQuery.error}</p>
          ) : entries.length > 0 ? (
            <div className="ac-list">
              {entries.map((entry) => {
                const signed = entry.lines.reduce(
                  (sum, line) =>
                    line.ledgerAccountId === current.id ? sum + line.debit - line.credit : sum,
                  0,
                );
                return (
                  <ListRow
                    key={entry.id}
                    title={entryTitle(entry)}
                    subtitle={shortDate(entry.date)}
                    value={
                      <Amount
                        value={signed}
                        tone={signed > 0 ? 'income' : signed < 0 ? 'expense' : 'neutral'}
                      />
                    }
                  />
                );
              })}
            </div>
          ) : (
            <p className="ac-muted">Sin movimientos.</p>
          )}
          <div className="ac-archive-wrap">
            <Button
              variant="ghost"
              block
              className="ac-archive"
              onClick={() => setConfirmingArchive(true)}
            >
              Archivar cuenta
            </Button>
          </div>
        </div>
      </Sheet>
      <TransferSheet open={transferOpen} from={current} onClose={() => setTransferOpen(false)} />
      <AdjustSheet open={adjustOpen} account={current} onClose={() => setAdjustOpen(false)} />
      <AccountFormSheet open={editOpen} account={current} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={confirmingArchive}
        title="Archivar cuenta"
        message="Se oculta para nuevos movimientos. El historial se conserva."
        confirmLabel="Archivar"
        danger
        onConfirm={handleArchive}
        onCancel={() => setConfirmingArchive(false)}
      />
    </>
  );
}
