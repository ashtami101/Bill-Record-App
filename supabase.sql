-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)

create table if not exists public.kv_store (
  scope_key text primary key,
  key text not null,
  shared boolean not null default false,
  owner uuid references auth.users(id) on delete cascade,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.kv_store enable row level security;

-- Every logged-in user can read/write their own private rows (owner = their uid)
-- and every logged-in user can read/write rows marked shared = true.
create policy "read own or shared"
  on public.kv_store for select
  to authenticated
  using (shared = true or owner = auth.uid());

create policy "insert own or shared"
  on public.kv_store for insert
  to authenticated
  with check (shared = true or owner = auth.uid());

create policy "update own or shared"
  on public.kv_store for update
  to authenticated
  using (shared = true or owner = auth.uid())
  with check (shared = true or owner = auth.uid());

create policy "delete own or shared"
  on public.kv_store for delete
  to authenticated
  using (shared = true or owner = auth.uid());
