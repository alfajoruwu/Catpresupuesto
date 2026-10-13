import { useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../api/client';
import type { Category, CategoryKind } from '../../api/types';
import { invalidate, useQuery } from '../../lib/data';
import { CATEGORY_COLORS } from '../../lib/categoryPalette';
import {
  Button,
  CategoryDot,
  ConfirmDialog,
  ListRow,
  Segmented,
  Sheet,
  TextField,
  toast,
} from '../../ui';
import './budget.css';

export function CategoriesSheet(props: { open: boolean; onClose(): void }): ReactNode {
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState<Category | null>(null);

  const categoriesQuery = useQuery(
    () => api.listCategories({ kind, includeArchived: false }),
    [kind],
  );
  const categories = categoriesQuery.data ?? [];
  const edited = editingId !== null ? categories.find((c) => c.id === editingId) ?? null : null;

  function handleKindChange(next: CategoryKind): void {
    setKind(next);
    setEditingId(null);
    setCreating(false);
  }

  function startCreate(): void {
    setCreating(true);
    setEditingId(null);
    setName('');
    setColor(CATEGORY_COLORS[0]);
  }

  function startEdit(cat: Category): void {
    setEditingId(cat.id);
    setCreating(false);
    setName(cat.name);
    setColor(cat.color);
  }

  function cancelForm(): void {
    setEditingId(null);
    setCreating(false);
  }

  async function handleSave(): Promise<void> {
    const trimmed = name.trim();
    if (trimmed === '') {
      toast('Ingresa un nombre', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId !== null) {
        await api.updateCategory({ id: editingId, name: trimmed, color });
      } else {
        await api.createCategory({ name: trimmed, kind, color });
      }
      invalidate();
      toast('Guardado', 'ok');
      cancelForm();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(): Promise<void> {
    if (archiving === null) return;
    try {
      await api.archiveCategory({ id: archiving.id });
      invalidate();
      toast('Guardado', 'ok');
      setArchiving(null);
      cancelForm();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  function renderForm(showArchive: boolean): ReactNode {
    return (
      <div className="bd-catform">
        <TextField label="Nombre" value={name} onChange={setName} autoFocus />
        <div className="bd-swatches">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`bd-swatch${c === color ? ' is-selected' : ''}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <Button block loading={saving} onClick={handleSave}>
          Guardar
        </Button>
        {showArchive ? (
          <Button variant="ghost" block onClick={() => setArchiving(edited)}>
            Archivar
          </Button>
        ) : null}
        <Button variant="ghost" block onClick={cancelForm}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <>
      <Sheet open={props.open} title="Categorías" onClose={props.onClose}>
        <Segmented
          value={kind}
          options={[
            { value: 'expense', label: 'Gastos' },
            { value: 'income', label: 'Ingresos' },
          ]}
          onChange={handleKindChange}
        />
        {categoriesQuery.error !== null ? (
          <p className="bd-error">{categoriesQuery.error}</p>
        ) : null}
        <div className="bd-catlist">
          {categories.map((cat) =>
            editingId === cat.id ? (
              <div key={cat.id} className="bd-catedit">
                {renderForm(true)}
              </div>
            ) : (
              <ListRow
                key={cat.id}
                title={cat.name}
                leading={<CategoryDot color={cat.color} />}
                onClick={() => startEdit(cat)}
              />
            ),
          )}
        </div>
        {creating ? (
          <div className="bd-new-wrap">{renderForm(false)}</div>
        ) : (
          <div className="bd-new-wrap">
            <Button block variant="secondary" onClick={startCreate}>
              Nueva categoría
            </Button>
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={archiving !== null}
        title="Archivar categoría"
        message="Se oculta para nuevos movimientos. El historial se conserva."
        confirmLabel="Archivar"
        danger
        onConfirm={handleArchive}
        onCancel={() => setArchiving(null)}
      />
    </>
  );
}
