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
| Select de estado + guía en pedidos | `onClick={handleSave}` (`OrdersTab.jsx`) | `updateOrder(id, {status, tracking_guide})` |

## 4. Decisiones de seguridad que conviene conocer

- **El token de Mercado Pago no va en el navegador.** La petición a la API se hace desde `api/`.
  Un token en el cliente permitiría a cualquiera crear cobros en tu cuenta; además la API bloquea CORS.
- **Los pedidos no son legibles públicamente.** RLS deja `orders`/`order_items` solo para el admin.
  La tienda usa dos funciones: `create_order` (calcula precios y total en el servidor) y `track_order`
  (devuelve únicamente código, estado, guía, total y fechas).
- **Admin = tabla `admins`**, no "cualquier usuario autenticado".
- El stock se descuenta cuando un pedido sale de *Pendiente* (trigger en SQL).

## 5. Pendientes recomendados (fuera del alcance pedido)

- **Webhook de Mercado Pago**: hoy el estado pasa a *Pagado* manualmente desde el admin.
  Lo ideal es una función `api/mp-webhook.js` que consulte el pago y actualice el pedido con la
  `service_role` key (solo servidor).
- Costo de envío: solo se muestra "GRATIS" desde $300.000; el valor del envío no se suma al total.
- Buscador del header y enlaces de footer (Archivo, Contacto…) son visuales por ahora.
- Newsletter del footer: `Footer.jsx` solo confirma en pantalla; falta conectarlo a un servicio.
