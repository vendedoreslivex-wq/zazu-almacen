-- =====================================================
-- LogixZazu — Migración v2.5: audit_log
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Crea una tabla audit_log + función log_audit() y la
-- engancha como AFTER trigger en cada tabla relevante.
-- Captura TODA acción (INSERT/UPDATE/DELETE) con el
-- usuario que la ejecutó (vía auth.uid()).
-- =====================================================

BEGIN;

create table if not exists audit_log (
  id uuid default gen_random_uuid() primary key,
  occurred_at timestamptz not null default now(),
  user_id uuid,
  user_name text,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  table_name text not null,
  record_id text,
  brand text,
  old_data jsonb,
  new_data jsonb
);

create index if not exists idx_audit_log_occurred_at on audit_log(occurred_at desc);
create index if not exists idx_audit_log_table on audit_log(table_name);
create index if not exists idx_audit_log_brand on audit_log(brand);
create index if not exists idx_audit_log_user on audit_log(user_id);

alter table audit_log enable row level security;

drop policy if exists "audit_log_select" on audit_log;
create policy "audit_log_select" on audit_log
  for select using (get_my_role() = 'ADMIN_GENERAL');

-- Sin policies para INSERT/UPDATE/DELETE: solo el trigger
-- (SECURITY DEFINER) escribe; ni borrado manual permitido.

-- =====================================================
-- FUNCION: log_audit
-- Captura la fila vieja/nueva + el usuario y la guarda.
-- Cualquier error de logging NO interrumpe la operación
-- original (el RAISE NOTICE deja rastro en los logs).
-- =====================================================
create or replace function log_audit() returns trigger language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_user_name text;
  v_record_id text;
  v_brand text;
  v_old jsonb;
  v_new jsonb;
begin
  begin
    v_user_id := auth.uid();
  exception when others then
    v_user_id := null;
  end;

  if v_user_id is not null then
    select username into v_user_name from public.profiles where id = v_user_id;
  end if;

  if TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
    v_new := null;
    v_record_id := v_old->>'id';
    v_brand := v_old->>'brand';
  elsif TG_OP = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(NEW);
    v_record_id := v_new->>'id';
    v_brand := v_new->>'brand';
  else  -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := v_new->>'id';
    v_brand := v_new->>'brand';
  end if;

  begin
    insert into audit_log (user_id, user_name, action, table_name, record_id, brand, old_data, new_data)
    values (v_user_id, v_user_name, TG_OP, TG_TABLE_NAME, v_record_id, v_brand, v_old, v_new);
  exception when others then
    raise notice 'audit_log insert failed for %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
  end;

  return coalesce(NEW, OLD);
end;
$$;

-- =====================================================
-- Adjuntar triggers a todas las tablas auditables
-- =====================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles',
    'products',
    'locations',
    'contacts',
    'stock_levels',
    'transactions',
    'purchase_orders',
    'purchase_order_items',
    'inventory_adjustments',
    'role_permissions',
    'notification_subscribers'
  ] loop
    execute format('drop trigger if exists audit_%I on %I', t, t);
    execute format('create trigger audit_%I after insert or update or delete on %I for each row execute function log_audit()', t, t);
  end loop;
end $$;

COMMIT;
