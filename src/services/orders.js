import { supabase } from '../lib/supabase';
import { WHATSAPP_NUMBER } from '../config';
import { formatCOP } from '../lib/format';

/** Crea el pedido (estado "Pendiente") vía RPC. Devuelve { id, order_code, total }. */
export async function createOrder(clientInfo, cartItems) {
  const items = cartItems.map((i) => ({
    product_id: i.productId,
    quantity: i.quantity,
    size: i.size,
    color: i.color || null,
  }));

  const { data, error } = await supabase.rpc('create_order', {
    p_client: clientInfo,
    p_items: items,
  });
  if (error) throw error;
  return data;
}

/** Consulta pública del estado de un pedido por código (ORD-00000) o id. */
export async function trackOrder(code) {
  const { data, error } = await supabase.rpc('track_order', { p_code: code });
  if (error) throw error;
  return data; // null si no existe
}

/** Enlace wa.me con el pedido formateado. */
export function buildWhatsAppUrl(items, total, client = {}) {
  const lines = items.map(
    (i, idx) =>
      `${idx + 1}. ${i.name} — Talla ${i.size}${i.color ? ` — Color ${i.color}` : ''} x${i.quantity} — ${formatCOP(i.price * i.quantity)}`,
  );

  const message = [
    'Hola AREA 11 👋 Quiero hacer este pedido:',
    '',
    ...lines,
    '',
    `*Total: ${formatCOP(total)}*`,
    '',
    client.name && `Nombre: ${client.name}`,
    client.phone && `Teléfono: ${client.phone}`,
    client.email && `Email: ${client.email}`,
    (client.address || client.city) && `Dirección: ${[client.address, client.city].filter(Boolean).join(', ')}`,
  ]
    .filter((line) => line !== undefined && line !== false && line !== '')
    .join('\n');

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
