-- =====================================================
-- LogixZazu — agregar rol LIVEX al constraint de profiles
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- El rol LIVEX se agrego en el frontend (types.ts, permissions.ts)
-- pero nunca se migro el CHECK constraint de profiles.role en la
-- base de datos. Cualquier intento de crear/actualizar un usuario
-- con role = 'LIVEX' violaba el constraint y la Edge Function
-- update-user-auth devolvia un 500 sin mensaje legible.
-- =====================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['ADMIN_GENERAL','CEO','ADMINISTRADOR','JEFE_ALMACEN','DESPACHADOR','LIVEX']));
