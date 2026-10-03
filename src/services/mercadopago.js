/**
 * Inicia Mercado Pago Checkout Pro.
 *
 * @param {Object}   params
 * @param {Array}    params.items    Items del carrito: { productId, name, size, quantity, price }
 * @param {number}   params.total    Total del carrito en COP (se valida contra los items)
 * @param {string}   params.orderId  ID del pedido ya creado en Supabase
 *
 * El POST a https://api.mercadopago.com/checkout/preferences se hace en /api/mercadopago
 * (carpeta api/), que añade el MERCADOPAGO_ACCESS_TOKEN en el servidor. Así el token
 * secreto no queda expuesto en el navegador y se evita el bloqueo CORS de la API.
 */
export async function startMercadoPagoCheckout({ items, total, orderId }) {
  if (!orderId) throw new Error('Falta el order_id del pedido');
  if (!items?.length) throw new Error('El carrito está vacío');

  const computed = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  if (Math.round(computed) !== Math.round(Number(total))) {
    throw new Error('El total no coincide con los productos del carrito');
  }

  const origin = window.location.origin;

  const preference = {
    items: items.map((item) => ({
      id: String(item.productId),
      title: `${item.name} — Talla ${item.size}`,
      quantity: item.quantity,
      unit_price: Number(item.price),
      currency_id: 'COP',
    })),
    external_reference: orderId,
    back_urls: {
      success: origin + '/#/track?status=success&order_id=' + orderId,
      failure: origin + '/#/cart?status=failure',
      pending: origin + '/#/track?status=pending&order_id=' + orderId,
    },
  };

  // Mercado Pago solo acepta auto_return con back_urls públicas en HTTPS.
  // En localhost se omite (el cliente verá el botón "Volver al sitio" tras pagar).
  const isPublicHttps =
    origin.startsWith('https://') && !/localhost|127\.0\.0\.1/.test(origin);
  if (isPublicHttps) preference.auto_return = 'approved';

  const response = await fetch('/api/mercadopago', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preference),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.init_point) {
    throw new Error(data.message || data.error || 'No se pudo crear el pago en Mercado Pago');
  }

  // Redirección automática al checkout
  window.location.href = data.init_point;
}