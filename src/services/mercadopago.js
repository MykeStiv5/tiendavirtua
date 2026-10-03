/**
 * Inicia Mercado Pago Checkout Pro.
 *
 * @param {Object}   params
 * @param {Array}    params.items    Items del carrito: { productId, name, size, quantity, price }
 * @param {number}   params.total    Total del carrito en COP (se valida contra los items)
 * @param {string}   params.orderId  ID del pedido ya creado en Supabase
 */
export async function startMercadoPagoCheckout({ items, total, orderId }) {
  if (!orderId) throw new Error('Falta el order_id del pedido');
  if (!items?.length) throw new Error('El carrito está vacío');

  const computed = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  if (Math.round(computed) !== Math.round(Number(total))) {
    throw new Error('El total no coincide con los productos del carrito');
  }

  // Obtener el origen sin la barra final para evitar URLs mal formadas
  const origin = window.location.origin.replace(/\/$/, '');

  const preference = {
    items: items.map((item) => ({
      id: String(item.productId),
      title: `${item.name} — Talla ${item.size}`,
      quantity: Number(item.quantity),
      unit_price: Number(item.price),
      currency_id: 'COP',
    })),
    external_reference: String(orderId),
    // URLs limpias sin '#/' para cumplir con las reglas estrictas de Mercado Pago Colombia
    back_urls: {
      success: `${origin}/?status=success&order_id=${orderId}`,
      failure: `${origin}/?status=failure`,
      pending: `${origin}/?status=pending&order_id=${orderId}`,
    },
  };

  // Mercado Pago solo acepta auto_return en entornos HTTPS públicos
  const isPublicHttps = origin.startsWith('https://') && !/localhost|127\.0\.0\.1/.test(origin);
  if (isPublicHttps) preference.auto_return = 'approved';

  const response = await fetch('/api/mercadopago', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preference),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.init_point) {
    throw new Error(data.details || data.error || data.message || 'No se pudo generar el checkout');
  }

  // Redirección directa a la pasarela de pago de Mercado Pago
  window.location.href = data.init_point;
}