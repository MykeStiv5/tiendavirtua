// POST /api/recovery-request  { email, company_url (señuelo), elapsed }
// El cliente pide recuperar su cuenta: se guarda la solicitud y se avisa al dueño por correo.
// El cambio de contraseña lo hace el admin (pestaña CUENTAS) tras hablar con el cliente por WhatsApp.
import crypto from 'node:crypto';
import { getAdminClient } from './_orders.js';
import { readBody } from './_auth.js';
import { buildRecoveryOwnerEmail, ownerEmail, sendMail } from './_notify.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DEFAULT_SITE_URL = 'https://tiendavirtuafi.vercel.app';
const MAX_PER_EMAIL_HOUR = 3;
const MAX_PER_IP_HOUR = 10;

function clientIp(req) {
  return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const body = readBody(req);
  const email = String(body.email || '').trim().toLowerCase();

  // Antispam 1: campo señuelo lleno o formulario enviado en menos de 2 s → es un bot.
  // Se responde "ok" para no darle pistas.
  if (body.company_url || Number(body.elapsed) < 2000) return res.status(200).json({ ok: true });

  if (!EMAIL_RE.test(email) || email.length > 120) {
    return res.status(400).json({ error: 'Escribe un correo válido.' });
  }

  const db = getAdminClient();
  if (!db) return res.status(500).json({ error: 'Configuración incompleta en el servidor' });

  try {
    const ipHash = crypto.createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 32);
    const since = new Date(Date.now() - 3600 * 1000).toISOString();

    // Antispam 2: límites por IP y por correo
    const [{ count: byIp }, { count: byEmail }] = await Promise.all([
      db.from('account_recovery_requests').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since),
      db.from('account_recovery_requests').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since),
    ]);
    if ((byIp ?? 0) >= MAX_PER_IP_HOUR) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Escríbenos directamente por WhatsApp.' });
    }
    if ((byEmail ?? 0) >= MAX_PER_EMAIL_HOUR) {
      return res.status(200).json({ ok: true }); // ya está avisado; no se repite el correo
    }

    const { data: userId } = await db.rpc('find_user_id_by_email', { p_email: email });
    const { error } = await db.from('account_recovery_requests').insert({ email, ip_hash: ipHash });
    if (error) throw error;

    const site = String(process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
    await sendMail({ to: ownerEmail(), ...buildRecoveryOwnerEmail({ email, accountExists: Boolean(userId) }, site) });

    // No se revela si la cuenta existe: la respuesta es siempre la misma.
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[Recuperación] Error:', error);
    return res.status(500).json({ error: 'No pudimos registrar la solicitud. Escríbenos por WhatsApp.' });
  }
}
