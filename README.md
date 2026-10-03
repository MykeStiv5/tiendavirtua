# AREA 11 — E-commerce (React + Vite + Supabase + Mercado Pago)

Tu HTML/CSS aprobado convertido a componentes React **sin tocar tus clases ni `style.css`**
(`src/styles/style.css` es idéntico al original). Lo único añadido visualmente está en
`src/styles/extra.css` (formulario de checkout, login, modales y botones de acciones del admin).

## 1. Puesta en marcha

```bash
npm install
cp .env.example .env      # completa los valores
npm run dev               # http://localhost:5173
```

### Supabase
1. Crea un proyecto en supabase.com → **SQL Editor** → pega y ejecuta `supabase.sql`.
2. Copia **Project URL** y **anon key** (Settings → API) a `.env`.
3. **Authentication → Users → Add user** (tu correo + contraseña de admin).
4. **Authentication → Providers → Email**: desactiva *Allow new users to sign up*.
5. Autoriza a ese usuario como administrador (SQL Editor):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'tu-correo@ejemplo.com';
   ```
6. Entra a `http://localhost:5173/#/admin`.

### Mercado Pago
- `MERCADOPAGO_ACCESS_TOKEN` es **secreto**: no lleva prefijo `VITE_` y solo lo lee el servidor
  (`api/mercadopago.js` en Vercel, o el proxy incluido en `vite.config.js` durante `npm run dev`).
- Para producción despliega en **Vercel** (la carpeta `api/` se convierte en función serverless) y
  agrega las variables de `.env.example` en *Project Settings → Environment Variables*.
- Variables de servidor extra: `SITE_URL` (URL pública para `back_urls`, por defecto `https://tiendavirtuafi.vercel.app`) y `PAYER_FALLBACK_EMAIL` (opcional).
- El servidor (`api/_forward.js`) construye la preferencia: `currency_id: 'COP'`, sin exclusiones de medios de pago, `installments: 36`, `auto_return: 'approved'`.
- `auto_return` con `localhost` puede ser rechazado por Mercado Pago; prueba el flujo completo
  con la URL pública de despliegue.

## 2. Estructura

```
api/
  mercadopago.js        Función serverless: POST /api/mercadopago
  _forward.js           POST real a api.mercadopago.com/checkout/preferences (con el token)
src/
  lib/supabase.js       Cliente (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
  lib/format.js         COP, fechas, slug, badges
  config.js             WhatsApp, umbral de envío gratis, tallas, estados
  context/CartContext   Carrito + localStorage
  services/             catalog · orders (+WhatsApp) · mercadopago · admin
  hooks/useHashRoute    Router por hash (#/cart, #/track, #/admin, #/product/:id)
  components/           Announcement · Header · Footer · ProductCard
  pages/                Home · ProductPage · Cart · Track
  admin/                Admin (login) · AdminPanel · Products/Categories/Orders tabs
supabase.sql            Tablas, RLS, funciones, storage y datos de ejemplo
```

## 3. Cómo se enlazan los eventos con tu HTML

| Elemento de tu HTML | Evento / prop en React | Qué hace |
|---|---|---|
| `.category` (filtros) | `onClick` → `setActiveSlug(slug)` (`Home.jsx`) | Filtra el catálogo en vivo |
| `.product-card` / `.add-button` | `href="#/product/:id"` | Abre la ficha para elegir talla |
| `.size-selector input[type=radio]` | `checked` + `onChange={() => setSize(s)}` (`ProductPage.jsx`) | Selecciona talla |
| "AÑADIR A LA BOLSA" | `onClick={handleAdd}` | `addItem(product, size)` → localStorage |
| "COMPRAR AHORA" | `onClick={handleBuyNow}` | Agrega y va a `#/cart` |
| `.quantity-selector` − / + | `onClick={() => changeQuantity(key, ±1)}` (`Cart.jsx`) | Cambia cantidad |
| `.bag-item__heading button` (×) | `onClick={() => removeItem(key)}` | Elimina el ítem |
| "PAGAR CON MERCADO PAGO" | `<form onSubmit={handlePay}>` | `createOrder` (estado *Pendiente*) → `startMercadoPagoCheckout` → redirige a `init_point` |
| "PEDIR POR WHATSAPP" | `onClick={handleWhatsApp}` | Abre `wa.me/573043409743?text=…` |
| `.tracking-form` | `onSubmit={handleSubmit}` (`Track.jsx`) | Consulta `track_order(code)` |
| Login admin | `<form onSubmit={handleSubmit}>` (`Admin.jsx`) | `supabase.auth.signInWithPassword` |
| "+ NUEVO PRODUCTO" / "EDITAR" / "ELIMINAR" | `onClick` → modal / `deleteProduct` | CRUD de productos |
| Select de estado + guía / nota de reembolso en pedidos | `onClick={handleSave}` (`OrdersTab.jsx`) | `updateOrder(id, {status, tracking_guide})` |

## 4. Decisiones de seguridad que conviene conocer

- **El token de Mercado Pago no va en el navegador.** La petición a la API se hace desde `api/`.
  Un token en el cliente permitiría a cualquiera crear cobros en tu cuenta; además la API bloquea CORS.
- **Los pedidos no son legibles públicamente.** RLS deja `orders`/`order_items` solo para el admin.
  La tienda usa dos funciones: `create_order` (calcula precios y total en el servidor) y `track_order`
  (devuelve únicamente código, estado, guía, total y fechas).
- **Admin = tabla `admins`**, no "cualquier usuario autenticado".
- El stock se descuenta cuando un pedido sale de *Pendiente* (trigger en SQL).

## 5. Novedades v3 (ejecuta `supabase-migracion-3.sql`)

Orden de los SQL en Supabase: `supabase.sql` → `supabase-migracion-2.sql` → `supabase-migracion-3.sql`.

**Variables nuevas en Vercel:** `CRON_SECRET` (obligatoria para la tarea de abandonados), y opcionales
`ABANDON_AFTER_HOURS` (24) y `ABANDONED_AUTO_REMINDER` (false). Mira `.env.example`.

### Recuperar cuenta por WhatsApp
1. En *Mi cuenta → ¿Olvidaste tu contraseña?* el cliente escribe su correo. Se guarda la solicitud y **te llega un correo**
   (indica si esa cuenta existe o no). Luego se abre WhatsApp con un mensaje listo.
2. Tú verificas que es la persona y entras a **Admin → CUENTAS**: botón *GENERAR* + *CAMBIAR* y *COPIAR MENSAJE PARA WHATSAPP*.
   Es la misma acción que cambiar la contraseña en la base de datos, pero hecha por el servidor con la `service_role`.
3. El cliente puede cambiarla después en *Mi cuenta → Cambiar mi contraseña*.

Alternativa 100 % manual (SQL Editor de Supabase):
```sql
update auth.users set encrypted_password = crypt('NuevaClave123', gen_salt('bf')) where email = 'cliente@correo.com';
```

### Correos que te llegan (a `OWNER_EMAIL`)
Venta pagada (ya existía) · solicitud de recuperación de cuenta · resumen diario de pedidos abandonados · copia de cada reembolso.

### Pedidos abandonados
Un pedido en *Pendiente* por más de 24 h pasa a **Abandonado** (tarea diaria `api/cron-abandoned.js`, configurada en `vercel.json`
a las 8:00 a. m. hora Colombia; el plan Hobby de Vercel solo permite 1 ejecución al día). En **Admin → PEDIDOS → ABANDONADOS**
puedes escribirle por WhatsApp o enviarle un recordatorio por correo. Si el cliente paga tarde, el webhook lo pasa a *Pagado*.
Nota: la bolsa vive en el navegador del cliente; solo cuenta como "pedido" desde que pulsa *Pagar con Mercado Pago*.

### Reembolsos (a mano)
El dinero se devuelve desde tu panel de Mercado Pago. Después, en Admin → PEDIDOS, cambia el estado a **Reembolsado**
(solo se permite desde Pagado/Enviado/Entregado), escribe una nota opcional y guarda. Eso **repone el stock** y envía el correo
de reembolso al cliente (y copia a ti). La nota que escribas **se envía al cliente**.

### Antispam
- Campo señuelo invisible + tiempo mínimo de llenado en: registro, recuperar cuenta, checkout y newsletter.
- Límites en el servidor: 3 solicitudes de recuperación por correo/hora y 10 por IP/hora.
- En Supabase: `create_order` valida el correo y limita a 5 pedidos pendientes por correo/hora; el newsletter (ahora guarda
  en `newsletter_subscribers`) tiene un freno de 60 altas/minuto.
- No incluye captcha. Si algún día hay ataques serios, el siguiente paso es Cloudflare Turnstile (gratis).

### Compartir producto
Botón **COMPARTIR** en la ficha: menú nativo en celular; WhatsApp / Facebook / X / copiar enlace en escritorio. El enlace es
`tudominio.com/p/<id>` (`api/share.js`): muestra foto, nombre y precio en el preview y redirige a la ficha.
Solo funciona desplegado en Vercel o con `npm run dev`; el preview real lo ves al pegar el enlace en WhatsApp ya en producción.

### Tallas de tenis
Cada producto lleva **sus propias tallas, escritas por ti** (Admin → Productos → *Tallas de este producto*): `38, 39, 40`,
con media talla `38.5`. No dependen de la categoría. Se creó la categoría *Tenis* de ejemplo. Limitación actual: el stock es
**un solo número por producto**, no por talla.

## 6. Pendientes recomendados (fuera del alcance pedido)

- Costo de envío: solo se muestra "GRATIS" desde $300.000; el valor del envío no se suma al total.
- Buscador del header y enlaces de footer (Archivo, Contacto…) son visuales por ahora.
- Los correos de newsletter quedan en la tabla `newsletter_subscribers` (se ven en Supabase); falta una pantalla para exportarlos.
- Stock por talla (hoy es un total por producto).
