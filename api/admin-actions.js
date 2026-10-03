// POST /api/admin-actions  (solo administradores, con el token de sesión en Authorization)
//   { action: 'reset-password',   email, password, requestId? }
//   { action: 'remind-abandoned', orderId }
//   { action: 'notify-refund',    orderId }
import { readBody, verifyAdmin } from './_auth.js';
import { ORDER_SELECT } from './_orders.js';
import {
  buildAbandonedCustomerEmail,
  buildRefundCustomerEmail,
  buildRefundOwnerEmail,
  ownerEmail,
  sendMail,
} from './_notify.js';

const DEFAULT_SITE_URL = 'https://tiendavirtuafi.vercel.app';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const siteUrl = () => String(process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

async function loadOrder(db, orderId) {
  if (!UUID_RE.test(String(orderId || ''))) return null;
  const { data } = await db
    .from('orders')
    .select(`${ORDER_SELECT}, refund_note, reminder_sent_at`)
    .eq('id', orderId)
    .maybeSingle();
  return data;
}

const actions = {
  async 'reset-password'({ db }, body) {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!EMAIL_RE.test(email)) return [400, { error: 'Correo inválido' }];
    if (password.length < 8) return [400, { error: 'La contraseña debe tener al menos 8 caracteres' }];

    const { data: userId, error: findError } = await db.rpc('find_user_id_by_email', { p_email: email });
    if (findError) throw findError;
    if (!userId) return [404, { error: 'No existe ninguna cuenta con ese correo' }];

    const { error } = await db.auth.admin.updateUserById(userId, { password });
    if (error) throw error;

    // Cierra las solicitudes pendientes de ese correo
    await db
      .from('account_recovery_requests')
      .update({ status: 'Resuelta', resolved_at: new Date().toISOString() })
      .eq('email', email)
      .eq('status', 'Pendiente');

    return [200, { ok: true }];
  },

  async 'remind-abandoned'({ db }, body) {
    const order = await loadOrder(db, body.orderId);
    if (!order) return [404, { error: 'Pedido no encontrado' }];
    if (!['Pendiente', 'Abandonado'].includes(order.status)) {
      return [409, { error: 'Solo se recuerdan pedidos pendientes o abandonados' }];
    }
    const customer = String(order.client_info?.email || '').trim();
    if (!EMAIL_RE.test(customer)) return [400, { error: 'El pedido no tiene un correo válido' }];

    const sent = await sendMail({ to: customer, ...buildAbandonedCustomerEmail(order, siteUrl()) });
    if (!sent) return [502, { error: 'No se pudo enviar el correo (revisa SMTP_USER y SMTP_PASS)' }];

    await db.from('orders').update({ reminder_sent_at: new Date().toISOString() }).eq('id', order.id);
    return [200, { ok: true }];
  },

  async 'notify-refund'({ db }, body) {
    const order = await loadOrder(db, body.orderId);
    if (!order) return [404, { error: 'Pedido no encontrado' }];
    if (order.status !== 'Reembolsado') return [409, { error: 'El pedido no está marcado como Reembolsado' }];

    const site = siteUrl();
    const customer = String(order.client_info?.email || '').trim();
    const jobs = [sendMail({ to: ownerEmail(), ...buildRefundOwnerEmail(order, site) })];
    if (EMAIL_RE.test(customer)) jobs.push(sendMail({ to: customer, ...buildRefundCustomerEmail(order, site) }));
    const results = await Promise.all(jobs);

    return [200, { ok: true, emailed: results.every(Boolean) }];
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const ctx = await verifyAdmin(req);
  if (!ctx) return res.status(401).json({ error: 'No autorizado' });

  const body = readBody(req);
  const run = actions[body.action];
  if (!run) return res.status(400).json({ error: 'Acción desconocida' });

  try {
    const [status, data] = await run(ctx, body);
    return res.status(status).json(data);
  } catch (error) {
    console.error('[Admin]', body.action, error);
    return res.status(500).json({ error: error.message || 'Error del servidor' });
  }
}
