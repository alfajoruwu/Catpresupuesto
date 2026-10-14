import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api/client';
import { ToastHost, toast } from './ui';
import { invalidate } from './lib/data';
import { SessionProvider } from './lib/session';
import { navigate } from './lib/router';
import { todayISO } from './lib/dates';
import type { User } from './api/types';
import { AuthScreen } from './auth/AuthScreen';
import { AppShell } from './shell/AppShell';

export function App(): ReactNode {
  const [status, setStatus] = useState<
    | { state: 'loading' }
    | { state: 'ready'; user: User | null; hasUsers: boolean }
  >({ state: 'loading' });

  useEffect(() => {
    api
      .authStatus()
      .then((s) => setStatus({ state: 'ready', user: s.user, hasUsers: s.hasUsers }))
      .catch(() => setStatus({ state: 'ready', user: null, hasUsers: false }));
  }, []);

  useEffect(() => {
    if (status.state === 'ready' && status.user !== null) {
      api
        .postDueRecurring({ today: todayISO() })
        .then((created) => {
          if (created > 0) invalidate();
        })
        .catch((e: unknown) => {
          toast(e instanceof Error ? e.message : String(e), 'error');
        });
    }
  }, [status]);

  if (status.state === 'loading') return null;

  async function handleLogout(): Promise<void> {
    await api.logout();
    setStatus({ state: 'ready', user: null, hasUsers: true });
    navigate('/home', { replace: true });
  }

  return (
    <div>
      {status.user === null ? (
        <AuthScreen
          hasUsers={status.hasUsers}
          onAuthenticated={(user: User) =>
            setStatus((prev) =>
              prev.state === 'ready' ? { ...prev, user, hasUsers: true } : prev,
            )
          }
        />
      ) : (
        <SessionProvider
          user={status.user}
          setUser={(u: User) =>
            setStatus((prev) => (prev.state === 'ready' ? { ...prev, user: u } : prev))
          }
          logout={handleLogout}
        >
          <AppShell />
        </SessionProvider>
      )}
      <ToastHost />
    </div>
  );
}
