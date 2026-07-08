-- =====================================================
-- LogixZazu — permitir a DESPACHADOR crear requerimientos
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- El frontend (PurchaseOrders.tsx, ver commit b9e8350) ya permite
-- a DESPACHADOR crear órdenes tipo REQUIREMENT, pero las políticas
-- RLS de po_insert / poi_insert solo autorizaban a
-- ADMIN_GENERAL / CEO / ADMINISTRADOR. El insert optimista en
-- AppContext.addPurchaseOrder() mostraba el requerimiento en la UI
-- y luego lo revertía en silencio al fallar el INSERT real —
-- el requerimiento nunca quedaba guardado.
--
-- Este fix agrega DESPACHADOR pero restringido a type = 'REQUIREMENT',
-- para que siga sin poder crear órdenes de compra (OC) a proveedores.
-- =====================================================

DROP POLICY IF EXISTS "po_insert" ON purchase_orders;
CREATE POLICY "po_insert" ON purchase_orders
  FOR INSERT WITH CHECK (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR')
    OR (get_my_role() = 'DESPACHADOR' AND type = 'REQUIREMENT')
  );

DROP POLICY IF EXISTS "poi_insert" ON purchase_order_items;
CREATE POLICY "poi_insert" ON purchase_order_items
  FOR INSERT WITH CHECK (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR')
    OR (
      get_my_role() = 'DESPACHADOR'
      AND EXISTS (
        SELECT 1 FROM purchase_orders po
        WHERE po.id = purchase_order_id AND po.type = 'REQUIREMENT'
      )
    )
  );
