import { createContext, useContext, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { navigate } from '../lib/router';
import { Button } from '../ui';
import { TOUR_STEPS } from './tourSteps';
import './tour.css';

const StartTourContext = createContext<() => void>(() => undefined);

export const StartTourProvider = StartTourContext.Provider;

/** Inicia el recorrido guiado desde cualquier pantalla. */
export function useStartTour(): () => void {
  return useContext(StartTourContext);
}

/** Margen del recuadro resaltado alrededor del elemento. */
const SPOT_PAD = 6;
/** Tiempo máximo esperando a que el elemento aparezca (las pantallas cargan datos). */
const FIND_TIMEOUT_MS = 2000;

/** Primer inicio: pregunta si se quiere hacer el recorrido. */
export function TourPrompt(props: { busy: boolean; onAnswer(start: boolean): void }): ReactNode {
  const { busy, onAnswer } = props;
  return (
    <div className="app-dialog-backdrop">
      <div className="app-dialog" role="alertdialog" aria-label="Recorrido inicial">
        <div className="app-dialog__title">¡Bienvenido a Catpresupuesto!</div>
        <div className="app-dialog__message">
          ¿Quieres hacer el recorrido inicial? En un minuto te mostramos dónde está cada cosa.
        </div>
        <div className="app-dialog__actions">
          <Button variant="ghost" disabled={busy} onClick={() => onAnswer(false)}>
            Ahora no
          </Button>
          <Button disabled={busy} onClick={() => onAnswer(true)}>
            Hacer recorrido
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Recorrido por las pantallas, resaltando un elemento por paso. */
export function Tour(props: { onClose(): void }): ReactNode {
  const { onClose } = props;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  useEffect(() => {
    navigate(step.route, { replace: true });
    setRect(null);
    let target: Element | null = null;
    let frame = 0;
    const started = performance.now();
    const measure = (): void => {
      if (target !== null) setRect(target.getBoundingClientRect());
    };
    const find = (): void => {
      const found = document.querySelector(step.target);
      if (found !== null && found.getBoundingClientRect().height > 0) {
        target = found;
        found.scrollIntoView({ block: 'center' });
        measure();
      } else if (performance.now() - started < FIND_TIMEOUT_MS) {
        frame = requestAnimationFrame(find);
      }
    };
    frame = requestAnimationFrame(find);
    window.addEventListener('resize', measure);
    document.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      document.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  // La tarjeta va debajo del elemento si este está en la mitad superior; si no, encima.
  let cardStyle: CSSProperties | undefined;
  if (rect !== null) {
    const gap = SPOT_PAD + 12;
    cardStyle =
      rect.top + rect.height / 2 < window.innerHeight / 2
        ? { top: rect.bottom + gap }
        : { bottom: window.innerHeight - rect.top + gap };
  }

  return (
    <div className="tour" role="dialog" aria-label={step.title}>
      {rect !== null ? (
        <div
          className="tour__spot"
          style={{
            top: rect.top - SPOT_PAD,
            left: rect.left - SPOT_PAD,
            width: rect.width + SPOT_PAD * 2,
            height: rect.height + SPOT_PAD * 2,
          }}
        />
      ) : (
        <div className="tour__backdrop" />
      )}
      <div className={`tour__card${rect === null ? ' tour__card--center' : ''}`} style={cardStyle}>
        <div className="tour__count">
          {index + 1} de {TOUR_STEPS.length}
        </div>
        <div className="tour__title">{step.title}</div>
        <p className="tour__text">{step.text}</p>
        <div className="tour__actions">
          {!last ? (
            <Button variant="ghost" onClick={onClose}>
              Saltar
            </Button>
          ) : null}
          <span className="tour__spacer" />
          {index > 0 ? (
            <Button variant="secondary" onClick={() => setIndex(index - 1)}>
              Atrás
            </Button>
          ) : null}
          <Button onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? 'Terminar' : 'Siguiente'}
          </Button>
        </div>
      </div>
    </div>
  );
}
