import { MercadoPagoConfig, Preference } from 'mercadopago';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Falta MERCADOPAGO_ACCESS_TOKEN en las variables de entorno' });
    }

    const client = new MercadoPagoConfig({ accessToken: token });
    const preference = new Preference(client);

    const { items, external_reference, back_urls, auto_return } = req.body;

    // Formatear items asegurando datos numéricos y currency_id
    const formattedItems = (items || []).map((item) => ({
      id: String(item.id || 'prod'),
      title: String(item.title || 'Producto'),
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || item.price),
      currency_id: 'COP',
    }));

    const result = await preference.create({
      body: {
        items: formattedItems,
        external_reference: String(external_reference || Date.now()),
        back_urls: back_urls || {
          success: 'https://tiendavirtuafi.vercel.app',
          failure: 'https://tiendavirtuafi.vercel.app',
          pending: 'https://tiendavirtuafi.vercel.app',
        },
        auto_return: auto_return || 'approved',
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 36,
        },
      },
    });

    return res.status(200).json({
      id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
    });
  } catch (error) {
    console.error('Error al crear preferencia:', error);
    return res.status(500).json({
      error: 'Error interno en Mercado Pago',
      details: error.message,
    });
  }
}