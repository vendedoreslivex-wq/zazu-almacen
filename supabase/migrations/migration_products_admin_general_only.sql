-- =====================================================
-- LogixZazu — restringir edicion/eliminacion de productos a ADMIN_GENERAL
--
-- El frontend (Inventory.tsx) ahora solo muestra los botones de
-- editar/eliminar SKU a usuarios con role = 'ADMIN_GENERAL'. Sin
-- este cambio de RLS, un usuario CEO o ADMINISTRADOR podria seguir
-- editando/eliminando productos llamando directamente a la API de
-- Supabase, ya que la politica anterior permitia UPDATE a los tres
-- roles y DELETE a ADMIN_GENERAL/CEO.
-- =====================================================

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products
  FOR UPDATE
  USING (get_my_role() = 'ADMIN_GENERAL')
  WITH CHECK (get_my_role() = 'ADMIN_GENERAL');

DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products
  FOR DELETE USING (get_my_role() = 'ADMIN_GENERAL');
