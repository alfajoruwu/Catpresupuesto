import type { ReactNode } from 'react';
import { ArrowDownToLine, ChartPie, House, Receipt, Wallet } from 'lucide-react';
import { navigate, useRoute } from '../lib/router';

const TABS = [
  { path: '/ingresos', label: 'Ingresos', Icon: ArrowDownToLine },
  { path: '/gastos', label: 'Gastos', Icon: Receipt },
  { path: '/home', label: 'Home', Icon: House },
  { path: '/presupuesto', label: 'Presupuesto', Icon: ChartPie },
  { path: '/cuentas', label: 'Cuentas', Icon: Wallet },
] as const;

export function BottomNav(): ReactNode {
  const route = useRoute();
  const active = route.segments[0] ?? 'home';
  return (
    <nav className="app-bottom-nav">
      {TABS.map(({ path, label, Icon }) => {
        const key = path.slice(1);
        const isActive = active === key;
        return (
          <button
            key={path}
            type="button"
            className={`app-bottom-nav__btn${isActive ? ' is-active' : ''}`}
            onClick={() => navigate(path, { replace: true })}
          >
            <Icon size={24} strokeWidth={1.75} />
            <span className="app-bottom-nav__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
