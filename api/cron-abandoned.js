// GET /api/cron-abandoned — lo llama Vercel Cron una vez al día (ver vercel.json).
//  1) Pedidos en "Pendiente" con más de ABANDON_AFTER_HOURS horas → "Abandonado"
//  2) Resumen por correo al dueño
//  3) (opcional) recordatorio automático a cada cliente: ABANDONED_AUTO_REMINDER=true
// Seguridad: exige CRON_SECRET. Vercel lo envía solo como "Authorization: Bearer <CRON_SECRET>".
import { getAdminClient, ORDER_SELECT } from './_orders.js';
import { buildAbandonedCustomerEmail, buildAbandonedDigestEmail, ownerEmail, sendMail } from './_notify.js';

const DEFAULT_SITE_URL = 'https://tiendavirtuafi.vercel.app';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: 'Falta CRON_SECRET en el servidor' });
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'No autorizado' });

  const db = getAdminClient();
  if (!db) return res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' });

  try {
    const hours = Number(process.env.ABANDON_AFTER_HOURS) > 0 ? Number(process.env.ABANDON_AFTER_HOURS) : 24;
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    const { data: stale, error } = await db
      .from('orders')
      .select('id')
      .eq('status', 'Pendiente')
      .lt('created_at', cutoff);
    if (error) throw error;
    if (!stale?.length) return res.status(200).json({ abandoned: 0 });

    // El .eq('status','Pendiente') evita pisar un pago que justo se confirmó
    const { error: updateError } = await db
      .from('orders')
      .update({ status: 'Abandonado' })
      .in('id', stale.map((o) => o.id))
      .eq('status', 'Pendiente');
    if (updateError) throw updateError;

    const { data: orders, error: readError } = await db
      .from('orders')
      .select(ORDER_SELECT)
      .in('id', stale.map((o) => o.id))
      .eq('status', 'Abandonado');
    if (readError) throw readError;

    const site = String(process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
    await sendMail({ to: ownerEmail(), ...buildAbandonedDigestEmail(orders, site) });

    let reminded = 0;
    if (process.env.ABANDONED_AUTO_REMINDER === 'true') {
      for (const order of orders) {
        const to = String(order.client_info?.email || '').trim();
        if (!EMAIL_RE.test(to)) continue;
        if (await sendMail({ to, ...buildAbandonedCustomerEmail(order, site) })) {
          await db.from('orders').update({ reminder_sent_at: new Date().toISOString() }).eq('id', order.id);
          reminded += 1;
        }
      }
    }

    return res.status(200).json({ abandoned: orders.length, reminded });
  } catch (error) {
    console.error('[Cron abandonados]', error);
    return res.status(500).json({ error: 'No se pudo procesar' });
  }
}
