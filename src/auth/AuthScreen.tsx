import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button, TextField } from '../ui';
import { api } from '../api/client';
import { ApiError } from '../api/client';
import type { User } from '../api/types';

export function AuthScreen(props: {
  hasUsers: boolean;
  onAuthenticated(user: User): void;
}): ReactNode {
  const [mode, setMode] = useState<'login' | 'register'>(props.hasUsers ? 'login' : 'register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const u = username.trim();
    if (u.length < 3 || u.length > 32) {
      setFieldError('El usuario debe tener entre 3 y 32 caracteres.');
      return;
    }
    if (password.length < 4) {
      setFieldError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (mode === 'register' && password !== repeat) {
      setFieldError('Las contraseñas no coinciden.');
      return;
    }
    setFieldError(undefined);
    setBackendError(null);
    setLoading(true);
    try {
      const user =
        mode === 'register'
          ? await api.register({ username: u, password })
          : await api.login({ username: u, password });
      props.onAuthenticated(user);
    } catch (err: unknown) {
      setBackendError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-auth">
      <h1 className="app-auth__title">Catpresupuesto</h1>
      <p className="app-auth__note">Tus datos se guardan solo en este teléfono.</p>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Usuario"
          value={username}
          onChange={setUsername}
          autoFocus
          error={fieldError}
        />
        <TextField
          label="Contraseña"
          value={password}
          onChange={setPassword}
          type="password"
        />
        {mode === 'register' ? (
          <TextField
            label="Repetir contraseña"
            value={repeat}
            onChange={setRepeat}
            type="password"
          />
        ) : null}
        {backendError ? <p className="app-auth__error">{backendError}</p> : null}
        <Button block loading={loading} type="submit">
          {mode === 'register' ? 'Crear usuario' : 'Iniciar sesión'}
        </Button>
      </form>
      <button
        type="button"
        className="app-auth__switch"
        onClick={() => {
          setMode(mode === 'register' ? 'login' : 'register');
          setFieldError(undefined);
          setBackendError(null);
        }}
      >
        {mode === 'register' ? 'Ya tengo usuario' : 'Crear otro usuario'}
      </button>
    </div>
  );
}
