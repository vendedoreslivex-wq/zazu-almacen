-- =====================================================
-- LogixZazu — Supabase Schema v1.0
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- PROFILES (extiende auth.users con rol y datos del usuario)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text not null unique,
  role text not null default 'JEFE_ALMACEN'
    check (role in ('ADMIN_GENERAL','CEO','ADMINISTRADOR','JEFE_ALMACEN')),
  email text,
  email_personal text,
  active boolean not null default true,
  created_at timestamptz default now()
);
-- Si la tabla ya existe, agregar columna sin error
alter table profiles add column if not exists email_personal text;

-- CONTACTS (antes de transactions por la FK)
create table if not exists contacts (
  id uuid default gen_random_uuid() primary key,
  brand text not null check (brand in ('OVERSHARK','BRAVOS','BOX_PRIME')),
  type text not null check (type in ('SUPPLIER','CLIENT')),
  name text not null,
  document text not null,
  phone text,
  email text,
  created_at timestamptz default now()
);

-- PRODUCTS (id es text para soportar IDs del catálogo como 'p1000', 'p1001', etc.)
create table if not exists products (
  id text primary key,
  brand text not null check (brand in ('OVERSHARK','BRAVOS','BOX_PRIME')),
  code text not null,
  name text not null,
  color text,
  size text,
  category text not null default '',
  low_stock_threshold integer,
  cost_price numeric(12,2),
  sell_price numeric(12,2),
  created_at timestamptz default now()
);
create index if not exists idx_products_brand on products(brand);

-- LOCATIONS (id es text para soportar IDs como 'loc_01', 'loc_02', etc.)
create table if not exists locations (
  id text primary key,
  brand text not null check (brand in ('OVERSHARK','BRAVOS','BOX_PRIME')),
  name text not null,
  type text not null check (type in ('ZONE','RACK','BIN','EXTERNAL','WAREHOUSE')),
  created_at timestamptz default now()
);

-- STOCK LEVELS
create table if not exists stock_levels (
  id uuid default gen_random_uuid() primary key,
  brand text not null check (brand in ('OVERSHARK','BRAVOS','BOX_PRIME')),
  product_id text references products(id) on delete cascade not null,
  location_id text references locations(id) on delete cascade not null,
  quantity integer not null default 0,
  updated_at timestamptz default now(),
  unique(brand, product_id, location_id)
);
create index if not exists idx_stock_brand on stock_levels(brand);

-- TRANSACTIONS
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  brand text not null check (brand in ('OVERSHARK','BRAVOS','BOX_PRIME')),
  date timestamptz default now(),
  type text not null check (type in ('RECEPTION','DISPATCH','TRANSFER')),
  product_id text references products(id),
  quantity integer not null,
  from_location_id text references locations(id),
  to_location_id text references locations(id),
  reference text not null,
  user_name text not null,
  status text not null default 'COMPLETED'
    check (status in ('COMPLETED','PENDING','CANCELLED','PREPARING')),
  signature text,
  contact_id uuid references contacts(id),
  serial_number text
);
create index if not exists idx_tx_brand on transactions(brand);
create index if not exists idx_tx_date on transactions(date desc);

-- PURCHASE ORDERS
create table if not exists purchase_orders (
  id uuid default gen_random_uuid() primary key,
  brand text not null check (brand in ('OVERSHARK','BRAVOS','BOX_PRIME')),
  date timestamptz default now(),
  supplier_id uuid references contacts(id),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','APPROVED','PARTIAL','COMPLETED','CANCELLED')),
  reference text not null,
  notes text,
  location_id text references locations(id)
);

create table if not exists purchase_order_items (
  id uuid default gen_random_uuid() primary key,
  purchase_order_id uuid references purchase_orders(id) on delete cascade,
  product_id text references products(id),
  quantity integer not null,
  unit_cost numeric(12,2) not null,
  received_quantity integer not null default 0
);

-- INVENTORY ADJUSTMENTS
create table if not exists inventory_adjustments (
  id uuid default gen_random_uuid() primary key,
  brand text not null check (brand in ('OVERSHARK','BRAVOS','BOX_PRIME')),
  date timestamptz default now(),
  product_id text references products(id),
  location_id text references locations(id),
  previous_quantity integer not null,
  new_quantity integer not null,
  reason text not null check (reason in ('DAMAGE','LOSS','COUNT','RETURN','OTHER')),
  notes text,
  user_name text not null
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
alter table profiles enable row level security;
alter table products enable row level security;
alter table locations enable row level security;
alter table stock_levels enable row level security;
alter table transactions enable row level security;
alter table contacts enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table inventory_adjustments enable row level security;

-- Todo usuario autenticado puede leer y escribir todo
create policy "auth_full" on profiles        for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_full" on products         for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_full" on locations        for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_full" on stock_levels     for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_full" on transactions     for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_full" on contacts         for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_full" on purchase_orders  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_full" on purchase_order_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_full" on inventory_adjustments for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- =====================================================
-- TRIGGER: crear perfil automáticamente al registrarse
-- =====================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, role, email, email_personal)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'JEFE_ALMACEN'),
    new.email,
    new.raw_user_meta_data->>'email_personal'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================
-- RPC: execute_transaction (operación atómica de stock)
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
  -- Validar stock para DISPATCH / TRANSFER
  if p_type in ('DISPATCH', 'TRANSFER') then
    select quantity into v_current_stock
    from stock_levels
    where brand = p_brand and product_id = p_product_id and location_id = p_from_location_id;

    if coalesce(v_current_stock, 0) < p_quantity then
      raise exception 'STOCK_INSUFICIENTE: disponible=%', coalesce(v_current_stock, 0);
    end if;
  end if;

  -- Insertar transacción
  insert into transactions (
    brand, type, product_id, quantity, from_location_id, to_location_id,
    reference, user_name, contact_id, signature, serial_number
  ) values (
    p_brand, p_type, p_product_id, p_quantity,
    p_from_location_id, p_to_location_id,
    p_reference, p_user_name, p_contact_id, p_signature, p_serial_number
  ) returning id into v_tx_id;

  -- RECEPCIÓN
  if p_type = 'RECEPTION' then
    if p_force_new_entry then
      insert into stock_levels (brand, product_id, location_id, quantity)
      values (p_brand, p_product_id, p_to_location_id, p_quantity);
    else
      insert into stock_levels (brand, product_id, location_id, quantity)
      values (p_brand, p_product_id, p_to_location_id, p_quantity)
      on conflict (brand, product_id, location_id)
      do update set quantity = stock_levels.quantity + excluded.quantity, updated_at = now();
    end if;
  end if;

  -- DESPACHO
  if p_type = 'DISPATCH' then
    update stock_levels
    set quantity = quantity - p_quantity, updated_at = now()
    where brand = p_brand and product_id = p_product_id and location_id = p_from_location_id;
    delete from stock_levels where brand = p_brand and quantity <= 0;
  end if;

  -- TRASLADO
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

-- =====================================================
-- RPC: execute_adjustment (ajuste atómico de stock)
-- =====================================================
create or replace function execute_adjustment(
  p_brand text,
  p_product_id text,
  p_location_id text,
  p_previous_quantity integer,
  p_new_quantity integer,
  p_reason text,
  p_notes text,
  p_user_name text
) returns uuid language plpgsql security definer as $$
declare
  v_adj_id uuid;
begin
  insert into inventory_adjustments (
    brand, product_id, location_id, previous_quantity, new_quantity, reason, notes, user_name
  ) values (p_brand, p_product_id, p_location_id, p_previous_quantity, p_new_quantity, p_reason, p_notes, p_user_name)
  returning id into v_adj_id;

  if p_new_quantity > 0 then
    insert into stock_levels (brand, product_id, location_id, quantity)
    values (p_brand, p_product_id, p_location_id, p_new_quantity)
    on conflict (brand, product_id, location_id)
    do update set quantity = excluded.quantity, updated_at = now();
  else
    delete from stock_levels
    where brand = p_brand and product_id = p_product_id and location_id = p_location_id;
  end if;

  return v_adj_id;
end;
$$;
