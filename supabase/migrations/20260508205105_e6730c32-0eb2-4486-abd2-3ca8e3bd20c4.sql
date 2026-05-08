create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  author_name text not null default 'Anonymous',
  votes integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  steps_to_reproduce text,
  severity text not null default 'medium',
  author_name text not null default 'Anonymous',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.suggestions enable row level security;
alter table public.bug_reports enable row level security;

drop policy if exists read_suggestions on public.suggestions;
drop policy if exists insert_suggestions on public.suggestions;
drop policy if exists update_suggestions on public.suggestions;

create policy read_suggestions on public.suggestions
for select using (true);

create policy insert_suggestions on public.suggestions
for insert with check (true);

create policy update_suggestions on public.suggestions
for update using (true);

drop policy if exists read_bug_reports on public.bug_reports;
drop policy if exists insert_bug_reports on public.bug_reports;
drop policy if exists update_bug_reports on public.bug_reports;

create policy read_bug_reports on public.bug_reports
for select using (true);

create policy insert_bug_reports on public.bug_reports
for insert with check (true);

create policy update_bug_reports on public.bug_reports
for update using (true);