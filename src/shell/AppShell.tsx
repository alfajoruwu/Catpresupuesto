import type { ReactNode } from 'react';
import { navigate, useRoute } from '../lib/router';
import { HomeScreen } from '../screens/home/HomeScreen';
import { IncomesScreen } from '../screens/incomes/IncomesScreen';
import { ExpensesScreen } from '../screens/expenses/ExpensesScreen';
import { BudgetScreen } from '../screens/budget/BudgetScreen';
import { AccountsScreen } from '../screens/accounts/AccountsScreen';
import { BottomNav } from './BottomNav';

export function AppShell(): ReactNode {
  const route = useRoute();
  const tab = route.segments[0] ?? 'home';

  if (tab !== 'home' && tab !== 'ingresos' && tab !== 'gastos' && tab !== 'presupuesto' && tab !== 'cuentas') {
    navigate('/home', { replace: true });
    return null;
  }

  return (
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
  );
}
