-- ============================================================
-- AREA 11 — Migración 4: secciones Hombre / Mujer
-- Ejecútala en: Supabase > SQL Editor > New query > Run
-- (es segura de correr más de una vez)
-- ============================================================

-- Cada producto indica en qué sección(es) se publica.
-- Los productos que ya existen quedan en AMBAS para que no desaparezcan del catálogo;
-- después entras al admin y ajustas cada uno.
alter table public.products
  add column if not exists sections text[] not null default '{hombre,mujer}';

alter table public.products drop constraint if exists products_sections_check;
alter table public.products
  add constraint products_sections_check
  check (cardinality(sections) >= 1 and sections <@ array['hombre','mujer']);

create index if not exists products_sections_idx on public.products using gin (sections);

-- Hombre y Mujer ahora son secciones, no categorías. Si ya habías creado esas dos
-- categorías, bórralas para que no aparezcan duplicadas en el admin (la app igual las oculta).
delete from public.categories where slug in ('hombre', 'mujer');
