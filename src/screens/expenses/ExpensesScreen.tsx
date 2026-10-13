import type { ReactNode } from 'react';
import { MovementsScreen } from '../movements/MovementsScreen';

export function ExpensesScreen(): ReactNode {
  return <MovementsScreen kind="expense" />;
}
