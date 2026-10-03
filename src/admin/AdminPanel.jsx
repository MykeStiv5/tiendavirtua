import { useCallback, useEffect, useState } from 'react';
import { fetchCategories, fetchProducts } from '../services/catalog';
import { fetchOrders, signOut } from '../services/admin';
import { supabase } from '../lib/supabase';
import ProductsTab from './ProductsTab';
import CategoriesTab from './CategoriesTab';
import OrdersTab from './OrdersTab';
import AccountsTab from './AccountsTab';

const TABS = [
  { id: 'products', icon: '▦', label: 'PRODUCTOS', title: 'PRODUCTOS' },
  { id: 'categories', icon: '□', label: 'CATEGORÍAS', title: 'CATEGORÍAS' },
  { id: 'orders', icon: '▤', label: 'PEDIDOS', title: 'PEDIDOS' },
  { id: 'accounts', icon: '◉', label: 'CUENTAS', title: 'CUENTAS Y RECUPERACIÓN' },
  { id: 'settings', icon: '⚙', label: 'CONFIGURACIÓN', title: 'CONFIGURACIÓN' },
];

export default function AdminPanel({ user }) {
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pendingRecoveries, setPendingRecoveries] = useState(0);
  const [error, setError] = useState('');
  const [createRequest, setCreateRequest] = useState(0); // el botón del header abre el formulario de la pestaña

  const reload = useCallback(async () => {
    try {
      const [p, c, o, r] = await Promise.all([
        fetchProducts(),
        fetchCategories(),
        fetchOrders(),
        // Si aún no corriste la migración 3 esta consulta falla; no debe romper el panel
        supabase.from('account_recovery_requests').select('id', { count: 'exact', head: true }).eq('status', 'Pendiente'),
      ]);
      setProducts(p);
      setCategories(c);
      setOrders(o);
      setPendingRecoveries(r.count ?? 0);
      setError('');
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los datos. Revisa tu conexión y las políticas RLS.');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const pendingOrders = orders.filter((o) => o.status === 'Pendiente').length;
  const current = TABS.find((t) => t.id === tab);
  const initials = (user.email || 'AD').slice(0, 2).toUpperCase();

  return (
    <section className="admin-preview" id="administracion">
      <aside className="admin-sidebar">
        <a href="#/" className="brand brand--inverse">
          <span>AREA</span>
          <strong>11</strong>
        </a>

        <span className="admin-sidebar__label">ADMIN SPACE</span>

        <nav className="admin-navigation">
          {TABS.map((item) => (
            <a
              key={item.id}
              href="#/admin"
              className={`admin-navigation__item${tab === item.id ? ' admin-navigation__item--active' : ''}`}
              onClick={(event) => {
                event.preventDefault();
                setTab(item.id);
              }}
            >
              <span>{item.icon}</span>
              {item.label}
              {item.id === 'orders' && pendingOrders > 0 && <strong>{pendingOrders}</strong>}
              {item.id === 'accounts' && pendingRecoveries > 0 && <strong>{pendingRecoveries}</strong>}
            </a>
          ))}
        </nav>

        <div className="admin-profile">
          <span>{initials}</span>

          <div>
            <strong>{user.email}</strong>
            <small>ADMINISTRADOR</small>
          </div>
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-header">
          <div>
            <span>AREA 11 / ADMIN</span>
            <h2>{current.title}</h2>
          </div>

          {(tab === 'products' || tab === 'categories') && (
            <button className="button button--dark" type="button" onClick={() => setCreateRequest((n) => n + 1)}>
              {tab === 'products' ? '+ NUEVO PRODUCTO' : '+ NUEVA CATEGORÍA'}
            </button>
          )}
        </header>

        {error && <p className="form-message form-message--error">{error}</p>}

        {tab === 'products' && (
          <ProductsTab products={products} categories={categories} onChange={reload} createRequest={createRequest} />
        )}
        {tab === 'categories' && (
          <CategoriesTab categories={categories} products={products} onChange={reload} createRequest={createRequest} />
        )}
        {tab === 'orders' && <OrdersTab orders={orders} onChange={reload} />}
        {tab === 'accounts' && <AccountsTab onChange={reload} />}
        {tab === 'settings' && (
          <section className="admin-panel settings-panel">
            <p><strong>Sesión:</strong> {user.email}</p>
            <button className="button button--dark" type="button" onClick={signOut}>
              CERRAR SESIÓN
            </button>
          </section>
        )}
      </div>
    </section>
  );
}
