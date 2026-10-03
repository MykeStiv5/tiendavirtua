// Verifica que quien llama a un endpoint de administración sea un admin real.
// El navegador envía su token de sesión de Supabase en "Authorization: Bearer ...".
import { getAdminClient } from './_orders.js';

export async function verifyAdmin(req) {
  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  const db = getAdminClient();
  if (!db) return null;

  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: admin } = await db.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  return admin ? { db, user: data.user } : null;
}

/** Lee el body JSON venga como objeto o como texto. */
export function readBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body || {};
}
