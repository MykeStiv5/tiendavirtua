-- ============================================================
-- AREA 11 — Migración 5: colores por producto
-- Ejecútala en: Supabase > SQL Editor > New query > Run
-- (es segura de correr más de una vez)
--
-- IMPORTANTE: reemplaza la función create_order tomando como base la de
-- supabase-migracion-3.sql. Si la editaste a mano en Supabase, avísame antes de correrla.
-- ============================================================

-- Colores disponibles de cada producto (vacío = sin opción de color)
alter table public.products add column if not exists colors text[] not null default '{}';

-- Color elegido en cada línea del pedido
alter table public.order_items add column if not exists color text;

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
  v_color    text;
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
    v_color := nullif(trim(coalesce(v_item->>'color', '')), '');

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

    -- Si el producto tiene colores, el cliente debe elegir uno de ellos
    if cardinality(v_product.colors) > 0 then
      if v_color is null or not (v_color = any (v_product.colors)) then
        raise exception 'Color no disponible para %', v_product.name;
      end if;
    else
      v_color := null;
    end if;

    insert into public.order_items (order_id, product_id, quantity, size, color, price)
    values (v_order_id, v_product.id, v_qty, v_size, v_color, v_product.price);

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
