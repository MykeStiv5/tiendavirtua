import { MERCADOPAGO_PUBLIC_KEY } from '../config';

/**
 * Inicia Mercado Pago Checkout Pro (redirección al init_point).
 *
 * Solo se envía el ID del pedido. El servidor (/api/mercadopago) lee el pedido en Supabase
 * (productos, precios, envío y total) y crea la preferencia con el ACCESS TOKEN secreto,
 * así el navegador no puede alterar lo que se cobra.
 */

// Las credenciales de prueba empiezan por "TEST-": en ese caso se usa el sandbox.
const IS_TEST_MODE = MERCADOPAGO_PUBLIC_KEY.startsWith('TEST-');

export async function startMercadoPagoCheckout({ orderId }) {
  if (!orderId) throw new Error('Falta el order_id del pedido');

  if (!MERCADOPAGO_PUBLIC_KEY) {
    console.warn('[Mercado Pago] Falta VITE_MERCADOPAGO_PUBLIC_KEY en las variables de entorno.');
  }

  const response = await fetch('/api/mercadopago', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });

  const data = await response.json().catch(() => ({}));

  const checkoutUrl = (IS_TEST_MODE && data.sandbox_init_point) || data.init_point;
  if (!response.ok || !checkoutUrl) {
    throw new Error(data.message || data.error || 'No se pudo crear el pago en Mercado Pago');
  }

  window.location.href = checkoutUrl;
}
