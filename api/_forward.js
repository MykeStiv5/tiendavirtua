// Crea la preferencia de Checkout Pro con el SDK oficial de Mercado Pago.
// Se ejecuta SIEMPRE en el servidor (función serverless de Vercel o proxy de Vite en
// desarrollo) porque usa el ACCESS TOKEN secreto. Aquí se construye el body completo
// de la preferencia: el navegador solo envía los datos del pedido, nunca las reglas de pago.
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getAdminClient, ORDER_SELECT } from './_orders.js';

const DEFAULT_SITE_URL = 'https://tiendavirtuafi.vercel.app';
const MIN_UNIT_PRICE_COP = 2000; // el precio unitario debe ser MAYOR a este valor
const MAX_INSTALLMENTS = 36;
const MAX_SHIPPING_COP = 200000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

/** URL pública de producción, sin "/" final. Variable de servidor (sin prefijo VITE_). */
function resolveSiteUrl(siteUrl) {
  return String(siteUrl || process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

/** Normaliza y valida los ítems. COP no tiene decimales: precios y cantidades enteros. */
function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ValidationError('El carrito está vacío');
  }

  return rawItems.map((raw, index) => {
    const unitPrice = Math.round(Number(raw?.price ?? raw?.unit_price));
    const quantity = Math.trunc(Number(raw?.quantity));
    const name = String(raw?.name ?? raw?.title ?? '').trim();

    if (!Number.isFinite(unitPrice) || unitPrice <= MIN_UNIT_PRICE_COP) {
      throw new ValidationError(
        `Precio inválido en el ítem ${index + 1}: debe ser un número mayor a $${MIN_UNIT_PRICE_COP} COP`,
      );
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new ValidationError(`Cantidad inválida en el ítem ${index + 1}`);
    }
    if (!name) {
      throw new ValidationError(`Falta el nombre del ítem ${index + 1}`);
    }

    return {
      id: String(raw?.productId ?? raw?.id ?? `item-${index + 1}`),
      title: raw?.size ? `${name} — Talla ${raw.size}` : name,
      quantity,
      unit_price: unitPrice,
      currency_id: 'COP', // obligatorio para Colombia
    };
  });
}

/** Arma el `payer` (el correo acelera la validación antifraude). */
function buildPayer({ payerEmail, payerName }) {
  const email = String(payerEmail || process.env.PAYER_FALLBACK_EMAIL || '').trim();
  const payer = {};

  if (EMAIL_RE.test(email)) payer.email = email;

  const fullName = String(payerName || '').trim().replace(/\s+/g, ' ');
  if (fullName) {
    const [first, ...rest] = fullName.split(' ');
    payer.name = first;
    if (rest.length) payer.surname = rest.join(' ');
  }
  return payer;
}

/**
 * Construye el body de la preferencia a partir de los datos del pedido.
 * @param {{items:Array, orderId:string, total?:number, payerEmail?:string, payerName?:string}} input
 */
export function buildPreferenceBody(input = {}, options = {}) {
  const orderId = String(input.orderId || '').trim();
  if (!orderId) throw new ValidationError('Falta el order_id del pedido');

  const items = normalizeItems(input.items);

  // El envío viaja como un ítem más (COP sin decimales)
  const shipping = Math.max(0, Math.round(Number(input.shipping) || 0));
  if (shipping > MAX_SHIPPING_COP) throw new ValidationError('Costo de envío inválido');
  if (shipping > 0) {
    items.push({ id: 'envio', title: 'Envío', quantity: 1, unit_price: shipping, currency_id: 'COP' });
  }

  if (input.total !== undefined && input.total !== null) {
    const computed = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    if (computed !== Math.round(Number(input.total))) {
      throw new ValidationError('El total no coincide con los productos del carrito');
    }
  }

  const site = resolveSiteUrl(options.siteUrl);
  const query = encodeURIComponent(orderId);

  const body = {
    items,
    external_reference: orderId,
    payment_methods: {
      // Sin exclusiones: se muestran TODOS los medios habilitados en la cuenta
      excluded_payment_methods: [],
      excluded_payment_types: [],
      installments: MAX_INSTALLMENTS,
    },
    back_urls: {
      success: `${site}/#/track?status=success&order_id=${query}`,
      failure: `${site}/#/cart?status=failure`,
      pending: `${site}/#/track?status=pending&order_id=${query}`,
    },
    auto_return: 'approved',
    // Mercado Pago avisa aquí cuando el pago se aprueba (marca el pedido como Pagado)
    notification_url: `${site}/api/mp-webhook?source_news=webhooks`,
  };

  const payer = buildPayer(input);
  if (Object.keys(payer).length) body.payer = payer;

  return body;
}

export async function createPreference(input, token, options = {}) {
  if (!token) {
    return { status: 500, data: { error: 'Falta MERCADOPAGO_ACCESS_TOKEN en el servidor' } };
  }

  try {
    const body = buildPreferenceBody(input, options);

    const client = new MercadoPagoConfig({
      accessToken: token,
      options: { timeout: 10000 },
    });

    const preference = await new Preference(client).create({ body });

    return {
      status: 200,
      data: {
        id: preference.id,
        init_point: preference.init_point,
        sandbox_init_point: preference.sandbox_init_point,
      },
    };
  } catch (error) {
    console.error('[Mercado Pago] Error al crear la preferencia:', error);
    return {
      status: Number(error?.status) || 500,
      data: {
        message: error?.message || 'No se pudo crear la preferencia de pago',
        cause: error?.cause,
        causes: error?.causes, // detalle real del rechazo de Mercado Pago
      },
    };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Crea la preferencia leyendo el pedido desde Supabase: productos, precios, envío y total salen de la
 * base de datos, no del navegador. Así nadie puede pagar un precio distinto al real.
 */
export async function createPreferenceForOrder(orderId, token, options = {}) {
  const id = String(orderId || '').trim();
  if (!UUID_RE.test(id)) return { status: 400, data: { error: 'Falta el order_id del pedido' } };

  const db = getAdminClient();
  if (!db) {
    return { status: 500, data: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_URL) en el servidor' } };
  }

  const { data: order, error } = await db.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle();
  if (error) {
    console.error('[Mercado Pago] No se pudo leer el pedido:', error);
    return { status: 500, data: { error: 'No se pudo leer el pedido' } };
  }
  if (!order) return { status: 404, data: { error: 'Pedido no encontrado' } };
  if (order.status !== 'Pendiente') return { status: 409, data: { error: 'Este pedido ya fue procesado' } };

  return createPreference(
    {
      orderId: order.id,
      total: order.total,
      shipping: order.shipping_cost,
      payerEmail: order.client_info?.email,
      payerName: order.client_info?.name,
      items: (order.order_items || []).map((i) => ({
        productId: i.product_id,
        name: i.products?.name || 'Producto',
        size: i.size,
        quantity: i.quantity,
        price: i.price,
      })),
    },
    token,
    options,
  );
}
