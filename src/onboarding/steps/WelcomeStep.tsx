import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Compass } from 'lucide-react';
import { Button, ConfirmDialog } from '../../ui';
import { StepHead } from './StepHead';
import type { StepProps } from './types';

const STEPS = [
  'Crea tus categorías',
  'Crea una cuenta',
  'Asigna un fondo mensual',
  'Registra tus ingresos',
  'Registra tus gastos',
  'Revisa tu información',
];

export function WelcomeStep(props: StepProps): ReactNode {
  const { goNext, setFooter, finish } = props;
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setFooter({
      kind: 'custom',
      node: (
        <div className="ob-footer-stack">
          <Button block onClick={goNext}>
            Comenzar
          </Button>
          <Button variant="ghost" block onClick={() => setConfirming(true)}>
            Omitir recorrido
          </Button>
        </div>
      ),
    });
  }, [goNext, setFooter]);

  return (
    <>
      <StepHead icon={Compass} title="Bienvenido a Catpresupuesto">
        <p>
          Te mostramos cómo funciona en 6 pasos: categorías, cuenta, presupuesto, ingresos,
          gastos y el resultado.
        </p>
      </StepHead>
      <ol className="ob-list">
        {STEPS.map((s, i) => (
          <li key={s}>
            <span className="ob-list__num" aria-hidden="true">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="app-card ob-card-accent">
        <p className="ob-note-strong">
          Los datos que ingreses en este recorrido son de prueba. Al final eliges si los
          conservas o los borras.
        </p>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Omitir recorrido"
        message="Se terminará el recorrido sin crear datos de prueba."
        confirmLabel="Omitir"
        onConfirm={() => finish(false)}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
