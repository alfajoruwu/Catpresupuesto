import { useState } from 'react';
import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { ConfirmDialog, IconButton, ScreenHeader } from '../../ui';
import { useSession } from '../../lib/session';

export function HomeScreen(): ReactNode {
  const { logout } = useSession();
  const [confirming, setConfirming] = useState(false);
  return (
    <div>
      <ScreenHeader
        title="Home"
        actions={
          <IconButton label="Cerrar sesión" onClick={() => setConfirming(true)}>
            <LogOut size={24} />
          </IconButton>
        }
      />
      <ConfirmDialog
        open={confirming}
        title="Cerrar sesión"
        message="¿Cerrar la sesión actual?"
        confirmLabel="Cerrar sesión"
        onConfirm={() => logout()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
