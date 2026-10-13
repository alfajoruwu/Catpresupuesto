import { useEffect, useId, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { addMonths, monthLabel } from '../lib/dates';
import { formatMoney } from '../lib/format';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  block?: boolean;
  loading?: boolean;
}

export function Button(props: ButtonProps): ReactNode {
  const { variant = 'primary', block, loading, disabled, children, className, ...rest } = props;
  const cls = ['app-btn', `app-btn--${variant}`, block ? 'app-btn--block' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? 'Cargando…' : children}
    </button>
  );
}

export function IconButton(props: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
}): ReactNode {
  return (
    <button type="button" className="app-icon-btn" aria-label={props.label} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  onChange(v: string): void;
  placeholder?: string;
  error?: string;
  type?: string;
  autoFocus?: boolean;
}): ReactNode {
  const id = useId();
  return (
    <div className="app-field">
      <label className="app-field__label" htmlFor={id}>
        {props.label}
      </label>
      <input
        id={id}
        className="app-field__input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        type={props.type ?? 'text'}
        autoFocus={props.autoFocus}
      />
      {props.error ? <span className="app-field__error">{props.error}</span> : null}
    </div>
  );
}

export function MoneyField(props: {
  label: string;
  value: number;
  onChange(n: number): void;
  allowNegative?: boolean;
  error?: string;
}): ReactNode {
  const id = useId();
  const allowNegative = props.allowNegative ?? false;
  const [text, setText] = useState(() => (props.value === 0 ? '' : grouped(props.value)));

  useEffect(() => {
    const next = props.value === 0 ? '' : grouped(props.value);
    if (degroup(text, allowNegative) !== props.value) setText(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  function handleChange(raw: string): void {
    let negative = false;
    let rest = raw;
    if (allowNegative && rest.startsWith('-')) {
      negative = true;
      rest = rest.slice(1);
    }
    const digits = rest.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    setText(digits === '' ? (negative ? '-' : '') : (negative ? '-' : '') + grouped(Number(digits)));
    props.onChange(digits === '' ? 0 : Number(digits) * (negative ? -1 : 1));
  }

  return (
    <div className="app-field">
      <label className="app-field__label" htmlFor={id}>
        {props.label}
      </label>
      <div className="app-field__wrap">
        <span className="app-field__prefix">$</span>
        <input
          id={id}
          className="app-field__input app-field__input--money"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          inputMode="numeric"
        />
      </div>
      {props.error ? <span className="app-field__error">{props.error}</span> : null}
    </div>
  );
}

function grouped(n: number): string {
  const abs = String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? `-${abs}` : abs;
}

function degroup(s: string, allowNegative: boolean): number {
  const t = s.trim();
  if (t === '' || t === '-') return 0;
  const negative = allowNegative && t.startsWith('-');
  const digits = (negative ? t.slice(1) : t).replace(/\D/g, '');
  if (digits === '') return 0;
  return Number(digits) * (negative ? -1 : 1);
}

export function DateField(props: {
  label: string;
  value: string;
  onChange(v: string): void;
}): ReactNode {
  const id = useId();
  return (
    <div className="app-field">
      <label className="app-field__label" htmlFor={id}>
        {props.label}
      </label>
      <input
        id={id}
        className="app-field__input"
        type="date"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

export function SelectField<T extends string | number>(props: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange(v: T): void;
  placeholder?: string;
}): ReactNode {
  const id = useId();
  return (
    <div className="app-field">
      <label className="app-field__label" htmlFor={id}>
        {props.label}
      </label>
      <select
        id={id}
        className="app-field__input"
        value={props.value === null ? '' : String(props.value)}
        onChange={(e) => {
          const raw = e.target.value;
          const found = props.options.find((o) => String(o.value) === raw);
          if (found !== undefined) props.onChange(found.value);
        }}
      >
        <option value="" disabled>
          {props.placeholder ?? 'Seleccionar'}
        </option>
        {props.options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Segmented<T>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange(v: T): void;
}): ReactNode {
  return (
    <div className="app-segmented">
      {props.options.map((o, i) => (
        <button
          key={i}
          type="button"
          className={`app-segmented__btn${o.value === props.value ? ' is-active' : ''}`}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet(props: {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
}): ReactNode {
  const { open, title, onClose, children, footer } = props;

  useEffect(() => {
    if (!open) return;
    history.pushState({ sheet: true }, '');
    const onPop = (): void => {
      onClose();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="app-sheet" role="dialog" aria-label={title}>
      <div className="app-sheet__header">
        <span className="app-sheet__title">{title}</span>
        <IconButton label="Cerrar" onClick={() => history.back()}>
          <X size={24} />
        </IconButton>
      </div>
      <div className="app-sheet__body">{children}</div>
      {footer ? <div className="app-sheet__footer">{footer}</div> : null}
    </div>
  );
}

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}): ReactNode {
  if (!props.open) return null;
  return (
    <div className="app-dialog-backdrop">
      <div className="app-dialog" role="alertdialog" aria-label={props.title}>
        <div className="app-dialog__title">{props.title}</div>
        <div className="app-dialog__message">{props.message}</div>
        <div className="app-dialog__actions">
          <Button variant="ghost" onClick={props.onCancel}>
            Cancelar
          </Button>
          <Button variant={props.danger ? 'danger' : 'primary'} onClick={props.onConfirm}>
            {props.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ListRow(props: {
  title: string;
  subtitle?: string;
  value?: ReactNode;
  leading?: ReactNode;
  onClick?: () => void;
}): ReactNode {
  const Tag = props.onClick ? 'button' : 'div';
  return (
    <Tag className="app-row" onClick={props.onClick}>
      {props.leading}
      <span className="app-row__main">
        <span className="app-row__title">{props.title}</span>
        {props.subtitle ? <div className="app-row__subtitle">{props.subtitle}</div> : null}
      </span>
      {props.value !== undefined ? <span className="app-row__value">{props.value}</span> : null}
    </Tag>
  );
}

export function CategoryDot(props: { color: string; size?: number }): ReactNode {
  const size = props.size ?? 12;
  return (
    <span className="app-dot" style={{ background: props.color, width: size, height: size }} />
  );
}

export function ProgressBar(props: {
  value: number;
  max: number;
  marker?: number;
  tone?: 'default' | 'warning' | 'danger';
}): ReactNode {
  const pct = props.max <= 0 ? 0 : Math.min(100, Math.max(0, (props.value / props.max) * 100));
  const tone = props.tone ?? 'default';
  return (
    <div className="app-progress" role="progressbar">
      <div
        className={`app-progress__fill${tone === 'default' ? '' : ` app-progress__fill--${tone}`}`}
        style={{ width: `${pct}%` }}
      />
      {props.marker !== undefined ? (
        <div className="app-progress__marker" style={{ left: `${props.marker * 100}%` }} />
      ) : null}
    </div>
  );
}

export function Amount(props: {
  value: number;
  tone?: 'income' | 'expense' | 'neutral';
  size?: 'md' | 'lg' | 'xl';
}): ReactNode {
  const tone = props.tone ?? 'neutral';
  const size = props.size ?? 'md';
  return (
    <span className={`app-amount app-amount--${tone} app-amount--${size}`}>
      {formatMoney(props.value)}
    </span>
  );
}

export function ScreenHeader(props: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}): ReactNode {
  return (
    <header className="app-screen-header">
      <div>
        <h1 className="app-screen-header__title">{props.title}</h1>
        {props.subtitle ? <div className="app-screen-header__subtitle">{props.subtitle}</div> : null}
      </div>
      {props.actions}
    </header>
  );
}

export function MonthSwitcher(props: {
  month: string;
  onChange(month: string): void;
}): ReactNode {
  return (
    <div className="app-month-switcher">
      <IconButton
        label="Mes anterior"
        onClick={() => props.onChange(addMonths(props.month, -1))}
      >
        <ChevronLeft size={24} />
      </IconButton>
      <span className="app-month-switcher__label">{monthLabel(props.month)}</span>
      <IconButton
        label="Mes siguiente"
        onClick={() => props.onChange(addMonths(props.month, 1))}
      >
        <ChevronRight size={24} />
      </IconButton>
    </div>
  );
}

export function EmptyState(props: {
  title: string;
  text?: string;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="app-empty">
      <div className="app-empty__title">{props.title}</div>
      {props.text ? <div className="app-empty__text">{props.text}</div> : null}
      {props.action}
    </div>
  );
}

export function Card(props: { children: ReactNode; padding?: number | string }): ReactNode {
  return (
    <div
      className="app-card"
      style={props.padding !== undefined ? { padding: props.padding } : undefined}
    >
      {props.children}
    </div>
  );
}

interface ToastItem {
  id: number;
  message: string;
  tone: 'error' | 'ok' | 'info';
}

let toastSeq = 0;
let pushToast: ((t: ToastItem) => void) | null = null;

export function toast(message: string, tone?: 'error' | 'ok'): void {
  const item: ToastItem = { id: ++toastSeq, message, tone: tone ?? 'info' };
  pushToast?.(item);
}

export function ToastHost(): ReactNode {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushToast = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 3000);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  return (
    <div className="app-toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`app-toast${t.tone === 'info' ? '' : ` app-toast--${t.tone}`}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
