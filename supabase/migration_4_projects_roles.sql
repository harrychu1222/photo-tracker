-- ============================================================
-- Migration 4 (stage 1 of project management): roles + real projects
-- Run once in the Supabase SQL editor, BEFORE deploying the matching app code.
-- Safe to re-run. Nothing is deleted. Existing photos keep their typed
-- project text and are additionally linked to a real project record.
-- Fresh installs: run schema.sql first, then this file.
-- ============================================================

-- ---------- Roles ----------

alter table public.profiles
  add column if not exists role text not null default 'crew';

alter table public.invite_codes
  add column if not exists role text not null default 'crew';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'crew'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invite_codes_role_check') then
    alter table public.invite_codes add constraint invite_codes_role_check check (role in ('admin', 'crew'));
  end if;
end $$;

-- New accounts get the role attached to the invite code they used.
-- The role comes from the invite_codes table (which clients cannot read or
-- write), never from anything the browser sends, so it can't be self-assigned.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.invite_codes
  where code = new.raw_user_meta_data ->> 'invite_code';

  insert into public.profiles (id, email, role)
  values (new.id, new.email, coalesce(v_role, 'crew'));

  return new;
end;
$$;

-- Used by security rules below. Security definer so it can read profiles
-- without recursing through the profiles policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- Projects ----------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text not null default '',
  site_address text not null default '',
  status text not null default 'active' check (status in ('quoting', 'active', 'on_hold', 'complete')),
  start_date date,
  end_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- One project per name, ignoring capitalisation ("Smith Kitchen" = "smith kitchen").
create unique index if not exists projects_name_lower_idx on public.projects (lower(name));

-- Money fields live in their own table so crew can never read them.
create table if not exists public.project_finance (
  project_id uuid primary key references public.projects(id) on delete cascade,
  budget numeric(12, 2),                          -- optional internal cost ceiling
  markup_pct numeric(6, 2) not null default 0,    -- added on top of estimated cost for the quote price
  gst_enabled boolean not null default true,      -- 10% GST added on the final total
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_finance enable row level security;

-- Everyone signed in can see projects and create them (crew need to start a
-- project when uploading photos). Only admins or the creator can edit; only
-- admins can delete.
drop policy if exists "projects are readable by authenticated users" on public.projects;
create policy "projects are readable by authenticated users"
  on public.projects for select to authenticated using (true);

drop policy if exists "authenticated users can create projects" on public.projects;
create policy "authenticated users can create projects"
  on public.projects for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "admins or creators can update projects" on public.projects;
create policy "admins or creators can update projects"
  on public.projects for update to authenticated
  using (public.is_admin() or created_by = auth.uid());

drop policy if exists "admins can delete projects" on public.projects;
create policy "admins can delete projects"
  on public.projects for delete to authenticated using (public.is_admin());

drop policy if exists "admins manage project finance" on public.project_finance;
create policy "admins manage project finance"
  on public.project_finance for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Link photos to projects ----------

alter table public.photos
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists photos_project_id_idx on public.photos (project_id);

-- Turn every distinct project name already typed on a photo into a real project
-- (case and spacing differences are merged), credited to whoever uploaded the first photo.
insert into public.projects (name, created_by)
select distinct on (lower(trim(location))) trim(location), user_id
from public.photos
where trim(location) <> ''
order by lower(trim(location)), created_at
on conflict do nothing;

-- Link the existing photos to those projects. The original typed text is left untouched.
update public.photos ph
set project_id = p.id
from public.projects p
where ph.project_id is null
  and trim(ph.location) <> ''
  and lower(trim(ph.location)) = lower(p.name);

-- ---------- Make yourself the first admin ----------
-- Everyone starts as crew. After running this file, run this ONE line separately,
-- with the email you log in with, then sign out and back in:
--
--   update public.profiles set role = 'admin' where email = 'YOUR-LOGIN-EMAIL';
