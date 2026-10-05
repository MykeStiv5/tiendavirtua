export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '573043409743';

// Envío gratis desde este valor (solo informativo: el costo de envío NO se suma al total)
export const FREE_SHIPPING_FROM = 300000;

export const SIZES = ['S', 'M', 'L', 'XL'];

// Secciones de la tienda: el admin elige en cuáles se publica cada producto
// y el cliente decide cuál mirar. Un producto puede estar en ambas (unisex).
export const SECTIONS = [
  { slug: 'hombre', label: 'Hombre' },
  { slug: 'mujer', label: 'Mujer' },
];
export const SECTION_SLUGS = SECTIONS.map((s) => s.slug);
// Todos los estados que puede tener un pedido (el admin los elige)
export const ORDER_STATUSES = ['Pendiente', 'Pagado', 'Enviado', 'Entregado', 'Abandonado', 'Reembolsado'];
// Los 4 pasos de la barra de progreso que ve el cliente (Abandonado/Reembolsado se muestran aparte)
export const FLOW_STATUSES = ['Pendiente', 'Pagado', 'Enviado', 'Entregado'];

// Clave pública de Mercado Pago (segura para el navegador). El ACCESS TOKEN nunca va aquí.
export const MERCADOPAGO_PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '';
