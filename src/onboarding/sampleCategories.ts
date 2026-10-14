import { CATEGORY_COLORS } from '../lib/categoryPalette';

export interface SampleCategory {
  name: string;
  color: string;
  preselected: boolean;
}

function build(names: string[], preselected: string[]): SampleCategory[] {
  return names.map((name, i) => ({
    name,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    preselected: preselected.includes(name),
  }));
}

export const EXPENSE_SUGGESTIONS: SampleCategory[] = build(
  [
    'Alimentación',
    'Deporte',
    'Compras',
    'Transporte',
    'Vivienda',
    'Salud',
    'Servicios básicos',
    'Entretención',
    'Educación',
  ],
  ['Alimentación', 'Deporte', 'Compras', 'Transporte', 'Vivienda'],
);

export const INCOME_SUGGESTIONS: SampleCategory[] = build(
  ['Sueldo', 'Bonos', 'Ventas', 'Otros ingresos'],
  ['Sueldo', 'Otros ingresos'],
);
