export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '573043409743';

// Envío gratis desde este valor (solo informativo: el costo de envío NO se suma al total)
export const FREE_SHIPPING_FROM = 300000;

export const SIZES = ['S', 'M', 'L', 'XL'];
// Todos los estados que puede tener un pedido (el admin los elige)
export const ORDER_STATUSES = ['Pendiente', 'Pagado', 'Enviado', 'Entregado', 'Abandonado', 'Reembolsado'];
// Los 4 pasos de la barra de progreso que ve el cliente (Abandonado/Reembolsado se muestran aparte)
export const FLOW_STATUSES = ['Pendiente', 'Pagado', 'Enviado', 'Entregado'];

// Clave pública de Mercado Pago (segura para el navegador). El ACCESS TOKEN nunca va aquí.
export const MERCADOPAGO_PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '';
