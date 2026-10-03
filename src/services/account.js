import { supabase } from '../lib/supabase';

export async function signUpBuyer({ name, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  return data; // data.session es null si Supabase exige confirmar el correo
}

export async function signInBuyer(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export const signOutBuyer = () => supabase.auth.signOut();

/** Pedidos del comprador (la política RLS solo deja ver los suyos). */
export async function fetchMyOrders(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_code, status, total, shipping_cost, tracking_guide, created_at, updated_at, refunded_at, refund_note, ' +
        'order_items(quantity, size, price, products(name, image_url))',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Registra la solicitud de recuperación y avisa al dueño por correo (el cambio lo hace el admin). */
export async function requestRecovery({ email, honeypot, startedAt }) {
  const response = await fetch('/api/recovery-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, company_url: honeypot, elapsed: Date.now() - startedAt }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No pudimos registrar la solicitud.');
}

export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
