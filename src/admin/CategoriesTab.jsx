import { useEffect, useState } from 'react';
import Modal from './Modal';
import { deleteCategory, saveCategory } from '../services/admin';
import { slugify } from '../lib/format';

export default function CategoriesTab({ categories, products, onChange, createRequest }) {
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (createRequest > 0) setEditing({ name: '', slug: '' });
  }, [createRequest]);

  const handleDelete = async (category) => {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"? Sus productos quedarán sin categoría.`)) return;
    try {
      await deleteCategory(category.id);
      onChange();
    } catch (err) {
      alert('No se pudo eliminar: ' + err.message);
    }
  };

  return (
    <>
      <section className="admin-panel">
        <header className="admin-panel__header">
          <div>
            <h3>CATEGORÍAS</h3>
            <span>{categories.length} en total</span>
          </div>
        </header>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>NOMBRE</th>
                <th>SLUG</th>
                <th>PRODUCTOS</th>
                <th>ACCIONES</th>
              </tr>
            </thead>

            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td><strong>{category.name}</strong></td>
                  <td>{category.slug}</td>
                  <td>{products.filter((p) => p.category_id === category.id).length}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="table-action" onClick={() => setEditing(category)}>EDITAR</button>
                      <button type="button" className="table-action table-action--danger" onClick={() => handleDelete(category)}>
                        ELIMINAR
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <CategoryForm
          category={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </>
  );
}

function CategoryForm({ category, onClose, onSaved }) {
  const [form, setForm] = useState(category);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await saveCategory({ ...form, slug: form.slug || slugify(form.name) });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={form.id ? 'EDITAR CATEGORÍA' : 'NUEVA CATEGORÍA'} onClose={onClose}>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>NOMBRE</span>
          <input
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value, slug: form.id ? form.slug : slugify(e.target.value) })
            }
            required
          />
        </label>

        <label className="field">
          <span>SLUG</span>
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} required />
        </label>

        {error && <p className="form-message form-message--error">{error}</p>}

        <button className="button button--dark button--full" type="submit" disabled={busy}>
          {busy ? 'GUARDANDO…' : 'GUARDAR CATEGORÍA'}
        </button>
      </form>
    </Modal>
  );
}
