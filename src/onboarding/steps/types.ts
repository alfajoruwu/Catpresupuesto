import type { ReactNode } from 'react';

export interface PrimaryAction {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onPress(): void;
}

export type FooterContent =
  | { kind: 'primary'; action: PrimaryAction }
  | { kind: 'custom'; node: ReactNode };

export interface StepProps {
  goNext(): void;
  setFooter(f: FooterContent): void;
  finish(reset: boolean): Promise<void>;
  finishing: boolean;
}
