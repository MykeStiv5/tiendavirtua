-- ============================================================
-- AREA 11 — Esquema de Supabase
-- Ejecútalo completo en: Supabase > SQL Editor > New query > Run
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. TABLAS
-- ------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  price       numeric(12,0) not null check (price >= 0),
  category_id uuid references public.categories(id) on delete set null,
  sizes       text[] not null default '{S,M,L,XL}',
  image_url   text,
  stock       integer not null default 0 check (stock >= 0),
  created_at  timestamptz not null default now()
);

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_code     text not null unique,
  client_info    jsonb not null default '{}'::jsonb,
  total          numeric(12,0) not null default 0,
  status         text not null default 'Pendiente'
                 check (status in ('Pendiente','Pagado','Enviado','Entregado')),
  tracking_guide text,                       -- guía de envío asignada por el admin
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity   integer not null check (quantity > 0),
  size       text,
  price      numeric(12,0) not null
);

create index if not exists products_category_idx on public.products(category_id);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- Administradores: solo los usuarios listados aquí tienen permisos de escritura.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ------------------------------------------------------------
-- 2. FUNCIONES AUXILIARES
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Crea el pedido desde la tienda (visitante anónimo). El total y los precios
-- se calculan en el servidor a partir de la tabla products, no desde el navegador.
create or replace function public.create_order(p_client jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_code     text;
  v_total    numeric := 0;
  v_item     jsonb;
  v_product  public.products%rowtype;
  v_qty      int;
  v_size     text;
  v_tries    int := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;

  loop
    v_code := 'ORD-' || lpad((floor(random() * 100000))::int::text, 5, '0');
    exit when not exists (select 1 from public.orders where order_code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 25 then
      raise exception 'No se pudo generar el código del pedido';
    end if;
  end loop;

  insert into public.orders (order_code, client_info, total, status)
  values (v_code, coalesce(p_client, '{}'::jsonb), 0, 'Pendiente')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty  := (v_item->>'quantity')::int;
    v_size := v_item->>'size';

    if v_qty is null or v_qty < 1 then
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

    v_total := v_total + v_product.price * v_qty;
  end loop;

  update public.orders set total = v_total where id = v_order_id;

  return jsonb_build_object('id', v_order_id, 'order_code', v_code, 'total', v_total);
end;
$$;

-- Rastreo público: devuelve SOLO datos no sensibles de un pedido (por código o id).
create or replace function public.track_order(p_code text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'order_code',     o.order_code,
    'status',         o.status,
    'tracking_guide', o.tracking_guide,
    'total',          o.total,
    'created_at',     o.created_at,
    'updated_at',     o.updated_at
  )
  from public.orders o
  where o.order_code = upper(trim(p_code)) or o.id::text = trim(p_code)
  limit 1;
$$;

grant execute on function public.create_order(jsonb, jsonb) to anon, authenticated;
grant execute on function public.track_order(text)          to anon, authenticated;

-- Al salir de "Pendiente" por primera vez se descuenta el stock; además actualiza updated_at.
create or replace function public.orders_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  if old.status = 'Pendiente' and new.status <> 'Pendiente' then
    update public.products p
       set stock = greatest(p.stock - oi.quantity, 0)
      from public.order_items oi
     where oi.order_id = new.id and oi.product_id = p.id;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_before_update on public.orders;
create trigger orders_before_update
  before update on public.orders
  for each row execute function public.orders_before_update();

-- ------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.categories  enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.admins      enable row level security;

-- Lectura pública de catálogo
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select using (true);

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select using (true);

-- Escritura solo admin
drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- Pedidos: solo admin (la tienda usa create_order / track_order)
drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items_admin_all" on public.order_items;
create policy "order_items_admin_all" on public.order_items
  for all using (public.is_admin()) with check (public.is_admin());

-- Cada usuario puede ver si él mismo es admin
drop policy if exists "admins_read_self" on public.admins;
create policy "admins_read_self" on public.admins for select using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 4. STORAGE (imágenes de productos)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'products');

drop policy if exists "product_images_admin_write" on storage.objects;
create policy "product_images_admin_write" on storage.objects
  for all using (bucket_id = 'products' and public.is_admin())
  with check (bucket_id = 'products' and public.is_admin());

-- ------------------------------------------------------------
-- 5. DATOS DE EJEMPLO (los productos de tu diseño) — opcional
-- ------------------------------------------------------------
insert into public.categories (name, slug) values
  ('Camisetas',  'camisetas'),
  ('Buzos',      'buzos'),
  ('Pantalones', 'pantalones'),
  ('Outerwear',  'outerwear'),
  ('Accesorios', 'accesorios')
on conflict (slug) do nothing;

insert into public.products (name, description, price, category_id, sizes, image_url, stock)
select v.name, v.description, v.price, c.id, '{S,M,L,XL}', v.image_url, v.stock
from (values
  ('Chaqueta Signal 02', 'Silueta relajada de construcción pesada. Diseñada para capas, movimiento y uso diario.', 289900, 'outerwear',
   'https://images.unsplash.com/photo-1554925051-f668ed70d520?auto=format&fit=crop&w=900&q=88', 14),
  ('Hoodie Concrete', 'Buzo de felpa pesada con silueta amplia. Diseñado para moverse.', 219900, 'buzos',
   'https://images.unsplash.com/photo-1612029938221-a01e8c947edb?auto=format&fit=crop&w=900&q=88', 8),
  ('Pantalón Wide Utility', 'Pantalón de corte amplio con bolsillos funcionales y materiales resistentes.', 249900, 'pantalones',
   'https://images.unsplash.com/photo-1711888386245-9ca3477a5977?auto=format&fit=crop&w=900&q=88', 20),
  ('Camiseta Heavy 320', 'Camiseta de algodón de 320 g con caída estructurada.', 129900, 'camisetas',
   'https://images.unsplash.com/photo-1518590713842-629f89f09c9f?auto=format&fit=crop&w=900&q=88', 3)
) as v(name, description, price, slug, image_url, stock)
join public.categories c on c.slug = v.slug
where not exists (select 1 from public.products p where p.name = v.name);

-- ------------------------------------------------------------
-- 6. CREAR EL USUARIO ADMIN (haz esto DESPUÉS de ejecutar lo anterior)
--   a) Authentication > Users > Add user (email + contraseña)
--   b) Authentication > Providers > Email: desactiva "Allow new users to sign up"
--   c) Ejecuta (cambia el correo):
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'tu-correo@ejemplo.com';
-- ------------------------------------------------------------
