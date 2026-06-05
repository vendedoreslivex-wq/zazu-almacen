-- =====================================================
-- LogixZazu — Migración: RECEPCIÓN no modifica stock
--
-- Cambio de comportamiento:
--   RECEPCIÓN → solo registra la transacción históricamente.
--              NO suma al stock_levels.
--   DESPACHO  → descuenta del stock (sin cambio).
--   TRASLADO  → mueve entre almacenes (sin cambio).
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

create or replace function execute_transaction(
  p_brand text,
  p_type text,
  p_product_id text,
  p_quantity integer,
  p_from_location_id text,
  p_to_location_id text,
  p_reference text,
  p_user_name text,
  p_contact_id uuid,
  p_signature text,
  p_serial_number text,
  p_force_new_entry boolean default false
) returns uuid language plpgsql security definer as $$
declare
  v_tx_id uuid;
  v_current_stock integer;
begin
  -- Validar stock solo para DISPATCH (TRANSFER ya no requiere validación de total)
  if p_type = 'DISPATCH' then
    select quantity into v_current_stock
    from stock_levels
    where brand = p_brand and product_id = p_product_id and location_id = p_from_location_id;

    if coalesce(v_current_stock, 0) < p_quantity then
      raise exception 'STOCK_INSUFICIENTE: disponible=%', coalesce(v_current_stock, 0);
    end if;
  end if;

  if p_type = 'TRANSFER' then
    select quantity into v_current_stock
    from stock_levels
    where brand = p_brand and product_id = p_product_id and location_id = p_from_location_id;

    if coalesce(v_current_stock, 0) < p_quantity then
      raise exception 'STOCK_INSUFICIENTE: disponible=%', coalesce(v_current_stock, 0);
    end if;
  end if;

  -- Insertar transacción (siempre — registro histórico)
  insert into transactions (
    brand, type, product_id, quantity, from_location_id, to_location_id,
    reference, user_name, contact_id, signature, serial_number
  ) values (
    p_brand, p_type, p_product_id, p_quantity,
    p_from_location_id, p_to_location_id,
    p_reference, p_user_name, p_contact_id, p_signature, p_serial_number
  ) returning id into v_tx_id;

  -- RECEPCIÓN: solo registro histórico, NO modifica stock_levels
  -- (el stock se gestiona manualmente vía Ajustes)

  -- DESPACHO: descuenta del stock en el almacén origen
  if p_type = 'DISPATCH' then
    update stock_levels
    set quantity = quantity - p_quantity, updated_at = now()
    where brand = p_brand and product_id = p_product_id and location_id = p_from_location_id;
    delete from stock_levels where brand = p_brand and quantity <= 0;
  end if;

  -- TRASLADO: mueve entre almacenes (no cambia el total de inventario)
  if p_type = 'TRANSFER' then
    update stock_levels
    set quantity = quantity - p_quantity, updated_at = now()
    where brand = p_brand and product_id = p_product_id and location_id = p_from_location_id;
    delete from stock_levels where brand = p_brand and quantity <= 0;
    insert into stock_levels (brand, product_id, location_id, quantity)
    values (p_brand, p_product_id, p_to_location_id, p_quantity)
    on conflict (brand, product_id, location_id)
    do update set quantity = stock_levels.quantity + excluded.quantity, updated_at = now();
  end if;

  return v_tx_id;
end;
$$;
