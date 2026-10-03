// Función serverless (Vercel). Ruta: POST /api/mercadopago
import { createPreference } from './_forward.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { status, data } = await createPreference(req.body, process.env.MERCADOPAGO_ACCESS_TOKEN);
  return res.status(status).json(data);
}
