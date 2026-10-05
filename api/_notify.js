// Correos de la tienda (SMTP con nodemailer): aviso de venta al dueño y confirmación al cliente.
// Variables: SMTP_USER, SMTP_PASS (obligatorias), SMTP_HOST, SMTP_PORT, MAIL_FROM, OWNER_EMAIL (opcionales).
import nodemailer from 'nodemailer';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const cop = (n) => `$ ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(n) || 0)} COP`;

export function getTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function itemsTable(order) {
  const rows = (order.order_items || [])
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${esc(i.quantity)}× ${esc(i.products?.name || 'Producto')} (talla ${esc(i.size)}${i.color ? `, ${esc(i.color)}` : ''})</td>` +
        `<td style="padding:6px 0;text-align:right">${cop(i.price * i.quantity)}</td></tr>`,
    )
    .join('');
  const subtotal = (order.order_items || []).reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
  return (
    `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}` +
    `<tr><td style="padding:6px 0;border-top:1px solid #ddd">Subtotal</td><td style="padding:6px 0;border-top:1px solid #ddd;text-align:right">${cop(subtotal)}</td></tr>` +
    `<tr><td style="padding:6px 0">Envío</td><td style="padding:6px 0;text-align:right">${Number(order.shipping_cost) > 0 ? cop(order.shipping_cost) : 'Gratis'}</td></tr>` +
    `<tr><td style="padding:6px 0"><strong>Total</strong></td><td style="padding:6px 0;text-align:right"><strong>${cop(order.total)}</strong></td></tr></table>`
  );
}

export function buildOwnerEmail(order, site) {
  const c = order.client_info || {};
  return {
    subject: `Nueva venta ${order.order_code} — ${cop(order.total)}`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">` +
      `<h2 style="margin:0 0 12px">Nueva venta pagada · ${esc(order.order_code)}</h2>` +
      `<p style="margin:0 0 16px">Ya puedes preparar el despacho.</p>` +
      itemsTable(order) +
      `<h3 style="margin:24px 0 8px">Datos de envío</h3>` +
      `<p style="margin:0;line-height:1.6">${esc(c.name)}<br>Tel: ${esc(c.phone)}<br>${esc(c.email)}<br>${esc(c.address)}, ${esc(c.city)}</p>` +
      `<p style="margin:24px 0 0"><a href="${esc(site)}/#/admin">Abrir el admin</a> para poner la guía de envío.</p></div>`,
  };
}

export function buildCustomerEmail(order, site) {
  const c = order.client_info || {};
  const code = encodeURIComponent(order.order_code);
  return {
    subject: `Recibimos tu pago — pedido ${order.order_code} | AREA 11`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">` +
      `<h2 style="margin:0 0 12px">¡Gracias por tu compra, ${esc(String(c.name || '').split(' ')[0])}!</h2>` +
      `<p>Confirmamos tu pago. Tu código de pedido es <strong>${esc(order.order_code)}</strong>.</p>` +
      itemsTable(order) +
      `<p style="margin:20px 0 4px"><strong>Enviaremos a:</strong> ${esc(c.address)}, ${esc(c.city)}</p>` +
      `<p><a href="${esc(site)}/#/track?order_id=${code}">Seguir mi pedido</a> · <a href="${esc(site)}/#/account">Mi cuenta</a></p>` +
      `<p style="color:#666;font-size:12px">Si tienes dudas, responde este correo o escríbenos por WhatsApp.</p></div>`,
  };
}

/** Envía el aviso al dueño y la confirmación al cliente. Nunca lanza: un fallo de correo no debe romper el webhook. */
export async function sendOrderEmails(order, site) {
  const transport = getTransport();
  if (!transport) {
    console.warn('[Correo] Falta SMTP_USER / SMTP_PASS: no se enviaron correos.');
    return;
  }

  const from = process.env.MAIL_FROM || `AREA 11 <${process.env.SMTP_USER}>`;
  const owner = process.env.OWNER_EMAIL || process.env.SMTP_USER;
  const customer = String(order.client_info?.email || '').trim();

  const jobs = [{ to: owner, ...buildOwnerEmail(order, site), label: 'dueño' }];
  if (EMAIL_RE.test(customer)) jobs.push({ to: customer, ...buildCustomerEmail(order, site), label: 'cliente' });

  for (const { label, ...mail } of jobs) {
    try {
      await transport.sendMail({ from, ...mail });
      console.log(`[Correo] enviado al ${label}`, order.order_code);
    } catch (error) {
      console.error(`[Correo] falló el envío al ${label}:`, error.message);
    }
  }
}

/** Envío genérico. Nunca lanza. Devuelve true si salió. */
export async function sendMail({ to, subject, html }) {
  const transport = getTransport();
  if (!transport) {
    console.warn('[Correo] Falta SMTP_USER / SMTP_PASS: no se envió:', subject);
    return false;
  }
  const from = process.env.MAIL_FROM || `AREA 11 <${process.env.SMTP_USER}>`;
  try {
    await transport.sendMail({ from, to, subject, html });
    return true;
  } catch (error) {
    console.error('[Correo] falló el envío:', subject, error.message);
    return false;
  }
}

export const ownerEmail = () => process.env.OWNER_EMAIL || process.env.SMTP_USER;
const waNumber = () => process.env.VITE_WHATSAPP_NUMBER || '573043409743';
const wrap = (inner) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">${inner}</div>`;

/** Aviso al dueño: alguien pidió recuperar su cuenta por WhatsApp. */
export function buildRecoveryOwnerEmail({ email, accountExists }, site) {
  return {
    subject: `Recuperación de cuenta solicitada — ${email}`,
    html: wrap(
      `<h2 style="margin:0 0 12px">Solicitud de recuperación de cuenta</h2>` +
        `<p>Correo de la cuenta: <strong>${esc(email)}</strong></p>` +
        `<p>${accountExists ? 'Esa cuenta <strong>existe</strong> en la tienda.' : '⚠️ No existe ninguna cuenta con ese correo (puede ser un error de escritura o un intento de spam).'}</p>` +
        `<p>La persona te escribirá por WhatsApp. Cuando verifiques que es ella, entra a ` +
        `<a href="${esc(site)}/#/admin">Admin → CUENTAS</a> y asigna una contraseña nueva.</p>`,
    ),
  };
}

/** Resumen diario de pedidos que pasaron a Abandonado. */
export function buildAbandonedDigestEmail(orders, site) {
  const rows = orders
    .map((o) => {
      const c = o.client_info || {};
      const phone = String(c.phone || '').replace(/\D/g, '');
      const wa = phone ? ` · <a href="https://wa.me/${phone.length === 10 ? '57' + phone : phone}">WhatsApp</a>` : '';
      return (
        `<tr><td style="padding:8px 0;border-top:1px solid #ddd"><strong>${esc(o.order_code)}</strong> — ${cop(o.total)}<br>` +
        `${esc(c.name)} · ${esc(c.email)} · ${esc(c.phone)}${wa}</td></tr>`
      );
    })
    .join('');
  return {
    subject: `${orders.length} pedido(s) abandonado(s) — AREA 11`,
    html: wrap(
      `<h2 style="margin:0 0 12px">Pedidos abandonados</h2>` +
        `<p>Estos clientes iniciaron el pago pero no lo completaron. Puedes escribirles o enviarles un recordatorio desde ` +
        `<a href="${esc(site)}/#/admin">Admin → PEDIDOS → Abandonados</a>.</p>` +
        `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>`,
    ),
  };
}

/** Recordatorio al cliente que dejó el pago a medias. */
export function buildAbandonedCustomerEmail(order, site) {
  const c = order.client_info || {};
  const first = esc(String(c.name || '').split(' ')[0]);
  return {
    subject: `Dejaste tu pedido a medias — AREA 11`,
    html: wrap(
      `<h2 style="margin:0 0 12px">${first ? first + ', t' : 'T'}u pedido sigue esperándote</h2>` +
        `<p>Vimos que no terminaste el pago. Esto era lo que tenías en tu bolsa:</p>` +
        itemsTable(order) +
        `<p style="margin:20px 0"><a href="${esc(site)}/#/cart" style="background:#111;color:#fff;padding:12px 20px;text-decoration:none">VOLVER A MI BOLSA</a></p>` +
        `<p>¿Tuviste algún problema con el pago? Escríbenos por <a href="https://wa.me/${waNumber()}">WhatsApp</a> y te ayudamos a cerrarlo.</p>` +
        `<p style="color:#666;font-size:12px">El stock es limitado y no se reserva hasta que el pago se confirma.</p>`,
    ),
  };
}

/** Aviso de reembolso (hecho a mano por el admin en Mercado Pago). Va al cliente. */
export function buildRefundCustomerEmail(order, site) {
  const c = order.client_info || {};
  const first = esc(String(c.name || '').split(' ')[0]);
  return {
    subject: `Reembolso de tu pedido ${order.order_code} | AREA 11`,
    html: wrap(
      `<h2 style="margin:0 0 12px">${first ? first + ', r' : 'R'}egistramos el reembolso de tu pedido</h2>` +
        `<p>Pedido <strong>${esc(order.order_code)}</strong> por <strong>${cop(order.total)}</strong>.</p>` +
        (order.refund_note ? `<p><strong>Detalle:</strong> ${esc(order.refund_note)}</p>` : '') +
        `<p>El tiempo en que lo ves reflejado depende de tu banco o medio de pago. ` +
        `Si pasan varios días hábiles y no aparece, escríbenos por <a href="https://wa.me/${waNumber()}">WhatsApp</a>.</p>` +
        `<p><a href="${esc(site)}/#/track?order_id=${encodeURIComponent(order.order_code)}">Ver mi pedido</a></p>`,
    ),
  };
}

/** Copia del reembolso para el dueño (registro). */
export function buildRefundOwnerEmail(order, site) {
  const c = order.client_info || {};
  return {
    subject: `Reembolso registrado ${order.order_code} — ${cop(order.total)}`,
    html: wrap(
      `<h2 style="margin:0 0 12px">Reembolso registrado · ${esc(order.order_code)}</h2>` +
        `<p>Cliente: ${esc(c.name)} · ${esc(c.email)} · ${esc(c.phone)}</p>` +
        `<p>Monto: <strong>${cop(order.total)}</strong>. El stock de los productos fue devuelto.</p>` +
        (order.refund_note ? `<p>Nota: ${esc(order.refund_note)}</p>` : '') +
        `<p style="color:#666;font-size:12px">Recuerda que el dinero se devuelve a mano desde tu panel de Mercado Pago.</p>` +
        `<p><a href="${esc(site)}/#/admin">Abrir el admin</a></p>`,
    ),
  };
}
