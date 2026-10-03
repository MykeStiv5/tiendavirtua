const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export const formatNumber = (value) => number.format(Number(value) || 0);

// "$ 289.900 COP"
export const formatCOP = (value) => `$ ${formatNumber(value)} COP`;

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// "14 JUN · 08:42"
export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}:${mm}`;
}

// Convierte "36, 37, 38.5" o "S M L" en una lista limpia de tallas.
// Separadores: coma, punto y coma o espacio. Decimales con punto (38.5).
// Si todas son numéricas las ordena de menor a mayor; si no, respeta tu orden.
export function parseSizes(text) {
  const unique = [
    ...new Set(
      String(text)
        .split(/[\s,;]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  const allNumeric = unique.every((s) => /^\d+(\.\d+)?$/.test(s));
  return allNumeric ? unique.sort((a, b) => parseFloat(a) - parseFloat(b)) : unique;
}

export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Etiqueta (badge) que se muestra sobre la foto del producto
export function getBadge(product) {
  if (product.stock <= 0) return { label: 'AGOTADO', warning: true };
  if (product.stock <= 5) return { label: 'ÚLTIMAS', warning: true };
  const days = (Date.now() - new Date(product.created_at).getTime()) / 86400000;
  if (days <= 30) return { label: 'NUEVO', warning: false };
  return null;
}

// Número de WhatsApp para wa.me (Colombia: 10 dígitos que empiezan en 3 → antepone 57)
export function waNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 && digits.startsWith('3') ? `57${digits}` : digits;
}
