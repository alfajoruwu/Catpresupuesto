import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, toast } from '../ui';
import { api } from '../api/client';
import { useSession } from '../lib/session';
import { invalidate } from '../lib/data';
import { navigate } from '../lib/router';
import './onboarding.css';
import { AccountStep, EMPTY_ACCOUNT_DRAFT } from './steps/AccountStep';
import type { AccountDraft } from './steps/AccountStep';
import { BudgetStep } from './steps/BudgetStep';
import { CategoriesStep } from './steps/CategoriesStep';
import { ExpenseStep } from './steps/ExpenseStep';
import { IncomeStep } from './steps/IncomeStep';
import { ResultStep } from './steps/ResultStep';
import { WelcomeStep } from './steps/WelcomeStep';
import type { FooterContent } from './steps/types';

const TOTAL_CONTENT_STEPS = 6;
const LAST_STEP = 7;

function stepKey(userId: number): string {
  return `catpresupuesto.onboarding.step.${userId}`;
}

function readStep(userId: number): number {
  try {
    const raw = localStorage.getItem(stepKey(userId));
    if (raw === null) return 0;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > LAST_STEP) return 0;
    return n;
  } catch {
    return 0;
  }
}

export function Onboarding(): ReactNode {
  const { user, setUser } = useSession();
  const [step, setStep] = useState(() => readStep(user.id));
  const [footer, setFooter] = useState<FooterContent | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [accountDraft, setAccountDraft] = useState<AccountDraft>(EMPTY_ACCOUNT_DRAFT);

  useEffect(() => {
    try {
      localStorage.setItem(stepKey(user.id), String(step));
    } catch {
      // almacenamiento no disponible: el recorrido sigue sin retomar
    }
  }, [step, user.id]);

  const goNext = useCallback(() => {
    setFooter(null);
    setStep((s) => Math.min(s + 1, LAST_STEP));
  }, []);

  const goBack = useCallback(() => {
    setFooter(null);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const finish = useCallback(
    async (reset: boolean): Promise<void> => {
      setFinishing(true);
      try {
        if (reset) await api.resetUserData();
        const u = await api.setOnboardingDone({ done: true });
        try {
          localStorage.removeItem(stepKey(user.id));
        } catch {
          // sin almacenamiento: nada que limpiar
        }
        invalidate();
        navigate('/home', { replace: true });
        setUser(u);
      } catch (e: unknown) {
        toast(e instanceof Error ? e.message : String(e), 'error');
      } finally {
        setFinishing(false);
      }
    },
    [setUser, user.id],
  );

  const stepProps = { goNext, setFooter, finish, finishing };

  let body: ReactNode = null;
  if (step === 0) body = <WelcomeStep {...stepProps} />;
  else if (step === 1) body = <CategoriesStep {...stepProps} />;
  else if (step === 2)
    body = <AccountStep {...stepProps} draft={accountDraft} setDraft={setAccountDraft} />;
  else if (step === 3) body = <BudgetStep {...stepProps} />;
  else if (step === 4) body = <IncomeStep {...stepProps} />;
  else if (step === 5) body = <ExpenseStep {...stepProps} />;
  else body = <ResultStep {...stepProps} />;

  const chrome = step >= 1 && step <= TOTAL_CONTENT_STEPS;

  return (
    <div className="ob-root">
      {chrome ? (
        <header className="ob-top">
          <p className="ob-step-label">
            Paso {step} de {TOTAL_CONTENT_STEPS}
          </p>
          <div className="ob-segments" aria-hidden="true">
            {Array.from({ length: TOTAL_CONTENT_STEPS }, (_, i) => (
              <span key={i} className={`ob-segments__seg${i + 1 <= step ? ' is-done' : ''}`} />
            ))}
          </div>
        </header>
      ) : null}
      <main className="ob-body">{body}</main>
      {footer !== null ? (
        <footer className="ob-footer">
          {step === 0 || step === LAST_STEP ? (
            <div className="ob-footer-single">{footer.kind === 'custom' ? footer.node : null}</div>
          ) : (
            <>
              <Button variant="ghost" onClick={goBack}>
                Atrás
              </Button>
              {footer.kind === 'primary' ? (
                <Button
                  block
                  loading={footer.action.loading}
                  disabled={footer.action.disabled}
                  onClick={footer.action.onPress}
                >
                  {footer.action.label}
                </Button>
              ) : (
                footer.node
              )}
            </>
          )}
        </footer>
      ) : null}
    </div>
  );
}
