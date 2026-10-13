import type { ReactNode } from 'react';
import { MovementStep } from './MovementStep';
import type { StepProps } from './types';

export function ExpenseStep(props: StepProps): ReactNode {
  return <MovementStep {...props} movementKind="expense" />;
}
