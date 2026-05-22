-- =====================================================
-- LogixZazu — Migración v2.3: notification_subscribers
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Reemplaza la lista INTERNAL_RECIPIENTS hardcoded en
-- src/lib/emailService.ts por una tabla gestionable desde la app.
-- =====================================================

BEGIN;

create table if not exists notification_subscribers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  active boolean not null default true,
  created_at timestamptz default now(),
  unique (email)
);

alter table notification_subscribers enable row level security;

drop policy if exists "notif_select" on notification_subscribers;
drop policy if exists "notif_insert" on notification_subscribers;
drop policy if exists "notif_update" on notification_subscribers;
drop policy if exists "notif_delete" on notification_subscribers;

-- SELECT: cualquier usuario autenticado (para que emailService los lea).
-- INSERT/UPDATE/DELETE: solo ADMIN_GENERAL.
create policy "notif_select" on notification_subscribers
  for select using (auth.role() = 'authenticated');
create policy "notif_insert" on notification_subscribers
  for insert with check (get_my_role() = 'ADMIN_GENERAL');
create policy "notif_update" on notification_subscribers
  for update using (get_my_role() = 'ADMIN_GENERAL')
  with check (get_my_role() = 'ADMIN_GENERAL');
create policy "notif_delete" on notification_subscribers
  for delete using (get_my_role() = 'ADMIN_GENERAL');

-- Seed inicial con la lista que estaba hardcoded.
insert into notification_subscribers (name, email)
values
  ('Rubén',     'rbnasmat@gmail.com'),
  ('Williams',  'Melaminacolors2@gmail.com'),
  ('Benjamín',  'elbenjael17@gmail.com'),
  ('Valentino', 'jamesrojasdiaz01@gmail.com')
on conflict (email) do nothing;

COMMIT;
