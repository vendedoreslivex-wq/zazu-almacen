-- =====================================================
-- LogixZazu — RPC dispatch_requirement
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Despacha un requerimiento interno (REQUIREMENT):
--   - Genera transacción tipo TRANSFER (Reservas → Stock Despacho)
--   - Descuenta stock de la ubicación origen (reservas)
--   - Suma stock en la ubicación destino (despacho)
--   - Actualiza received_quantity y status del requerimiento
-- =====================================================

create or replace function dispatch_requirement(
  p_po_id      uuid,
  p_user_name  text,
  p_qtys       jsonb   -- [{ product_id, qty, from_location_id }]
) returns void language plpgsql security definer as $$
declare
  v_po         record;
  v_payload    jsonb;
  v_product_id text;
  v_qty        integer;
  v_from_loc   uuid;
  v_total_qty       integer := 0;
  v_total_received  integer := 0;
  v_new_status      text;
begin
  select * into v_po from purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'PO_NOT_FOUND';
  end if;
  if v_po.location_id is null then
    raise exception 'PO_WITHOUT_LOCATION';
  end if;

  for v_payload in select * from jsonb_array_elements(p_qtys) loop
    v_product_id := v_payload->>'product_id';
    v_qty        := (v_payload->>'qty')::integer;
    v_from_loc   := (v_payload->>'from_location_id')::uuid;

    if v_qty is null or v_qty <= 0 then
      continue;
    end if;

    -- Transacción TRANSFER: de reservas → stock despacho
    insert into transactions (
      brand, type, product_id, quantity,
      from_location_id, to_location_id,
      reference, user_name, status
    ) values (
      v_po.brand, 'TRANSFER', v_product_id, v_qty,
      v_from_loc, v_po.location_id,
      v_po.reference, p_user_name, 'COMPLETED'
    );

    -- Descontar de origen (reservas)
    if v_from_loc is not null then
      update stock_levels
        set quantity   = quantity - v_qty,
            updated_at = now()
        where brand = v_po.brand
          and product_id = v_product_id
          and location_id = v_from_loc;
    end if;

    -- Sumar en destino (stock despacho)
    insert into stock_levels (brand, product_id, location_id, quantity)
    values (v_po.brand, v_product_id, v_po.location_id, v_qty)
    on conflict (brand, product_id, location_id) do update
      set quantity   = stock_levels.quantity + excluded.quantity,
          updated_at = now();

    -- Actualizar received_quantity en el ítem
    update purchase_order_items
      set received_quantity = received_quantity + v_qty
      where purchase_order_id = p_po_id
        and product_id = v_product_id;
  end loop;

  -- Recalcular status del requerimiento
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
