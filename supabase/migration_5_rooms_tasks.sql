-- ============================================================
-- Migration 5 (stage 2 of project management): rooms and tasks
-- Run once in the Supabase SQL editor, BEFORE deploying the matching app code.
-- Requires migration_4_projects_roles.sql to have been run first.
-- Safe to re-run. Nothing is deleted: rooms already typed on your photos become
-- real per-project rooms, and those photos are linked to them (the original typed
-- room text is left untouched).
-- ============================================================

-- ---------- Rooms (a real list per project) ----------

create table if not exists public.project_rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- One room name per project, ignoring capitalisation ("Kitchen" = "kitchen").
create unique index if not exists project_rooms_name_idx
  on public.project_rooms (project_id, lower(name));

-- ---------- Tasks ----------

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  room_id uuid references public.project_rooms(id) on delete set null,
  name text not null,
  notes text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'blocked')),
  percent_complete int not null default 0 check (percent_complete between 0 and 100),
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  planned_hours numeric(8, 2) check (planned_hours is null or planned_hours >= 0),
  blocked_by uuid references public.tasks(id) on delete set null,
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tasks_not_blocked_by_itself check (blocked_by is null or blocked_by <> id)
);

create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_room_id_idx on public.tasks (room_id);

-- ---------- Link photos to a room and a task ----------

alter table public.photos
  add column if not exists room_id uuid references public.project_rooms(id) on delete set null;
alter table public.photos
  add column if not exists task_id uuid references public.tasks(id) on delete set null;

create index if not exists photos_room_id_idx on public.photos (room_id);
create index if not exists photos_task_id_idx on public.photos (task_id);

-- ---------- Security rules ----------
-- Rooms and tasks hold no money, so everyone signed in can read them. Crew need to
-- tick tasks off and update progress on site, so any signed-in user can add and
-- update rooms and tasks. Only admins or whoever created a row can delete it.

alter table public.project_rooms enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "rooms are readable by authenticated users" on public.project_rooms;
create policy "rooms are readable by authenticated users"
  on public.project_rooms for select to authenticated using (true);

drop policy if exists "authenticated users can create rooms" on public.project_rooms;
create policy "authenticated users can create rooms"
  on public.project_rooms for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "authenticated users can update rooms" on public.project_rooms;
create policy "authenticated users can update rooms"
  on public.project_rooms for update to authenticated using (true) with check (true);

drop policy if exists "admins or creators can delete rooms" on public.project_rooms;
create policy "admins or creators can delete rooms"
  on public.project_rooms for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

drop policy if exists "tasks are readable by authenticated users" on public.tasks;
create policy "tasks are readable by authenticated users"
  on public.tasks for select to authenticated using (true);

drop policy if exists "authenticated users can create tasks" on public.tasks;
create policy "authenticated users can create tasks"
  on public.tasks for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "authenticated users can update tasks" on public.tasks;
create policy "authenticated users can update tasks"
  on public.tasks for update to authenticated using (true) with check (true);

drop policy if exists "admins or creators can delete tasks" on public.tasks;
create policy "admins or creators can delete tasks"
  on public.tasks for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- ---------- Turn rooms already typed on photos into real rooms ----------
-- One room per distinct (project, room name), case and spacing differences merged,
-- credited to whoever uploaded the first photo in that room.

insert into public.project_rooms (project_id, name, created_by)
select distinct on (ph.project_id, lower(trim(ph.room)))
  ph.project_id, trim(ph.room), ph.user_id
from public.photos ph
where ph.project_id is not null
  and trim(ph.room) <> ''
order by ph.project_id, lower(trim(ph.room)), ph.created_at
on conflict do nothing;

update public.photos ph
set room_id = r.id
from public.project_rooms r
where ph.room_id is null
  and ph.project_id = r.project_id
  and trim(ph.room) <> ''
  and lower(trim(ph.room)) = lower(r.name);
