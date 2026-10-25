-- ============================================================
-- Migration 11 (stage 5): hours worked and labour cost
-- Run once in the Supabase SQL editor, BEFORE deploying the matching app code.
-- Requires migrations 4 to 10 to have been run first.
-- Safe to re-run. Nothing existing is changed.
-- ============================================================

-- ---------- Time entries: hours actually worked ----------
-- Crew log their own hours and see only their own. Admins see everyone's and can log
-- hours for anyone. No dollar amounts live in this table.

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,   -- who did the work
  work_date date not null default current_date,
  hours numeric(5, 2) not null check (hours > 0 and hours <= 24),
  note text,
  created_by uuid references auth.users(id) on delete set null, -- who typed it in
  created_at timestamptz not null default now()
);
create index if not exists time_entries_project_id_idx on public.time_entries (project_id);
create index if not exists time_entries_task_id_idx on public.time_entries (task_id);
create index if not exists time_entries_user_id_idx on public.time_entries (user_id);

-- A linked task must belong to the same project as the entry.
create or replace function public.time_entries_check_task()
returns trigger
language plpgsql
as $$
begin
  if new.task_id is not null and not exists (
    select 1 from public.tasks t where t.id = new.task_id and t.project_id = new.project_id
  ) then
    raise exception 'That task is not in this project.';
  end if;
  return new;
end;
$$;

drop trigger if exists time_entries_check_task_trg on public.time_entries;
create trigger time_entries_check_task_trg
  before insert or update of task_id, project_id on public.time_entries
  for each row execute function public.time_entries_check_task();

alter table public.time_entries enable row level security;

drop policy if exists "admins see all hours, crew their own" on public.time_entries;
create policy "admins see all hours, crew their own"
  on public.time_entries for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

drop policy if exists "log your own hours, admins log anyone's" on public.time_entries;
create policy "log your own hours, admins log anyone's"
  on public.time_entries for insert to authenticated
  with check (auth.uid() = created_by and (public.is_admin() or user_id = auth.uid()));

drop policy if exists "change your own hours, admins anyone's" on public.time_entries;
create policy "change your own hours, admins anyone's"
  on public.time_entries for update to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

drop policy if exists "delete your own hours, admins anyone's" on public.time_entries;
create policy "delete your own hours, admins anyone's"
  on public.time_entries for delete to authenticated
  using (public.is_admin() or user_id = auth.uid());

-- ---------- Hourly rates (admins only) ----------
-- What an hour of each person's time costs the business, ex-GST. Kept apart from the hours
-- so crew can never see a rate.

create table if not exists public.person_rates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hourly_rate numeric(10, 2) not null check (hourly_rate >= 0),
  updated_at timestamptz not null default now()
);

alter table public.person_rates enable row level security;

drop policy if exists "admins manage rates" on public.person_rates;
create policy "admins manage rates"
  on public.person_rates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Labour lump sum (admins only, lives with the other project money) ----------
-- Optional fixed labour cost for a project. When set it is used instead of hours x rates.

alter table public.project_finance add column if not exists labour_lump_sum numeric(12, 2);
alter table public.project_finance add column if not exists labour_lump_on date;
