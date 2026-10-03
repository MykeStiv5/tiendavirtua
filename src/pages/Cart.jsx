import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { createOrder, buildWhatsAppUrl } from '../services/orders';
import { startMercadoPagoCheckout } from '../services/mercadopago';
import { formatCOP } from '../lib/format';
import { FREE_SHIPPING_FROM } from '../config';

const EMPTY_CLIENT = { name: '', phone: '', email: '', address: '', city: '' };

export default function Cart({ params }) {
  const { items, count, subtotal, changeQuantity, removeItem } = useCart();
  const [client, setClient] = useState(EMPTY_CLIENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const total = subtotal;
  const freeShipping = subtotal >= FREE_SHIPPING_FROM;
  const failed = params.get('status') === 'failure';

  const onField = (event) => setClient({ ...client, [event.target.name]: event.target.value });

  // Botón "Pagar con Mercado Pago" (submit del formulario)
  const handlePay = async (event) => {
    event.preventDefault();
    setError('');

    if (!client.email || !client.address || !client.city) {
      setError('Completa email, dirección y ciudad para pagar en línea.');
      return;
    }

    setBusy(true);
    try {
      // 1) Guarda el pedido en Supabase con estado "Pendiente"
      const order = await createOrder(client, items);
      // 2) Inicia el checkout de Mercado Pago (redirige al init_point)
      await startMercadoPagoCheckout({ items, total: order.total, orderId: order.id });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No pudimos iniciar el pago. Intenta de nuevo.');
      setBusy(false);
    }
  };

  // Botón "Pedir por WhatsApp"
  const handleWhatsApp = () => {
    setError('');
    if (!client.name || !client.phone) {
      setError('Escribe tu nombre y teléfono para pedir por WhatsApp.');
      return;
    }
    window.open(buildWhatsAppUrl(items, total, client), '_blank', 'noopener');
  };

  return (
    <section className="section shopping-bag" id="bolsa">
      <header className="section-heading section-heading--compact">
        <div>
          <span className="eyebrow">CHECKOUT</span>
          <h2>TU BOLSA [{count}]</h2>
        </div>

        <p>Envíos gratuitos en compras superiores a $300.000 COP.</p>
      </header>

      {failed && (
        <p className="form-message form-message--error">
          El pago no se completó. Tu bolsa sigue guardada; puedes intentarlo de nuevo.
        </p>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <p className="state-message">Tu bolsa está vacía.</p>
          <a href="#productos" className="button button--dark">VER COLECCIÓN</a>
        </div>
      ) : (
        <div className="shopping-bag__layout">
          <div className="bag-products">
            {items.map((item) => (
              <article className="bag-item" key={item.key}>
                <img src={item.image} alt={item.name} />

                <div className="bag-item__content">
                  <div className="bag-item__heading">
                    <h3>{item.name.toUpperCase()}</h3>
                    <button
                      type="button"
                      aria-label={`Eliminar ${item.name}`}
                      onClick={() => removeItem(item.key)}
                    >
                      ×
                    </button>
                  </div>

                  <span>TALLA {item.size}</span>
                  <strong>{formatCOP(item.price * item.quantity)}</strong>

                  <div className="quantity-selector">
                    <button type="button" aria-label="Reducir cantidad" onClick={() => changeQuantity(item.key, -1)}>−</button>
                    <span>{item.quantity}</span>
                    <button type="button" aria-label="Aumentar cantidad" onClick={() => changeQuantity(item.key, 1)}>+</button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="bag-summary">
            <h3>RESUMEN</h3>

            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{formatCOP(subtotal)}</strong>
            </div>

            <div className="summary-row">
              <span>Envío</span>
              <strong className={freeShipping ? 'success-text' : ''}>
                {freeShipping ? 'GRATIS' : 'Se confirma al despachar'}
              </strong>
            </div>

            <div className="summary-row summary-row--total">
              <span>Total</span>
              <strong>{formatCOP(total)}</strong>
            </div>

            <form className="checkout-form" onSubmit={handlePay}>
              <label className="field">
                <span>NOMBRE COMPLETO</span>
                <input name="name" value={client.name} onChange={onField} required autoComplete="name" />
              </label>
              <label className="field">
                <span>TELÉFONO</span>
                <input name="phone" value={client.phone} onChange={onField} required autoComplete="tel" inputMode="tel" />
              </label>
              <label className="field">
                <span>EMAIL</span>
                <input name="email" type="email" value={client.email} onChange={onField} autoComplete="email" />
              </label>
              <label className="field">
                <span>DIRECCIÓN</span>
                <input name="address" value={client.address} onChange={onField} autoComplete="street-address" />
              </label>
              <label className="field">
                <span>CIUDAD</span>
                <input name="city" value={client.city} onChange={onField} autoComplete="address-level2" />
              </label>

              {error && <p className="form-message form-message--error">{error}</p>}

              <button className="button button--dark button--full" type="submit" disabled={busy}>
                {busy ? 'PROCESANDO…' : 'PAGAR CON MERCADO PAGO'}
                {!busy && <span aria-hidden="true">→</span>}
              </button>

              <div className="payment-methods">
                <span>mercado pago</span>
                <strong>PSE</strong>
                <strong>Nequi</strong>
              </div>

              <button className="button button--green button--full" type="button" onClick={handleWhatsApp}>
                PEDIR POR WHATSAPP
              </button>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
}
