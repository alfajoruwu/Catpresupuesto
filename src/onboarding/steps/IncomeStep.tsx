import type { ReactNode } from 'react';
import { MovementStep } from './MovementStep';
import type { StepProps } from './types';

export function IncomeStep(props: StepProps): ReactNode {
  return <MovementStep {...props} movementKind="income" />;
}
