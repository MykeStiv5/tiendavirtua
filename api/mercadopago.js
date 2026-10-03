// Función serverless (Vercel). Ruta: POST /api/mercadopago
// Body esperado: { orderId } (precios, envío y total se leen de Supabase en el servidor)
// Respuesta:     { id, init_point, sandbox_init_point }
import { createPreferenceForOrder } from './_forward.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  let input = req.body;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      return res.status(400).json({ error: 'JSON inválido' });
    }
  }

  const { status, data } = await createPreferenceForOrder(input?.orderId, process.env.MERCADOPAGO_ACCESS_TOKEN);
  return res.status(status).json(data);
}
