// Antispam ligero (sin captcha): campo señuelo + tiempo mínimo de llenado.
// Frena a los bots simples. Los límites reales (por correo / IP) viven en el servidor y en Supabase,
// porque un script puede saltarse el formulario y llamar a la API directamente.
export const MIN_FILL_MS = 2000;

export function looksLikeBot(honeypotValue, startedAt) {
  return Boolean(honeypotValue) || Date.now() - startedAt < MIN_FILL_MS;
}
