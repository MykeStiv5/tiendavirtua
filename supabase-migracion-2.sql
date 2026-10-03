-- ============================================================
-- AREA 11 — Migración 2: costo de envío + perfil de comprador
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirla.
-- ============================================================

-- 1) Nuevas columnas en orders
alter table public.orders add column if not exists shipping_cost numeric(12,0) not null default 0;
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists orders_user_idx on public.orders(user_id);

-- 2) TARIFAS DE ENVÍO (único lugar donde se editan los valores)
--    Gratis desde $300.000 · Bogotá $12.000 · resto del país $18.000
create or replace function public.quote_shipping(p_city text, p_subtotal numeric)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_city text := translate(lower(trim(coalesce(p_city, ''))), 'áéíóúü', 'aeiouu');
begin
  if coalesce(p_subtotal, 0) >= 300000 then
    return 0;
  end if;

  if v_city in ('bogota', 'bogota d.c.', 'bogota dc', 'bogota d c') then
    return 12000;
  end if;

  return 18000;
end;
$$;

grant execute on function public.quote_shipping(text, numeric) to anon, authenticated;

-- 3) create_order ahora suma el envío y guarda el comprador (si inició sesión)
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

  insert into public.orders (order_code, client_info, total, status, user_id)
  values (v_code, coalesce(p_client, '{}'::jsonb), 0, 'Pendiente', auth.uid())
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

-- 4) Cada comprador puede ver SOLO sus pedidos (el admin sigue viendo todos)
drop policy if exists "orders_owner_read" on public.orders;
create policy "orders_owner_read" on public.orders
  for select using (user_id = auth.uid());

drop policy if exists "order_items_owner_read" on public.order_items;
create policy "order_items_owner_read" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );
