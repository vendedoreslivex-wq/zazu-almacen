-- =====================================================
-- LogixZazu — Migración v2.2: secuencias y RPCs atómicas
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- 1. Tabla guide_counters + RPC next_guide_number
--    → reemplaza localStorage en Operations.tsx
-- 2. RPC cancel_transaction
--    → reemplaza el flujo manual de deleteTransaction (race-free)
-- 3. RPC receive_purchase_order
--    → recepción atómica de OC (todo o nada)
-- =====================================================

BEGIN;

-- =====================================================
-- TABLA: guide_counters (numeración global de guías)
-- =====================================================
create table if not exists guide_counters (
  brand text not null check (brand in ('OVERSHARK','BRAVOS','BOX_PRIME')),
  type text not null check (type in ('RECEPTION','DISPATCH','TRANSFER')),
  next_value bigint not null default 1,
  updated_at timestamptz default now(),
  primary key (brand, type)
);

alter table guide_counters enable row level security;

drop policy if exists "guide_counters_select" on guide_counters;
create policy "guide_counters_select" on guide_counters
  for select using (auth.role() = 'authenticated');

-- INSERT/UPDATE solo a través del RPC SECURITY DEFINER

-- =====================================================
-- RPC: next_guide_number
-- Atomically increments and returns the next formatted guide number.
-- =====================================================
create or replace function next_guide_number(p_brand text, p_type text)
returns text language plpgsql security definer as $$
declare
  v_num bigint;
  v_prefix text;
begin
  if p_brand not in ('OVERSHARK','BRAVOS','BOX_PRIME') then
    raise exception 'Invalid brand: %', p_brand;
  end if;
  if p_type not in ('RECEPTION','DISPATCH','TRANSFER') then
    raise exception 'Invalid type: %', p_type;
  end if;

  with upserted as (
    insert into guide_counters (brand, type, next_value, updated_at)
    values (p_brand, p_type, 2, now())
    on conflict (brand, type) do update
      set next_value = guide_counters.next_value + 1,
          updated_at = now()
    returning next_value
  )
  select next_value - 1 from upserted into v_num;

  v_prefix := case p_type
    when 'RECEPTION' then 'RE'
    when 'DISPATCH'  then 'DE'
    when 'TRANSFER'  then 'TR'
  end;

  return v_prefix || '-' || lpad(v_num::text, 5, '0');
end;
$$;

-- =====================================================
-- RPC: cancel_transaction
-- Atomically marks a transaction as CANCELLED and reverts stock.
-- =====================================================
create or replace function cancel_transaction(p_tx_id uuid)
returns void language plpgsql security definer as $$
declare
  v_tx record;
begin
  select * into v_tx from transactions where id = p_tx_id for update;
  if not found then
    raise exception 'TX_NOT_FOUND';
  end if;
  if v_tx.status = 'CANCELLED' then
    return;
  end if;

  -- Revert stock only if the transaction was COMPLETED
  if v_tx.status = 'COMPLETED' then
    if v_tx.type = 'RECEPTION' and v_tx.to_location_id is not null then
      update stock_levels
      set quantity = greatest(0, quantity - v_tx.quantity), updated_at = now()
      where brand = v_tx.brand
        and product_id = v_tx.product_id
        and location_id = v_tx.to_location_id;
      delete from stock_levels
      where brand = v_tx.brand and quantity <= 0;

    elsif v_tx.type = 'DISPATCH' and v_tx.from_location_id is not null then
      insert into stock_levels (brand, product_id, location_id, quantity)
      values (v_tx.brand, v_tx.product_id, v_tx.from_location_id, v_tx.quantity)
      on conflict (brand, product_id, location_id) do update
        set quantity = stock_levels.quantity + excluded.quantity,
            updated_at = now();

    elsif v_tx.type = 'TRANSFER'
          and v_tx.from_location_id is not null
          and v_tx.to_location_id is not null then
      -- restore origin
      insert into stock_levels (brand, product_id, location_id, quantity)
      values (v_tx.brand, v_tx.product_id, v_tx.from_location_id, v_tx.quantity)
      on conflict (brand, product_id, location_id) do update
        set quantity = stock_levels.quantity + excluded.quantity,
            updated_at = now();
      -- subtract from destination
      update stock_levels
      set quantity = greatest(0, quantity - v_tx.quantity), updated_at = now()
      where brand = v_tx.brand
        and product_id = v_tx.product_id
        and location_id = v_tx.to_location_id;
      delete from stock_levels
      where brand = v_tx.brand and quantity <= 0;
    end if;
  end if;

  update transactions set status = 'CANCELLED' where id = p_tx_id;
end;
$$;

-- =====================================================
-- RPC: receive_purchase_order
-- Atomically receives PO items: creates RECEPTION transactions,
-- bumps received_quantity, recomputes PO status.
--
-- p_qtys: jsonb array of { product_id, qty }
--   ex: '[{"product_id":"p1","qty":5},{"product_id":"p2","qty":3}]'
-- =====================================================
create or replace function receive_purchase_order(
  p_po_id uuid,
  p_user_name text,
  p_qtys jsonb
) returns void language plpgsql security definer as $$
declare
  v_po record;
  v_item record;
  v_qty integer;
  v_product_id text;
  v_payload jsonb;
  v_total_qty integer := 0;
  v_total_received integer := 0;
  v_new_status text;
begin
  select * into v_po from purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'PO_NOT_FOUND';
  end if;
  if v_po.location_id is null then
    raise exception 'PO_WITHOUT_LOCATION';
  end if;

  -- Walk the payload, create RECEPTION tx and increment received_quantity per line.
  for v_payload in select * from jsonb_array_elements(p_qtys) loop
    v_product_id := v_payload->>'product_id';
    v_qty := (v_payload->>'qty')::integer;
    if v_qty is null or v_qty <= 0 then
      continue;
    end if;

    -- Insert the RECEPTION transaction
    insert into transactions (
      brand, type, product_id, quantity,
      from_location_id, to_location_id,
      reference, user_name, contact_id, status
    ) values (
      v_po.brand, 'RECEPTION', v_product_id, v_qty,
      null, v_po.location_id,
      v_po.reference, p_user_name, v_po.supplier_id, 'COMPLETED'
    );

    -- Upsert stock_levels
    insert into stock_levels (brand, product_id, location_id, quantity)
    values (v_po.brand, v_product_id, v_po.location_id, v_qty)
    on conflict (brand, product_id, location_id) do update
      set quantity = stock_levels.quantity + excluded.quantity,
          updated_at = now();

    -- Increment received_quantity on the matching PO item
    update purchase_order_items
    set received_quantity = received_quantity + v_qty
    where purchase_order_id = p_po_id and product_id = v_product_id;
  end loop;

  -- Recompute PO status
  select
    coalesce(sum(quantity), 0),
    coalesce(sum(received_quantity), 0)
  into v_total_qty, v_total_received
  from purchase_order_items
  where purchase_order_id = p_po_id;

  if v_total_received <= 0 then
    v_new_status := v_po.status;
  elsif v_total_received >= v_total_qty then
    v_new_status := 'COMPLETED';
  else
    v_new_status := 'PARTIAL';
  end if;

  update purchase_orders set status = v_new_status where id = p_po_id;
end;
$$;

COMMIT;
