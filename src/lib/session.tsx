import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../api/types';

export interface Session {
  user: User;
  setUser(u: User): void;
  logout(): Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider(props: {
  user: User;
  setUser: (u: User) => void;
  logout: () => Promise<void>;
  children: ReactNode;
}): ReactNode {
  const { user, setUser, logout, children } = props;
  return (
    <SessionContext.Provider value={{ user, setUser, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (ctx === null) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
