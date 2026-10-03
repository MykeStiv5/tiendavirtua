// GET /api/share?id=<uuid>  (también /p/<uuid> vía vercel.json)
// Página mínima con etiquetas Open Graph para que WhatsApp, Facebook, X, etc. muestren
// foto, nombre y precio del producto al pegar el enlace, y que luego redirige a la tienda.
// (La tienda usa rutas con "#", y los previews de redes no ejecutan JavaScript: por eso hace falta esto.)
import { getAdminClient } from './_orders.js';
import { cop, esc } from './_notify.js';

const DEFAULT_SITE_URL = 'https://tiendavirtuafi.vercel.app';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  const site = String(process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const id = String(req.query?.id || '').trim();

  let product = null;
  const db = getAdminClient();
  if (db && UUID_RE.test(id)) {
    const { data } = await db.from('products').select('id, name, description, price, image_url').eq('id', id).maybeSingle();
    product = data;
  }

  if (!product) {
    res.statusCode = 302;
    res.setHeader('Location', site);
    return res.end();
  }

  const target = `${site}/#/product/${product.id}`;
  const title = `${product.name} — AREA 11`;
  const description = `${cop(product.price)} · ${String(product.description || 'Streetwear funcional diseñado en Bogotá.').slice(0, 140)}`;

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(target)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="AREA 11">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(target)}">
${product.image_url ? `<meta property="og:image" content="${esc(product.image_url)}">` : ''}
<meta property="product:price:amount" content="${esc(product.price)}">
<meta property="product:price:currency" content="COP">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body>
<script>location.replace(${JSON.stringify(target).replace(/</g, '\\u003c')});</script>
<p><a href="${esc(target)}">Ver ${esc(product.name)}</a></p>
</body></html>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return res.end(html);
}
