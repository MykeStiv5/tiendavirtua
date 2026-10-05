import { useState } from 'react';
import { updateOrder } from '../services/admin';
import { callAdmin } from '../services/adminApi';
import { formatCOP, formatDateTime, waNumber } from '../lib/format';
import { ORDER_STATUSES } from '../config';

const FILTERS = [
  { id: 'all', label: 'TODOS', match: () => true },
  { id: 'pending', label: 'PENDIENTES', match: (o) => o.status === 'Pendiente' },
  { id: 'abandoned', label: 'ABANDONADOS', match: (o) => o.status === 'Abandonado' },
  { id: 'paid', label: 'PAGADOS', match: (o) => ['Pagado', 'Enviado', 'Entregado'].includes(o.status) },
  { id: 'refunded', label: 'REEMBOLSADOS', match: (o) => o.status === 'Reembolsado' },
];

export default function OrdersTab({ orders, onChange }) {
  const [filter, setFilter] = useState('all');
  const current = FILTERS.find((f) => f.id === filter);
  const visible = orders.filter(current.match);

  return (
    <section className="admin-panel">
      <header className="admin-panel__header">
        <div>
          <h3>PEDIDOS</h3>
          <span>{visible.length} de {orders.length}</span>
        </div>
      </header>

      <div className="admin-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`table-action${filter === f.id ? ' table-action--active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label} ({orders.filter(f.match).length})
          </button>
        ))}
      </div>

      {filter === 'abandoned' && (
        <p className="admin-note">
          Un pedido pasa a <strong>Abandonado</strong> solo cuando lleva más de 24 h sin pagarse (lo hace una tarea
          diaria). Aquí puedes escribirle al cliente por WhatsApp o enviarle un recordatorio por correo.
        </p>
      )}

      <div className="admin-table-wrapper">
        <table className="admin-table admin-table--orders">
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>CLIENTE</th>
              <th>PRODUCTOS</th>
              <th>TOTAL</th>
              <th>ESTADO</th>
              <th>GUÍA / REEMBOLSO</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {visible.map((order) => (
              <OrderRow key={order.id} order={order} onSaved={onChange} />
            ))}
          </tbody>
        </table>

        {visible.length === 0 && <p className="state-message">No hay pedidos en esta vista.</p>}
      </div>
    </section>
  );
}

function OrderRow({ order, onSaved }) {
  const [status, setStatus] = useState(order.status);
  const [guide, setGuide] = useState(order.tracking_guide || '');
  const [refundNote, setRefundNote] = useState(order.refund_note || '');
  const [busy, setBusy] = useState(false);

  const client = order.client_info || {};
  const refunding = status === 'Reembolsado';
  const dirty =
    status !== order.status ||
    guide !== (order.tracking_guide || '') ||
    (refunding && refundNote !== (order.refund_note || ''));

  const canRemind = ['Pendiente', 'Abandonado'].includes(order.status);
  const wa = waNumber(client.phone);
  const waText = `Hola ${String(client.name || '').split(' ')[0]}, te escribimos de AREA 11. Vimos que dejaste tu pedido ${order.order_code} sin terminar el pago. ¿Te ayudamos a completarlo?`;

  const handleSave = async () => {
    const becomingRefund = refunding && order.status !== 'Reembolsado';
    if (
      becomingRefund &&
      !window.confirm(
        `¿Ya devolviste ${formatCOP(order.total)} desde Mercado Pago?\n\n` +
          'Al guardar, el stock de los productos se repone y se envía un correo de reembolso al cliente.\n' +
          'El dinero NO se devuelve desde aquí: se hace a mano en tu panel de Mercado Pago.',
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      await updateOrder(order.id, { status, tracking_guide: guide.trim(), refund_note: refundNote.trim() });
      if (becomingRefund) {
        try {
          const result = await callAdmin('notify-refund', { orderId: order.id });
          if (!result.emailed) alert('Reembolso guardado, pero algún correo no salió (revisa SMTP_USER / SMTP_PASS).');
        } catch (err) {
          alert('Reembolso guardado, pero no se pudo enviar el correo: ' + err.message);
        }
      }
      await onSaved();
    } catch (err) {
      alert('No se pudo actualizar: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemind = async () => {
    setBusy(true);
    try {
      await callAdmin('remind-abandoned', { orderId: order.id });
      await onSaved();
    } catch (err) {
      alert('No se pudo enviar: ' + err.message);
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
        <span className="muted">{client.email}</span>
        <br />
        <span className="muted">{[client.address, client.city].filter(Boolean).join(', ')}</span>
      </td>

      <td>
        {order.order_items.map((item, index) => (
          <div key={index} className="muted">
            {item.quantity}× {item.products?.name || 'Producto eliminado'} ({item.size}{item.color ? ` · ${item.color}` : ''})
          </div>
        ))}
      </td>

      <td>
        {formatCOP(order.total)}
        {Number(order.shipping_cost) > 0 && (
          <>
            <br />
            <span className="muted">incluye envío {formatCOP(order.shipping_cost)}</span>
          </>
        )}
      </td>

      <td>
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {order.status === 'Reembolsado' && order.refunded_at && (
          <>
            <br />
            <span className="muted">{formatDateTime(order.refunded_at)}</span>
          </>
        )}
        {order.reminder_sent_at && canRemind && (
          <>
            <br />
            <span className="muted">Recordatorio: {formatDateTime(order.reminder_sent_at)}</span>
          </>
        )}
      </td>

      <td>
        {refunding ? (
          <input
            className="admin-select"
            placeholder="Nota (se envía al cliente)"
            value={refundNote}
            onChange={(e) => setRefundNote(e.target.value)}
          />
        ) : (
          <input
            className="admin-select"
            placeholder="Nº de guía"
            value={guide}
            onChange={(e) => setGuide(e.target.value)}
          />
        )}
      </td>

      <td>
        <div className="table-actions" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="table-action" disabled={!dirty || busy} onClick={handleSave}>
            {busy ? '…' : 'GUARDAR'}
          </button>
          {canRemind && wa && (
            <a
              className="table-action"
              href={`https://wa.me/${wa}?text=${encodeURIComponent(waText)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WHATSAPP
            </a>
          )}
          {canRemind && (
            <button type="button" className="table-action" disabled={busy} onClick={handleRemind}>
              {order.reminder_sent_at ? 'REENVIAR CORREO' : 'RECORDAR POR CORREO'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
