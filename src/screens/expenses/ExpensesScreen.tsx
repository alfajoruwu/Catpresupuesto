import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScanLine } from 'lucide-react';
import { MovementsScreen } from '../movements/MovementsScreen';
import { Button } from '../../ui';
import { ScanReceiptSheet } from './scan/ScanReceiptSheet';

export function ExpensesScreen(): ReactNode {
  const [scanOpen, setScanOpen] = useState(false);
  return (
    <>
      <MovementsScreen
        kind="expense"
        extraActions={
          <Button variant="secondary" onClick={() => setScanOpen(true)}>
            <ScanLine size={20} strokeWidth={1.75} />
            Escanear
          </Button>
        }
      />
      <ScanReceiptSheet open={scanOpen} onClose={() => setScanOpen(false)} />
    </>
  );
}
