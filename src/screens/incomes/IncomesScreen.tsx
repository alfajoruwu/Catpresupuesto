import type { ReactNode } from 'react';
import { MovementsScreen } from '../movements/MovementsScreen';

export function IncomesScreen(): ReactNode {
  return <MovementsScreen kind="income" />;
}
