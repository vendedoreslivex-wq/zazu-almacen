-- =====================================================
-- LogixZazu — RLS Migration v2.1
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Borra TODAS las políticas existentes en cada tabla
-- (sin importar el nombre) y las reemplaza por políticas
-- granulares por rol. Todo corre dentro de una transacción:
-- si algo falla, se hace rollback automático.
--
-- Roles: ADMIN_GENERAL > CEO > ADMINISTRADOR > JEFE_ALMACEN
-- =====================================================

BEGIN;

-- =====================================================
-- HELPER: devuelve el rol del usuario actual
-- SECURITY DEFINER para leer profiles sin recursión RLS
-- =====================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =====================================================
-- BORRAR TODAS LAS POLÍTICAS EXISTENTES
-- Dinámico: elimina cualquier política sin importar el nombre
-- =====================================================
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles',
        'products',
        'locations',
        'contacts',
        'stock_levels',
        'transactions',
        'purchase_orders',
        'purchase_order_items',
        'inventory_adjustments'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- =====================================================
-- PROFILES
-- SELECT: cualquier usuario autenticado ve todos los perfiles
-- UPDATE: cada usuario solo actualiza su propio perfil.
--         ADMIN_GENERAL actualiza otros vía edge function
--         (service_role bypasses RLS).
-- INSERT/DELETE: solo via triggers/service_role.
-- =====================================================
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =====================================================
-- PRODUCTS
-- JEFE_ALMACEN: solo lectura.
-- ADMINISTRADOR+: crear y editar.
-- CEO+: eliminar.
-- =====================================================
CREATE POLICY "products_select" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "products_insert" ON products
  FOR INSERT WITH CHECK (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR')
  );

CREATE POLICY "products_update" ON products
  FOR UPDATE
  USING (get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR'))
  WITH CHECK (get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR'));

CREATE POLICY "products_delete" ON products
  FOR DELETE USING (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO')
  );

-- =====================================================
-- LOCATIONS
-- Misma lógica que products.
-- =====================================================
CREATE POLICY "locations_select" ON locations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "locations_insert" ON locations
  FOR INSERT WITH CHECK (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR')
  );

CREATE POLICY "locations_update" ON locations
  FOR UPDATE
  USING (get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR'))
  WITH CHECK (get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR'));

CREATE POLICY "locations_delete" ON locations
  FOR DELETE USING (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO')
  );

-- =====================================================
-- CONTACTS
-- JEFE_ALMACEN: solo lectura.
-- ADMINISTRADOR+: crear y editar.
-- CEO+: eliminar.
-- =====================================================
CREATE POLICY "contacts_select" ON contacts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "contacts_insert" ON contacts
  FOR INSERT WITH CHECK (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR')
  );

CREATE POLICY "contacts_update" ON contacts
  FOR UPDATE
  USING (get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR'))
  WITH CHECK (get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR'));

CREATE POLICY "contacts_delete" ON contacts
  FOR DELETE USING (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO')
  );

-- =====================================================
-- STOCK_LEVELS
-- Lectura: todos.
-- Escritura directa: solo admins.
-- (Las escrituras normales llegan via RPCs SECURITY DEFINER
--  que bypasean RLS — esta política cubre acceso directo.)
-- =====================================================
CREATE POLICY "stock_levels_select" ON stock_levels
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "stock_levels_insert" ON stock_levels
  FOR INSERT WITH CHECK (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR')
  );

CREATE POLICY "stock_levels_update" ON stock_levels
  FOR UPDATE
  USING (get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR'))
  WITH CHECK (get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR'));

CREATE POLICY "stock_levels_delete" ON stock_levels
  FOR DELETE USING (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR')
  );

-- =====================================================
-- TRANSACTIONS
-- INSERT: todos los roles (operativa diaria de JEFE_ALMACEN).
-- UPDATE: solo admins (cambiar estado a CANCELLED, etc.).
-- DELETE: solo ADMIN_GENERAL (trazabilidad/auditoría).
-- =====================================================
CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "transactions_insert" ON transactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "transactions_update" ON transactions
  FOR UPDATE
  USING (get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR'))
  WITH CHECK (get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR'));

CREATE POLICY "transactions_delete" ON transactions
  FOR DELETE USING (get_my_role() = 'ADMIN_GENERAL');

-- =====================================================
-- PURCHASE_ORDERS
-- INSERT: ADMINISTRADOR+ crea la orden.
-- UPDATE: todos (JEFE_ALMACEN actualiza estado al recibir).
-- DELETE: CEO+.
-- =====================================================
CREATE POLICY "po_select" ON purchase_orders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "po_insert" ON purchase_orders
  FOR INSERT WITH CHECK (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR')
  );

CREATE POLICY "po_update" ON purchase_orders
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "po_delete" ON purchase_orders
  FOR DELETE USING (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO')
  );

-- =====================================================
-- PURCHASE_ORDER_ITEMS
-- Misma lógica que purchase_orders.
-- =====================================================
CREATE POLICY "poi_select" ON purchase_order_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "poi_insert" ON purchase_order_items
  FOR INSERT WITH CHECK (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR')
  );

CREATE POLICY "poi_update" ON purchase_order_items
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "poi_delete" ON purchase_order_items
  FOR DELETE USING (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO')
  );

-- =====================================================
-- INVENTORY_ADJUSTMENTS
-- INSERT: todos (JEFE_ALMACEN hace conteos físicos).
-- UPDATE: no se permite (registros históricos inmutables).
-- DELETE: solo ADMIN_GENERAL.
-- =====================================================
CREATE POLICY "adj_select" ON inventory_adjustments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "adj_insert" ON inventory_adjustments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "adj_delete" ON inventory_adjustments
  FOR DELETE USING (get_my_role() = 'ADMIN_GENERAL');

COMMIT;
