import { useState } from 'react';
import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api/client';
import { invalidate, useQuery } from '../../lib/data';
import { CATEGORY_COLORS } from '../../lib/categoryPalette';
import { Button, CategoryDot, TextField, toast } from '../../ui';
import './movements.css';

export function CategoryPicker(props: {
  kind: 'income' | 'expense';
  value: number | null;
  onChange(id: number): void;
}): ReactNode {
  const { kind, value, onChange } = props;
  const cats = useQuery(() => api.listCategories({ kind, includeArchived: false }), [kind]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const list = cats.data ?? [];

  function openNew(): void {
    setColor(CATEGORY_COLORS[list.length % CATEGORY_COLORS.length]);
    setName('');
    setShowNew(true);
  }

  async function handleCreate(): Promise<void> {
    setCreating(true);
    try {
      const created = await api.createCategory({ name: name.trim(), kind, color });
      onChange(created.id);
      invalidate();
      setShowNew(false);
      setName('');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mv-picker">
      <span className="mv-picker__label">Categoría</span>
      {cats.data === undefined && cats.loading ? <div className="mv-muted">Cargando…</div> : null}
      {cats.error !== null ? <div className="mv-error">{cats.error}</div> : null}
      <div className="mv-chips">
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`mv-chip${value === c.id ? ' is-active' : ''}`}
            onClick={() => onChange(c.id)}
          >
            <CategoryDot color={c.color} />
            {c.name}
          </button>
        ))}
        <button
          type="button"
          className="mv-chip"
          onClick={() => (showNew ? setShowNew(false) : openNew())}
        >
          <Plus size={20} strokeWidth={1.75} />
          Nueva
        </button>
      </div>
      {showNew ? (
        <div className="mv-newcat">
          <TextField label="Nombre" value={name} onChange={setName} />
          <div className="mv-swatches">
            {CATEGORY_COLORS.map((cc) => (
              <button
                key={cc}
                type="button"
                aria-label={`Color ${cc}`}
                className={`mv-swatch${color === cc ? ' is-active' : ''}`}
                style={{ background: cc }}
                onClick={() => setColor(cc)}
              />
            ))}
          </div>
          <Button loading={creating} onClick={handleCreate}>
            Crear
          </Button>
        </div>
      ) : null}
    </div>
  );
}
