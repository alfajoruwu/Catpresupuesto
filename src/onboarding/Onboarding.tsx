import type { ReactNode } from 'react';
import { Button, ScreenHeader } from '../ui';
import { api } from '../api/client';
import { useSession } from '../lib/session';

export function Onboarding(): ReactNode {
  const { setUser } = useSession();
  return (
    <div>
      <ScreenHeader title="Bienvenido" />
      <div style={{ padding: '0 16px 16px' }}>
        <Button
          block
          onClick={() => api.setOnboardingDone({ done: true }).then((u) => setUser(u))}
        >
          Empezar
        </Button>
      </div>
    </div>
  );
}
