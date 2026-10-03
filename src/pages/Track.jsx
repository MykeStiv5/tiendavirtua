import { useEffect, useState } from 'react';
import { trackOrder } from '../services/orders';
import { useCart } from '../context/CartContext';
import { formatDateTime } from '../lib/format';
import { ORDER_STATUSES } from '../config';

const STEPS = ['RECIBIDO', 'PAGADO', 'ENVIADO', 'ENTREGADO'];

export default function Track({ params }) {
  const { clear } = useCart();
  const initialCode = params.get('order_id') || '';
  const returnStatus = params.get('status'); // success | pending (retorno de Mercado Pago)

  const [code, setCode] = useState(initialCode);
  const [order, setOrder] = useState(null);
  const [state, setState] = useState('idle'); // idle | loading | found | missing | error

  const search = async (value) => {
    const query = value.trim();
    if (!query) return;
    setState('loading');
    try {
      const result = await trackOrder(query);
      setOrder(result);
      setState(result ? 'found' : 'missing');
    } catch (error) {
      console.error(error);
      setState('error');
    }
  };

  // Si venimos de Mercado Pago: vacía la bolsa y consulta el pedido automáticamente
  useEffect(() => {
    if (returnStatus === 'success') clear();
    if (initialCode) search(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    search(code);
  };

  const currentIndex = order ? ORDER_STATUSES.indexOf(order.status) : -1;

  return (
    <section className="tracking" id="rastrear">
      <div className="tracking__intro">
        <span className="eyebrow">ESTADO DE TU COMPRA</span>

        <h2>
          ¿DÓNDE ESTÁ<br />
          MI PEDIDO?
        </h2>

        <p>Ingresa el código que recibiste en tu correo de confirmación.</p>

        {returnStatus === 'success' && (
          <p className="form-message form-message--success">
            ¡Gracias por tu compra! Recibimos tu pago; en breve confirmaremos tu pedido.
          </p>
        )}
        {returnStatus === 'pending' && (
          <p className="form-message">Tu pago está pendiente de confirmación por Mercado Pago.</p>
        )}

        <form className="tracking-form" onSubmit={handleSubmit}>
          <label>
            <span>NÚMERO DE PEDIDO</span>
            <input
              type="text"
              name="order"
              placeholder="EJ. ORD-08921"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>

          <button className="button button--dark" type="submit" disabled={state === 'loading'}>
            {state === 'loading' ? 'BUSCANDO…' : 'RASTREAR'}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        {state === 'missing' && (
          <p className="form-message form-message--error">No encontramos un pedido con ese código.</p>
        )}
        {state === 'error' && (
          <p className="form-message form-message--error">No pudimos consultar el pedido. Intenta de nuevo.</p>
        )}
      </div>

      {state === 'found' && order && (
        <div className="tracking-result">
          <header className="tracking-result__header">
            <div>
              <span>PEDIDO</span>
              <strong>{order.order_code}</strong>
            </div>

            <div>
              <span>GUÍA DE ENVÍO</span>
              <strong>{order.tracking_guide || 'PENDIENTE'}</strong>
            </div>

            <span className="order-status">{order.status.toUpperCase()}</span>
          </header>

          <div className="steps">
            {STEPS.map((label, index) => {
              const completed = index <= currentIndex;
              let detail = 'PENDIENTE';
              if (index === 0) detail = formatDateTime(order.created_at);
              else if (index === currentIndex) detail = formatDateTime(order.updated_at);
              else if (completed) detail = 'COMPLETADO';

              return (
                <div key={label} className={`step${completed ? ' step--completed' : ''}`}>
                  <i>{completed ? '✓' : index + 1}</i>
                  <strong>{label}</strong>
                  <span>{detail}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
