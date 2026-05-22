-- =====================================================
-- LogixZazu — Migración v2.6: pulido del schema
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- 1. Índices sobre las FKs que Postgres NO crea automáticamente
--    (a diferencia de MySQL). Acelera JOINs y CASCADE deletes.
-- 2. Trigger para mantener stock_levels.updated_at correcto en
--    cualquier UPDATE (no solo los que vienen del RPC).
-- 3. Triggers BEFORE UPDATE que rechazan modificaciones a
--    inventory_adjustments y audit_log — los hacemos inmutables
--    incluso para ADMIN_GENERAL.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ÍNDICES SOBRE FOREIGN KEYS
-- =====================================================
create index if not exists idx_transactions_product on transactions(product_id);
create index if not exists idx_transactions_contact on transactions(contact_id);

create index if not exists idx_poi_po on purchase_order_items(purchase_order_id);
create index if not exists idx_poi_product on purchase_order_items(product_id);

create index if not exists idx_adj_product on inventory_adjustments(product_id);
create index if not exists idx_adj_location on inventory_adjustments(location_id);

create index if not exists idx_stock_product on stock_levels(product_id);
create index if not exists idx_stock_location on stock_levels(location_id);

-- =====================================================
-- 2. stock_levels.updated_at automático
-- =====================================================
create or replace function touch_stock_levels_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists touch_stock_levels_updated_at on stock_levels;
create trigger touch_stock_levels_updated_at
  before update on stock_levels
  for each row execute function touch_stock_levels_updated_at();

-- =====================================================
-- 3. INMUTABILIDAD: inventory_adjustments y audit_log
-- Cualquier UPDATE devuelve error 23514 (consistente con el
-- código que el frontend ya muestra).
-- =====================================================
create or replace function reject_update()
returns trigger language plpgsql as $$
begin
  raise exception 'Tabla % es inmutable; los registros no pueden modificarse.', TG_TABLE_NAME
    using errcode = '23514';
end;
$$;

drop trigger if exists reject_update_inventory_adjustments on inventory_adjustments;
create trigger reject_update_inventory_adjustments
  before update on inventory_adjustments
  for each row execute function reject_update();

drop trigger if exists reject_update_audit_log on audit_log;
create trigger reject_update_audit_log
  before update on audit_log
  for each row execute function reject_update();

COMMIT;
