create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  username text not null,
  role text not null default 'User',
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.users enable row level security;

-- Allow anyone to read users (needed for community/admin features)
create policy read_users on public.users
for select using (true);

-- Allow anyone to insert users (needed for signup sync)
create policy insert_users on public.users
for insert with check (true);

-- Allow anyone to update users
create policy update_users on public.users
for update using (true);

-- Allow anyone to delete users (needed for admin features)
create policy delete_users on public.users
for delete using (true);