import { useEffect, useState } from 'react';
import Modal from './Modal';
import { deleteProduct, saveProduct, uploadProductImage } from '../services/admin';
import { formatNumber } from '../lib/format';
import { SIZES } from '../config';

const EMPTY = { name: '', description: '', price: '', category_id: '', sizes: [...SIZES], image_url: '', stock: 0 };
const LOW_STOCK = 5;

// Convierte "36, 37, 38.5" o "S M L" en una lista sin repetidos (si son números, las ordena)
function parseSizes(text) {
  const unique = [
    ...new Set(
      String(text)
        .split(/[\s,;]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  const allNumeric = unique.every((s) => /^\d+(\.\d+)?$/.test(s));
  return allNumeric ? unique.sort((a, b) => parseFloat(a) - parseFloat(b)) : unique;
}

export default function ProductsTab({ products, categories, onChange, createRequest }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // null | objeto producto (con o sin id)

  // El botón "+ NUEVO PRODUCTO" del header incrementa createRequest
  useEffect(() => {
    if (createRequest > 0) setEditing({ ...EMPTY });
  }, [createRequest]);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const lowStock = products.filter((p) => p.stock <= LOW_STOCK).length;
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);

  const handleDelete = async (product) => {
    if (!window.confirm(`¿Eliminar "${product.name}"?`)) return;
    try {
      await deleteProduct(product.id);
      onChange();
    } catch (err) {
      alert('No se pudo eliminar: ' + err.message);
    }
  };

  return (
    <>
      <div className="admin-stats">
        <article>
          <span>PRODUCTOS ACTIVOS</span>
          <strong>{products.length}</strong>
          <small>En catálogo</small>
        </article>

        <article>
          <span>STOCK TOTAL</span>
          <strong>{formatNumber(totalStock)}</strong>
          <small>Unidades disponibles</small>
        </article>

        <article>
          <span>STOCK BAJO</span>
          <strong>{String(lowStock).padStart(2, '0')}</strong>
          <small className="error-text">Requiere atención</small>
        </article>
      </div>

      <section className="admin-panel">
        <header className="admin-panel__header">
          <div>
            <h3>CATÁLOGO</h3>
            <span>{products.length} productos en total</span>
          </div>

          <label className="admin-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="BUSCAR PRODUCTO..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </header>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>PRODUCTO</th>
                <th>CATEGORÍA</th>
                <th>PRECIO</th>
                <th>STOCK</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((product) => {
                const out = product.stock <= 0;
                const low = product.stock <= LOW_STOCK;
                return (
                  <tr key={product.id}>
                    <td>
                      <div className="table-product">
                        <img src={product.image_url} alt="" />
                        <div>
                          <strong>{product.name.toUpperCase()}</strong>
                          <span>SKU-{product.id.slice(0, 6).toUpperCase()}</span>
                        </div>
                      </div>
                    </td>
                    <td>{product.categories?.name || '—'}</td>
                    <td>$ {formatNumber(product.price)}</td>
                    <td>{product.stock} uds.</td>
                    <td>
                      <span className={`status ${low ? 'status--low' : 'status--active'}`}>
                        {out ? 'AGOTADO' : low ? 'STOCK BAJO' : 'ACTIVO'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="table-action" onClick={() => setEditing({ ...product, category_id: product.category_id || '' })}>
                          EDITAR
                        </button>
                        <button type="button" className="table-action table-action--danger" onClick={() => handleDelete(product)}>
                          ELIMINAR
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <ProductForm
          product={editing}
          categories={categories}
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

function ProductForm({ product, categories, onClose, onSaved }) {
  const [form, setForm] = useState(product);
  const [sizesText, setSizesText] = useState((product.sizes || []).join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      set('image_url', await uploadProductImage(file));
    } catch (err) {
      setError('No se pudo subir la imagen: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  // onSubmit: crea o actualiza según exista form.id
  const handleSubmit = async (event) => {
    event.preventDefault();
    const sizes = parseSizes(sizesText);
    if (sizes.length === 0) {
      setError('Escribe al menos una talla (por ejemplo: 36, 37, 38).');
      return;
    }
    setBusy(true);
    try {
      await saveProduct({ ...form, sizes });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={form.id ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'} onClose={onClose}>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>NOMBRE</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </label>

        <label className="field">
          <span>DESCRIPCIÓN</span>
          <textarea rows="3" value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
        </label>

        <div className="admin-form__row">
          <label className="field">
            <span>PRECIO (COP)</span>
            <input type="number" min="0" step="100" value={form.price} onChange={(e) => set('price', e.target.value)} required />
          </label>

          <label className="field">
            <span>STOCK</span>
            <input type="number" min="0" value={form.stock} onChange={(e) => set('stock', e.target.value)} required />
          </label>
        </div>

        <label className="field">
          <span>CATEGORÍA</span>
          <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>TALLAS DE ESTE PRODUCTO (sepáralas con coma)</span>
          <small className="muted" style={{ fontSize: 11 }}>
            Cada producto tiene sus propias tallas: escríbelas tú. Tenis: 38, 39, 40 · con media talla: 38.5 · ropa: S, M, L.
          </small>
          <input
            value={sizesText}
            onChange={(e) => setSizesText(e.target.value)}
            placeholder="Ej: 36, 37, 38, 38.5, 39, 40"
            required
          />
          <div className="check-row">
            <button type="button" className="table-action" onClick={() => setSizesText('36, 37, 38, 39, 40, 41, 42, 43, 44')}>
              ATAJO TENIS 36–44
            </button>
            <button type="button" className="table-action" onClick={() => setSizesText(SIZES.join(', '))}>
              ATAJO ROPA S–XL
            </button>
          </div>
        </label>

        <label className="field">
          <span>IMAGEN (URL o sube un archivo)</span>
          <input value={form.image_url || ''} onChange={(e) => set('image_url', e.target.value)} placeholder="https://…" />
          <input type="file" accept="image/*" onChange={handleFile} />
        </label>

        {form.image_url && <img className="admin-form__preview" src={form.image_url} alt="Vista previa" />}

        {error && <p className="form-message form-message--error">{error}</p>}

        <button className="button button--dark button--full" type="submit" disabled={busy}>
          {busy ? 'GUARDANDO…' : 'GUARDAR PRODUCTO'}
        </button>
      </form>
    </Modal>
  );
}
