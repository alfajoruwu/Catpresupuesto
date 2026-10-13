import { describe, expect, it } from 'vitest';
import { frequencyLabel } from './recurrence';

describe('frequencyLabel', () => {
  it('mensual el día 5', () => {
    expect(frequencyLabel(1, 5)).toBe('Mensual · día 5');
  });

  it('trimestral el día 1', () => {
    expect(frequencyLabel(3, 1)).toBe('Trimestral · día 1');
  });

  it('semestral el día 15', () => {
    expect(frequencyLabel(6, 15)).toBe('Semestral · día 15');
  });

  it('anual el día 28', () => {
    expect(frequencyLabel(12, 28)).toBe('Anual · día 28');
  });

  it('otro intervalo usa cada N meses', () => {
    expect(frequencyLabel(2, 10)).toBe('Cada 2 meses · día 10');
  });
});
