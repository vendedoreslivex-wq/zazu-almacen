-- =====================================================
-- LogixZazu — flujo de aprobacion para ajustes de inventario
--
-- Antes: cualquier usuario con permiso 'adjustments' aplicaba el
-- cambio de stock al instante via execute_adjustment().
--
-- Ahora: los ajustes quedan en estado PENDING al crearse (no tocan
-- stock_levels). Solo ADMIN_GENERAL puede aprobarlos (aplica el
-- cambio real de stock) o rechazarlos (queda como registro, sin
-- efecto en stock). Los ajustes ya existentes se marcan APPROVED
-- para no reescribir el historial.
-- =====================================================

BEGIN;

ALTER TABLE inventory_adjustments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'APPROVED'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Registros historicos (previos a esta migracion) ya estan aplicados
-- a stock_levels, por lo tanto quedan APPROVED (valor por defecto).

-- =====================================================
-- RPC: request_adjustment
-- Crea la solicitud en PENDING. NO modifica stock_levels.
-- =====================================================
CREATE OR REPLACE FUNCTION request_adjustment(
  p_brand text,
  p_product_id text,
  p_location_id text,
  p_previous_quantity integer,
  p_new_quantity integer,
  p_reason text,
  p_notes text,
  p_user_name text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_adj_id uuid;
BEGIN
  INSERT INTO inventory_adjustments (
    brand, product_id, location_id, previous_quantity, new_quantity,
    reason, notes, user_name, status
  ) VALUES (
    p_brand, p_product_id, p_location_id, p_previous_quantity, p_new_quantity,
    p_reason, p_notes, p_user_name, 'PENDING'
  ) RETURNING id INTO v_adj_id;

  RETURN v_adj_id;
END;
$$;

-- =====================================================
-- RPC: approve_adjustment
-- Solo ADMIN_GENERAL. Aplica el cambio real de stock y marca APPROVED.
-- =====================================================
CREATE OR REPLACE FUNCTION approve_adjustment(
  p_adjustment_id uuid,
  p_reviewer_name text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_adj record;
BEGIN
  IF get_my_role() <> 'ADMIN_GENERAL' THEN
    RAISE EXCEPTION 'Solo ADMIN_GENERAL puede aprobar ajustes';
  END IF;

  SELECT * INTO v_adj FROM inventory_adjustments WHERE id = p_adjustment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ajuste no encontrado';
  END IF;
  IF v_adj.status <> 'PENDING' THEN
    RAISE EXCEPTION 'El ajuste ya fue revisado';
  END IF;

  IF v_adj.new_quantity > 0 THEN
    INSERT INTO stock_levels (brand, product_id, location_id, quantity)
    VALUES (v_adj.brand, v_adj.product_id, v_adj.location_id, v_adj.new_quantity)
    ON CONFLICT (brand, product_id, location_id)
    DO UPDATE SET quantity = excluded.quantity, updated_at = now();
  ELSE
    DELETE FROM stock_levels
    WHERE brand = v_adj.brand AND product_id = v_adj.product_id AND location_id = v_adj.location_id;
  END IF;

  UPDATE inventory_adjustments
  SET status = 'APPROVED', reviewed_by = p_reviewer_name, reviewed_at = now()
  WHERE id = p_adjustment_id;
END;
$$;

-- =====================================================
-- RPC: reject_adjustment
-- Solo ADMIN_GENERAL. No modifica stock, marca REJECTED.
-- =====================================================
CREATE OR REPLACE FUNCTION reject_adjustment(
  p_adjustment_id uuid,
  p_reviewer_name text,
  p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF get_my_role() <> 'ADMIN_GENERAL' THEN
    RAISE EXCEPTION 'Solo ADMIN_GENERAL puede rechazar ajustes';
  END IF;

  UPDATE inventory_adjustments
  SET status = 'REJECTED', reviewed_by = p_reviewer_name, reviewed_at = now(), rejection_reason = p_reason
  WHERE id = p_adjustment_id AND status = 'PENDING';
END;
$$;

COMMIT;
