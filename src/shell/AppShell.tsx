import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import { navigate, useRoute } from '../lib/router';
import { useSession } from '../lib/session';
import { StartTourProvider, Tour, TourPrompt } from '../onboarding/Tour';
import { HomeScreen } from '../screens/home/HomeScreen';
import { IncomesScreen } from '../screens/incomes/IncomesScreen';
import { ExpensesScreen } from '../screens/expenses/ExpensesScreen';
import { BudgetScreen } from '../screens/budget/BudgetScreen';
import { AccountsScreen } from '../screens/accounts/AccountsScreen';
import { toast } from '../ui';
import { BottomNav } from './BottomNav';

export function AppShell(): ReactNode {
  const route = useRoute();
  const { user, setUser } = useSession();
  const [touring, setTouring] = useState(false);
  const [answering, setAnswering] = useState(false);
  const startTour = useCallback(() => setTouring(true), []);
  const tab = route.segments[0] ?? 'home';

  async function answerPrompt(start: boolean): Promise<void> {
    setAnswering(true);
    try {
      setUser(await api.setOnboardingDone({ done: true }));
      setTouring(start);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setAnswering(false);
    }
  }

  if (tab !== 'home' && tab !== 'ingresos' && tab !== 'gastos' && tab !== 'presupuesto' && tab !== 'cuentas') {
    navigate('/home', { replace: true });
    return null;
  }

  return (
    <StartTourProvider value={startTour}>
      <div className="app-shell">
        <main className="app-shell__main">
          {tab === 'home' ? <HomeScreen /> : null}
          {tab === 'ingresos' ? <IncomesScreen /> : null}
          {tab === 'gastos' ? <ExpensesScreen /> : null}
          {tab === 'presupuesto' ? <BudgetScreen /> : null}
          {tab === 'cuentas' ? <AccountsScreen /> : null}
        </main>
        <BottomNav />
      </div>
      {!user.onboardingDone ? (
        <TourPrompt busy={answering} onAnswer={(start) => void answerPrompt(start)} />
      ) : null}
      {touring ? (
        <Tour
          onClose={() => {
            setTouring(false);
            navigate('/home', { replace: true });
          }}
        />
      ) : null}
    </StartTourProvider>
  );
}
