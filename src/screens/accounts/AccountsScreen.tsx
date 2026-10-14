import { useState } from 'react';
import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api/client';
import type { Account } from '../../api/types';
import { useQuery } from '../../lib/data';
import { Amount, Button, Card, EmptyState, ListRow, ScreenHeader } from '../../ui';
import { ACCOUNT_KIND_LABELS } from './accountKinds';
import { AccountDetailSheet } from './AccountDetailSheet';
import { AccountFormSheet } from './AccountFormSheet';
import './accounts.css';

export function AccountsScreen(): ReactNode {
  const accountsQuery = useQuery(() => api.listAccounts({ includeArchived: false }), []);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Account | null>(null);

  const accounts = accountsQuery.data ?? [];
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="ac-screen">
      <ScreenHeader
        title="Cuentas"
        actions={
          <Button onClick={() => setFormOpen(true)} data-tour="accounts-new">
            <Plus size={20} strokeWidth={1.75} />
            Nueva
          </Button>
        }
      />
      <div className="ac-body">
        {accountsQuery.error !== null ? (
          <p className="ac-error">{accountsQuery.error}</p>
        ) : accountsQuery.data === undefined && accountsQuery.loading ? (
          <p className="ac-muted">Cargando…</p>
        ) : accounts.length > 0 ? (
          <>
            <Card>
              <div className="ac-total-label">Saldo total</div>
              <Amount value={total} size="xl" />
            </Card>
            <div className="ac-list">
              {accounts.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.name}
                  subtitle={ACCOUNT_KIND_LABELS[a.kind]}
                  value={<Amount value={a.balance} />}
                  onClick={() => setSelected(a)}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="Sin cuentas"
            text="Agrega dónde tienes tu dinero: cuenta corriente, vista, ahorro, depósito a plazo o efectivo."
          />
        )}
      </div>
      <AccountFormSheet open={formOpen} onClose={() => setFormOpen(false)} />
      <AccountDetailSheet
        open={selected !== null}
        account={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
