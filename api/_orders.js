// Utilidades de servidor para leer pedidos con la service_role de Supabase.
// NUNCA importes este archivo desde src/ (el navegador no debe ver esa clave).
import { createClient } from '@supabase/supabase-js';

export function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const ORDER_SELECT =
  'id, order_code, total, shipping_cost, status, client_info, created_at, ' +
  'order_items(quantity, size, color, price, product_id, products(name))';
