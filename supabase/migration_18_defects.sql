-- Stage E: defects list per project.
create table if not exists public.defects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  room_id uuid references public.project_rooms(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  notes text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'fixed')),
  raised_on date not null default current_date,
  fixed_on date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists defects_project_id_idx on public.defects (project_id);
alter table public.defects enable row level security;
drop policy if exists "defects readable" on public.defects;
create policy "defects readable" on public.defects for select to authenticated using (true);
drop policy if exists "defects insert own" on public.defects;
create policy "defects insert own" on public.defects for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "defects update" on public.defects;
create policy "defects update" on public.defects for update to authenticated using (true) with check (true);
drop policy if exists "defects delete own or admin" on public.defects;
create policy "defects delete own or admin" on public.defects for delete to authenticated using (created_by = auth.uid() or public.is_admin());
