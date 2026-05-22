-- =====================================================
-- LogixZazu — Migración v2.4: Storage para firmas
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Crea el bucket `signatures` (público de lectura) y las
-- políticas necesarias para que cualquier usuario autenticado
-- pueda subir su firma, pero solo ADMIN_GENERAL pueda borrar.
--
-- Las firmas nuevas se guardan en Storage; las existentes
-- (data URLs base64 en transactions.signature) siguen funcionando
-- — el frontend renderiza ambas.
-- =====================================================

BEGIN;

-- Bucket público de lectura (las firmas se ven inline en la app y en emails).
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', true)
on conflict (id) do update set public = true;

-- Policies para storage.objects en el bucket `signatures`.
drop policy if exists "signatures_insert" on storage.objects;
drop policy if exists "signatures_select" on storage.objects;
drop policy if exists "signatures_delete" on storage.objects;

create policy "signatures_select" on storage.objects
  for select using (bucket_id = 'signatures');

create policy "signatures_insert" on storage.objects
  for insert with check (
    bucket_id = 'signatures'
    and auth.role() = 'authenticated'
  );

create policy "signatures_delete" on storage.objects
  for delete using (
    bucket_id = 'signatures'
    and get_my_role() = 'ADMIN_GENERAL'
  );

COMMIT;
