import { supabase } from '../lib/supabase';

/** Llama a /api/admin-actions con el token de la sesión del admin. */
export async function callAdmin(action, payload = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Vuelve a ingresar.');

  const response = await fetch('/api/admin-actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la acción');
  return body;
}

export async function fetchRecoveryRequests() {
  const { data, error } = await supabase
    .from('account_recovery_requests')
    .select('id, email, status, created_at, resolved_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function resolveRecoveryRequest(id) {
  const { error } = await supabase
    .from('account_recovery_requests')
    .update({ status: 'Resuelta', resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
