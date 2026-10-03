import { useState } from 'react';
import { updateOrder } from '../services/admin';
import { formatCOP, formatDateTime } from '../lib/format';
import { ORDER_STATUSES } from '../config';

export default function OrdersTab({ orders, onChange }) {
  return (
    <section className="admin-panel">
      <header className="admin-panel__header">
        <div>
          <h3>PEDIDOS</h3>
          <span>{orders.length} en total</span>
        </div>
      </header>

      <div className="admin-table-wrapper">
        <table className="admin-table admin-table--orders">
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>CLIENTE</th>
              <th>PRODUCTOS</th>
              <th>TOTAL</th>
              <th>ESTADO</th>
              <th>GUÍA DE ENVÍO</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} onSaved={onChange} />
            ))}
          </tbody>
        </table>

        {orders.length === 0 && <p className="state-message">Aún no hay pedidos.</p>}
      </div>
    </section>
  );
}

function OrderRow({ order, onSaved }) {
  const [status, setStatus] = useState(order.status);
  const [guide, setGuide] = useState(order.tracking_guide || '');
  const [busy, setBusy] = useState(false);

  const client = order.client_info || {};
  const dirty = status !== order.status || guide !== (order.tracking_guide || '');

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateOrder(order.id, { status, tracking_guide: guide.trim() });
      await onSaved();
    } catch (err) {
      alert('No se pudo actualizar: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td>
        <strong>{order.order_code}</strong>
        <br />
        <span className="muted">{formatDateTime(order.created_at)}</span>
      </td>

      <td>
        <strong>{client.name}</strong>
        <br />
        <span className="muted">{client.phone}</span>
        <br />
        <span className="muted">{[client.address, client.city].filter(Boolean).join(', ')}</span>
      </td>

      <td>
        {order.order_items.map((item, index) => (
          <div key={index} className="muted">
            {item.quantity}× {item.products?.name || 'Producto eliminado'} ({item.size})
          </div>
        ))}
      </td>

      <td>{formatCOP(order.total)}</td>

      <td>
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </td>

      <td>
        <input
          className="admin-select"
          placeholder="Nº de guía"
          value={guide}
          onChange={(e) => setGuide(e.target.value)}
        />
      </td>

      <td>
        <button type="button" className="table-action" disabled={!dirty || busy} onClick={handleSave}>
          {busy ? '…' : 'GUARDAR'}
        </button>
      </td>
    </tr>
  );
}
