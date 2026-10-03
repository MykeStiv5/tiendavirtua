import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  console.warn('[AREA 11] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en tu archivo .env');
}

// Valores de relleno para que la app cargue aunque aún no hayas configurado el .env
export const supabase = createClient(
  url || 'http://localhost:54321',
  anonKey || 'public-anon-key-missing',
);
