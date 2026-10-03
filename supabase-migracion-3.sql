-- ============================================================
-- AREA 11 — Migración 3
--   · Estados nuevos: Abandonado y Reembolsado (reembolso manual)
--   · Pedidos abandonados (recordatorios)
--   · Solicitudes de recuperación de cuenta (por WhatsApp)
--   · Antispam: límites en create_order y newsletter real
--   · Categoría "Tenis" de ejemplo
-- Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de supabase.sql y migracion-2.
-- Es seguro repetirla.
-- ============================================================

-- 1) Estados nuevos + columnas ------------------------------------------------
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('Pendiente','Pagado','Enviado','Entregado','Abandonado','Reembolsado'));

alter table public.orders add column if not exists abandoned_at     timestamptz;
alter table public.orders add column if not exists reminder_sent_at timestamptz;
alter table public.orders add column if not exists refunded_at      timestamptz;
alter table public.orders add column if not exists refund_note      text;  -- se envía al cliente en el correo

-- 2) Trigger de stock ---------------------------------------------------------
-- Stock descontado = pedido en Pagado / Enviado / Entregado.
--   · Entra a ese grupo  → descuenta stock
--   · Sale de ese grupo (Reembolsado) → devuelve el stock
--   · Pendiente ↔ Abandonado no toca el stock
create or replace function public.orders_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid constant text[] := array['Pagado','Enviado','Entregado'];
  was_paid boolean := old.status = any (v_paid);
  is_paid  boolean := new.status = any (v_paid);
begin
  new.updated_at := now();

  if new.status = 'Reembolsado' and not was_paid and old.status <> 'Reembolsado' then
    raise exception 'Solo se puede reembolsar un pedido que ya fue pagado';
  end if;

  if not was_paid and is_paid then
    update public.products p
       set stock = greatest(p.stock - oi.quantity, 0)
      from public.order_items oi
     where oi.order_id = new.id and oi.product_id = p.id;
  elsif was_paid and not is_paid then
    update public.products p
       set stock = p.stock + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id and oi.product_id = p.id;
  end if;

  if new.status = 'Abandonado' and old.status <> 'Abandonado' then
    new.abandoned_at := now();
  end if;
  if new.status = 'Reembolsado' and old.status <> 'Reembolsado' then
    new.refunded_at := now();
  end if;

  return new;
end;
$$;

-- 3) create_order con validación y límite antispam ----------------------------
create or replace function public.create_order(p_client jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_code     text;
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
  v_item     jsonb;
  v_product  public.products%rowtype;
  v_qty      int;
  v_size     text;
  v_tries    int := 0;
  v_email    text := lower(trim(coalesce(p_client->>'email', '')));
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'Demasiados productos en un pedido';
  end if;

  -- Validación básica de datos del cliente
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or length(v_email) > 120 then
    raise exception 'Correo inválido';
  end if;
  if length(coalesce(p_client->>'name', '')) > 120
     or length(coalesce(p_client->>'address', '')) > 200
     or length(coalesce(p_client->>'city', '')) > 80
     or length(coalesce(p_client->>'phone', '')) > 30 then
    raise exception 'Datos del cliente demasiado largos';
  end if;

  -- Antispam: máximo 5 pedidos pendientes por correo en la última hora
  if (select count(*) from public.orders
       where status = 'Pendiente'
         and lower(client_info->>'email') = v_email
         and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Demasiados intentos. Espera un rato o escríbenos por WhatsApp.';
  end if;

  loop
    v_code := 'ORD-' || lpad((floor(random() * 100000))::int::text, 5, '0');
    exit when not exists (select 1 from public.orders where order_code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 25 then
      raise exception 'No se pudo generar el código del pedido';
    end if;
  end loop;

  insert into public.orders (order_code, client_info, total, status, user_id)
  values (v_code, coalesce(p_client, '{}'::jsonb), 0, 'Pendiente', auth.uid())
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty  := (v_item->>'quantity')::int;
    v_size := v_item->>'size';

    if v_qty is null or v_qty < 1 or v_qty > 20 then
      raise exception 'Cantidad inválida';
    end if;

    select * into v_product from public.products where id = (v_item->>'product_id')::uuid;
    if not found then
      raise exception 'Producto no encontrado';
    end if;
    if v_product.stock < v_qty then
      raise exception 'Stock insuficiente para %', v_product.name;
    end if;
    if v_size is null or not (v_size = any (v_product.sizes)) then
      raise exception 'Talla no disponible para %', v_product.name;
    end if;

    insert into public.order_items (order_id, product_id, quantity, size, price)
    values (v_order_id, v_product.id, v_qty, v_size, v_product.price);

    v_subtotal := v_subtotal + v_product.price * v_qty;
  end loop;

  v_shipping := public.quote_shipping(p_client->>'city', v_subtotal);

  update public.orders
     set total = v_subtotal + v_shipping,
         shipping_cost = v_shipping
   where id = v_order_id;

  return jsonb_build_object(
    'id', v_order_id,
    'order_code', v_code,
    'subtotal', v_subtotal,
    'shipping_cost', v_shipping,
    'total', v_subtotal + v_shipping
  );
end;
$$;

grant execute on function public.create_order(jsonb, jsonb) to anon, authenticated;

-- 4) Solicitudes de recuperación de cuenta ------------------------------------
-- La tienda NO escribe aquí directamente: lo hace /api/recovery-request con la service_role.
create table if not exists public.account_recovery_requests (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  ip_hash     text,
  status      text not null default 'Pendiente' check (status in ('Pendiente','Resuelta')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists recovery_email_idx on public.account_recovery_requests(lower(email), created_at desc);
create index if not exists recovery_ip_idx    on public.account_recovery_requests(ip_hash, created_at desc);

alter table public.account_recovery_requests enable row level security;
drop policy if exists "recovery_admin_all" on public.account_recovery_requests;
create policy "recovery_admin_all" on public.account_recovery_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- Busca el id de un usuario por correo. SOLO la service_role (servidor) puede llamarla.
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
stable
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

-- 5) Newsletter real (con límite antispam) ------------------------------------
create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
drop policy if exists "newsletter_admin_read" on public.newsletter_subscribers;
create policy "newsletter_admin_read" on public.newsletter_subscribers
  for select using (public.is_admin());

create or replace function public.subscribe_newsletter(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or length(v_email) > 120 then
    raise exception 'Correo inválido';
  end if;
  -- Freno global: máximo 60 altas por minuto (evita inundar la tabla con un script)
  if (select count(*) from public.newsletter_subscribers where created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Intenta de nuevo en un minuto';
  end if;
  insert into public.newsletter_subscribers (email) values (v_email) on conflict (email) do nothing;
end;
$$;

grant execute on function public.subscribe_newsletter(text) to anon, authenticated;

-- 6) Categoría de ejemplo para calzado ----------------------------------------
-- Las tallas se escriben A MANO en cada producto (36, 37, 38.5…), no dependen de la categoría.
insert into public.categories (name, slug) values ('Tenis', 'tenis') on conflict (slug) do nothing;
