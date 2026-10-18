-- SellBridge MVP schema. Run in Supabase SQL editor.

create table sellers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  usdt_address text,
  balance_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  title text not null,
  description text,
  price_usd numeric not null,
  file_url text not null,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  buyer_email text,
  amount_usd numeric not null,
  status text not null default 'pending',
  nowpayments_invoice_id text,
  created_at timestamptz not null default now()
);

-- MVP: service-role key bypasses RLS; enable RLS with open policies for simplicity.
alter table sellers enable row level security;
alter table products enable row level security;
alter table orders enable row level security;

create policy "open" on sellers for all using (true) with check (true);
create policy "open" on products for all using (true) with check (true);
create policy "open" on orders for all using (true) with check (true);

-- NOTE: tighten RLS before public launch (per-seller isolation + buyer-scoped downloads).
