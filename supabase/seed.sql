-- =====================================================
-- LogixZazu — Usuarios Iniciales
-- Ejecutar DESPUÉS de schema.sql en: Supabase Dashboard → SQL Editor
--
-- SEGURIDAD: Este archivo es solo para crear usuarios en un entorno VACÍO.
-- Las contraseñas abajo son TEMPORALES de primer acceso. Cambiarlas
-- inmediatamente tras el primer login desde Supabase Dashboard → Authentication.
-- NUNCA usar estas contraseñas en otros sistemas.
-- =====================================================

-- Requiere extensión pgcrypto para hashear contraseñas
create extension if not exists pgcrypto;

-- Limpiar usuarios existentes (idempotente — se puede correr múltiples veces)
delete from auth.users where email in (
  'valentino@zazu-org.com',
  'williams@zazu-org.com',
  'ruben@zazu-org.com',
  'benjamin@zazu-org.com'
);

do $$
declare
  uid1 uuid := gen_random_uuid();
  uid2 uuid := gen_random_uuid();
  uid3 uuid := gen_random_uuid();
  uid4 uuid := gen_random_uuid();
begin

  -- ------------------------------------------------
  -- 1. ADMIN GENERAL — valentino@zazu-org.com
  -- ------------------------------------------------
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, role, aud,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    uid1, '00000000-0000-0000-0000-000000000000',
    'valentino@zazu-org.com',
    crypt('CAMBIAR_TRAS_PRIMER_LOGIN', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"VALENTINO","role":"ADMIN_GENERAL","email_personal":"jamesrojasdiaz01@gmail.com"}',
    now(), now(), 'authenticated', 'authenticated', '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid1, 'valentino@zazu-org.com', 'email',
    json_build_object('sub', uid1::text, 'email', 'valentino@zazu-org.com'), now(), now(), now());

  -- ------------------------------------------------
  -- 2. CEO — williams@zazu-org.com
  -- ------------------------------------------------
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, role, aud,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    uid2, '00000000-0000-0000-0000-000000000000',
    'williams@zazu-org.com',
    crypt('CAMBIAR_TRAS_PRIMER_LOGIN', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"WILLIAMS","role":"CEO","email_personal":"melaminacolors2@gmail.com"}',
    now(), now(), 'authenticated', 'authenticated', '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid2, 'williams@zazu-org.com', 'email',
    json_build_object('sub', uid2::text, 'email', 'williams@zazu-org.com'), now(), now(), now());

  -- ------------------------------------------------
  -- 3. ADMINISTRADOR — ruben@zazu-org.com
  -- ------------------------------------------------
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, role, aud,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    uid3, '00000000-0000-0000-0000-000000000000',
    'ruben@zazu-org.com',
    crypt('CAMBIAR_TRAS_PRIMER_LOGIN', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"RUBEN","role":"ADMINISTRADOR","email_personal":"rbnasmat@gmail.com"}',
    now(), now(), 'authenticated', 'authenticated', '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid3, 'ruben@zazu-org.com', 'email',
    json_build_object('sub', uid3::text, 'email', 'ruben@zazu-org.com'), now(), now(), now());

  -- ------------------------------------------------
  -- 4. JEFE DE ALMACÉN — benjamin@zazu-org.com
  -- ------------------------------------------------
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, role, aud,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    uid4, '00000000-0000-0000-0000-000000000000',
    'benjamin@zazu-org.com',
    crypt('CAMBIAR_TRAS_PRIMER_LOGIN', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"BENJAMIN","role":"JEFE_ALMACEN","email_personal":"elbenjael17@gmail.com"}',
    now(), now(), 'authenticated', 'authenticated', '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid4, 'benjamin@zazu-org.com', 'email',
    json_build_object('sub', uid4::text, 'email', 'benjamin@zazu-org.com'), now(), now(), now());

end $$;
