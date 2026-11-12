-- F3b: managed worker names, saved checklist templates, resolvable diary issues.

create table if not exists public.task_workers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists task_workers_name_idx on public.task_workers (lower(name));
alter table public.task_workers enable row level security;
drop policy if exists "workers readable" on public.task_workers;
create policy "workers readable" on public.task_workers for select to authenticated using (true);
drop policy if exists "workers insert" on public.task_workers;
create policy "workers insert" on public.task_workers for insert to authenticated with check (true);
drop policy if exists "workers update admin" on public.task_workers;
create policy "workers update admin" on public.task_workers for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "workers delete admin" on public.task_workers;
create policy "workers delete admin" on public.task_workers for delete to authenticated using (public.is_admin());
-- names already typed onto tasks
insert into public.task_workers (name)
select distinct on (lower(trim(assigned_name))) trim(assigned_name) from public.tasks
where coalesce(trim(assigned_name), '') <> ''
on conflict do nothing;

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  items jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.checklist_templates enable row level security;
drop policy if exists "templates readable" on public.checklist_templates;
create policy "templates readable" on public.checklist_templates for select to authenticated using (true);
drop policy if exists "templates admin write" on public.checklist_templates;
create policy "templates admin write" on public.checklist_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.diary_issues (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.diary_entries(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  text text not null check (length(trim(text)) > 0),
  resolved boolean not null default false,
  resolved_on date,
  comment text,
  resolved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists diary_issues_entry_idx on public.diary_issues (entry_id);
create index if not exists diary_issues_project_idx on public.diary_issues (project_id);
alter table public.diary_issues enable row level security;
drop policy if exists "issues readable" on public.diary_issues;
create policy "issues readable" on public.diary_issues for select to authenticated using (true);
drop policy if exists "issues insert own" on public.diary_issues;
create policy "issues insert own" on public.diary_issues for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "issues update admin" on public.diary_issues;
create policy "issues update admin" on public.diary_issues for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "issues delete own or admin" on public.diary_issues;
create policy "issues delete own or admin" on public.diary_issues for delete to authenticated using (created_by = auth.uid() or public.is_admin());
-- carry over issue text written before this migration, once
insert into public.diary_issues (entry_id, project_id, text, created_by)
select e.id, e.project_id, trim(line), e.created_by
from public.diary_entries e, lateral unnest(string_to_array(e.issues, E'\n')) as line
where coalesce(trim(e.issues), '') <> '' and coalesce(trim(line), '') <> ''
  and not exists (select 1 from public.diary_issues di where di.entry_id = e.id);
update public.diary_entries set issues = null where issues is not null and exists (select 1 from public.diary_issues di where di.entry_id = id);
