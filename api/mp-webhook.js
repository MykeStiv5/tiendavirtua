// Webhook de Mercado Pago. Ruta: POST /api/mp-webhook
// Cuando un pago se aprueba: el pedido pasa de "Pendiente" a "Pagado" (el trigger de Supabase
// descuenta el stock) y se envían los correos al dueño y al cliente.
import crypto from 'node:crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getAdminClient, ORDER_SELECT } from './_orders.js';
import { sendOrderEmails } from './_notify.js';

const DEFAULT_SITE_URL = 'https://tiendavirtuafi.vercel.app';

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function getPaymentId(req) {
  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const type = req.query?.type || req.query?.topic || body.type || body.topic;
  const id = req.query?.['data.id'] || req.query?.id || body?.data?.id || body.id;
  return { type, id };
}

/**
 * Valida la cabecera x-signature (HMAC-SHA256) con la clave secreta del webhook.
 * Devuelve true / false, o null si la notificación no trae firma (formato IPN antiguo).
 */
export function checkSignature(headers, dataId, secret) {
  const header = headers['x-signature'];
  if (!header) return null;

  const parts = {};
  for (const piece of String(header).split(',')) {
    const [key, ...rest] = piece.trim().split('=');
    if (key && rest.length) parts[key] = rest.join('=');
  }
  if (!parts.ts || !parts.v1) return false;

  let manifest = '';
  if (dataId) manifest += `id:${String(dataId).toLowerCase()};`;
  if (headers['x-request-id']) manifest += `request-id:${headers['x-request-id']};`;
  manifest += `ts:${parts.ts};`;

  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(parts.v1));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { type, id } = getPaymentId(req);

  // Solo nos interesan los eventos de pago; el resto se confirma sin hacer nada.
  if (type !== 'payment' || !id) return res.status(200).json({ ignored: true });

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (secret) {
    const valid = checkSignature(req.headers, req.query?.['data.id'] || id, secret);
    if (valid === false) {
      console.error('[Webhook] Firma inválida: notificación rechazada');
      return res.status(401).json({ error: 'Firma inválida' });
    }
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const db = getAdminClient();
  if (!token || !db) {
    console.error('[Webhook] Faltan variables: MERCADOPAGO_ACCESS_TOKEN, SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Configuración incompleta en el servidor' });
  }

  try {
    // 1) Consulta el pago real en Mercado Pago: una notificación falsa no sirve de nada
    const client = new MercadoPagoConfig({ accessToken: token, options: { timeout: 10000 } });
    const payment = await new Payment(client).get({ id });

    console.log('[Webhook] pago', payment.id, payment.status, payment.status_detail, payment.external_reference);

    if (payment.status !== 'approved') {
      return res.status(200).json({ received: true, status: payment.status });
    }

    const orderId = String(payment.external_reference || '').trim();
    if (!orderId) return res.status(200).json({ received: true, note: 'Sin external_reference' });

    // 2) Carga el pedido y verifica el monto
    const { data: order, error: readError } = await db
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .maybeSingle();
    if (readError) throw readError;
    if (!order) return res.status(200).json({ received: true, note: 'Pedido no encontrado' });

    if (Math.round(Number(order.total)) !== Math.round(Number(payment.transaction_amount))) {
      console.error('[Webhook] El monto pagado no coincide con el pedido', orderId, order.total, payment.transaction_amount);
      return res.status(200).json({ received: true, note: 'Monto no coincide' });
    }

    // 3) Solo pasa a "Pagado" si seguía en "Pendiente" o "Abandonado" (si el cliente pagó tarde,
    //    el pedido se recupera). Evita duplicar stock y correos.
    const { data: updated, error: updateError } = await db
      .from('orders')
      .update({ status: 'Pagado' })
      .eq('id', orderId)
      .in('status', ['Pendiente', 'Abandonado'])
      .select('id');
    if (updateError) throw updateError;

    if (updated?.length) {
      const site = String(process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
      await sendOrderEmails({ ...order, status: 'Pagado' }, site);
    }

    return res.status(200).json({ received: true, order: orderId, status: 'Pagado' });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    // 500 para que Mercado Pago reintente la notificación más tarde
    return res.status(500).json({ error: 'No se pudo procesar la notificación' });
  }
}
