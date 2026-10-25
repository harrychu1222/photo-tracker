-- ============================================================
-- Migration 12: people without accounts, per-entry hourly rates, per-task lump sums
-- Run once in the Supabase SQL editor, BEFORE deploying the matching app code.
-- Requires migrations 4 to 11 to have been run first.
-- Safe to re-run.
-- ============================================================

-- ---------- People who do not have a login (casuals, subcontractors) ----------
-- Admins type a name when logging hours and it is saved here to pick again later.
-- Admin only; an optional default hourly rate lives on the person.

create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  hourly_rate numeric(10, 2) check (hourly_rate is null or hourly_rate >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists crew_members_name_unique on public.crew_members (lower(trim(name)));

alter table public.crew_members enable row level security;

drop policy if exists "admins manage crew members" on public.crew_members;
create policy "admins manage crew members"
  on public.crew_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Hours can now be for an account holder (user_id) or one of these people (worker_id).
alter table public.time_entries add column if not exists worker_id uuid references public.crew_members(id) on delete set null;

alter table public.time_entries drop constraint if exists time_entries_one_person;
alter table public.time_entries add constraint time_entries_one_person check (user_id is null or worker_id is null);

create index if not exists time_entries_worker_id_idx on public.time_entries (worker_id);

-- ---------- Rate for one particular entry (admins only) ----------
-- Hourly rates vary job to job. When a row exists here it is used for that entry instead of
-- the person's usual rate. Kept apart from time_entries so crew cannot see it.

create table if not exists public.time_entry_rates (
  entry_id uuid primary key references public.time_entries(id) on delete cascade,
  hourly_rate numeric(10, 2) not null check (hourly_rate >= 0)
);

alter table public.time_entry_rates enable row level security;

drop policy if exists "admins manage entry rates" on public.time_entry_rates;
create policy "admins manage entry rates"
  on public.time_entry_rates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Lump sums, optionally for one task (subcontracted work) ----------
-- Added on top of hours x rates. "replaces_hours" says the lump sum already covers the hours
-- logged on that task, so those hours are not costed again.

create table if not exists public.labour_lumps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  amount_ex_gst numeric(12, 2) not null,
  paid_on date not null default current_date,
  replaces_hours boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists labour_lumps_project_id_idx on public.labour_lumps (project_id);
create index if not exists labour_lumps_task_id_idx on public.labour_lumps (task_id);

create or replace function public.labour_lumps_check_task()
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

drop trigger if exists labour_lumps_check_task_trg on public.labour_lumps;
create trigger labour_lumps_check_task_trg
  before insert or update of task_id, project_id on public.labour_lumps
  for each row execute function public.labour_lumps_check_task();

alter table public.labour_lumps enable row level security;

drop policy if exists "admins manage labour lumps" on public.labour_lumps;
create policy "admins manage labour lumps"
  on public.labour_lumps for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and auth.uid() = created_by);

-- ---------- Move any project-wide lump sum from migration 11 into the new list ----------
-- It becomes an ordinary lump sum line (added to hours x rates, no longer an override).
insert into public.labour_lumps (project_id, description, amount_ex_gst, paid_on, created_by)
select f.project_id, 'Labour lump sum (moved from project setting)', f.labour_lump_sum,
       coalesce(f.labour_lump_on, current_date),
       (select p.id from public.profiles p where p.role = 'admin' order by p.created_at limit 1)
from public.project_finance f
where f.labour_lump_sum is not null;

update public.project_finance set labour_lump_sum = null, labour_lump_on = null where labour_lump_sum is not null;
