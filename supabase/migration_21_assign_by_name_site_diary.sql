-- F2b: assign tasks to a typed name (workers without a login).
alter table public.tasks add column if not exists assigned_name text;

-- F3: site diary
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  entry_date date not null default current_date,
  weather text,
  on_site text,
  work_done text,
  issues text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists diary_entries_project_idx on public.diary_entries (project_id, entry_date);
alter table public.diary_entries enable row level security;
drop policy if exists "diary readable" on public.diary_entries;
create policy "diary readable" on public.diary_entries for select to authenticated using (true);
drop policy if exists "diary insert own" on public.diary_entries;
create policy "diary insert own" on public.diary_entries for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "diary update own or admin" on public.diary_entries;
create policy "diary update own or admin" on public.diary_entries for update to authenticated using (created_by = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or public.is_admin());
drop policy if exists "diary delete own or admin" on public.diary_entries;
create policy "diary delete own or admin" on public.diary_entries for delete to authenticated using (created_by = auth.uid() or public.is_admin());

-- F3: compliance checklists (one row per tick-box item)
create table if not exists public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  list_name text not null,
  text text not null,
  sort int not null default 0,
  done boolean not null default false,
  done_on date,
  done_by uuid references auth.users(id) on delete set null,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists compliance_items_project_idx on public.compliance_items (project_id);
alter table public.compliance_items enable row level security;
drop policy if exists "compliance readable" on public.compliance_items;
create policy "compliance readable" on public.compliance_items for select to authenticated using (true);
drop policy if exists "compliance insert" on public.compliance_items;
create policy "compliance insert" on public.compliance_items for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "compliance update" on public.compliance_items;
create policy "compliance update" on public.compliance_items for update to authenticated using (true) with check (true);
drop policy if exists "compliance delete admin or own" on public.compliance_items;
create policy "compliance delete admin or own" on public.compliance_items for delete to authenticated using (created_by = auth.uid() or public.is_admin());
