-- ============================================================
-- Migration 6 (stage 3 of project management): materials, equipment,
-- bulk-add / copy tasks, dependency safety, and team roles
-- Run once in the Supabase SQL editor, BEFORE deploying the matching app code.
-- Requires migration_4 and migration_5 to have been run first.
-- Safe to re-run. Nothing existing is changed or deleted.
-- ============================================================

-- ---------- Dependency safety ----------
-- A task can only wait on a task in the same project, and waiting chains can never
-- loop back on themselves (A waits on B, B waits on A).

create or replace function public.tasks_check_blocked_by()
returns trigger
language plpgsql
as $$
declare
  cur uuid;
  steps int := 0;
begin
  if new.blocked_by is null then
    return new;
  end if;

  if not exists (
    select 1 from public.tasks where id = new.blocked_by and project_id = new.project_id
  ) then
    raise exception 'A task can only wait on another task in the same project.';
  end if;

  cur := new.blocked_by;
  while cur is not null and steps < 1000 loop
    if cur = new.id then
      raise exception 'That would make a loop: the other task already waits on this one.';
    end if;
    select blocked_by into cur from public.tasks where id = cur;
    steps := steps + 1;
  end loop;

  return new;
end;
$$;

drop trigger if exists tasks_check_blocked_by_trg on public.tasks;
create trigger tasks_check_blocked_by_trg
  before insert or update of blocked_by on public.tasks
  for each row execute function public.tasks_check_blocked_by();

-- ---------- Materials (names and quantities: everyone; prices: admins only) ----------

create table if not exists public.task_materials (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  quantity numeric(12, 3) not null default 1 check (quantity >= 0),
  unit text,
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists task_materials_task_id_idx on public.task_materials (task_id);

-- Planned unit cost, ex-GST. One row per material, in its own table so security rules
-- can hide it from crew completely (not just on screen).
create table if not exists public.material_prices (
  material_id uuid primary key references public.task_materials(id) on delete cascade,
  unit_cost numeric(12, 2) not null check (unit_cost >= 0)
);

-- ---------- Equipment: own tools (free) and hired / bought items (cost) ----------

create table if not exists public.task_equipment (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind text not null default 'own' check (kind in ('own', 'hired', 'bought')),
  ready boolean not null default false,   -- ticked once it's on site / packed
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists task_equipment_task_id_idx on public.task_equipment (task_id);

-- Planned cost of a hired or bought item, ex-GST. Admin-only, like material prices.
create table if not exists public.equipment_prices (
  equipment_id uuid primary key references public.task_equipment(id) on delete cascade,
  cost numeric(12, 2) not null check (cost >= 0)
);

-- ---------- Security rules ----------

alter table public.task_materials enable row level security;
alter table public.material_prices enable row level security;
alter table public.task_equipment enable row level security;
alter table public.equipment_prices enable row level security;

drop policy if exists "materials are readable by authenticated users" on public.task_materials;
create policy "materials are readable by authenticated users"
  on public.task_materials for select to authenticated using (true);

drop policy if exists "authenticated users can create materials" on public.task_materials;
create policy "authenticated users can create materials"
  on public.task_materials for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "authenticated users can update materials" on public.task_materials;
create policy "authenticated users can update materials"
  on public.task_materials for update to authenticated using (true) with check (true);

drop policy if exists "admins or creators can delete materials" on public.task_materials;
create policy "admins or creators can delete materials"
  on public.task_materials for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

drop policy if exists "equipment is readable by authenticated users" on public.task_equipment;
create policy "equipment is readable by authenticated users"
  on public.task_equipment for select to authenticated using (true);

drop policy if exists "authenticated users can create equipment" on public.task_equipment;
create policy "authenticated users can create equipment"
  on public.task_equipment for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "authenticated users can update equipment" on public.task_equipment;
create policy "authenticated users can update equipment"
  on public.task_equipment for update to authenticated using (true) with check (true);

drop policy if exists "admins or creators can delete equipment" on public.task_equipment;
create policy "admins or creators can delete equipment"
  on public.task_equipment for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

drop policy if exists "admins manage material prices" on public.material_prices;
create policy "admins manage material prices"
  on public.material_prices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage equipment prices" on public.equipment_prices;
create policy "admins manage equipment prices"
  on public.equipment_prices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Bulk add tasks ----------
-- p_items is a JSON list in order: [{"name": "Strip out", "parent": null, "hours": 4},
-- {"name": "Plumbing", "parent": 0}, ...] where "parent" is the 0-based position of the
-- item this one waits on (always an earlier item). The whole list is created once in
-- each room in p_room_ids (or once with no room if the list is empty). All or nothing.
-- Runs as the signed-in person, so the normal security rules apply.

create or replace function public.bulk_add_tasks(p_project uuid, p_room_ids uuid[], p_items jsonb)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  rooms uuid[];
  r uuid;
  n int;
  i int;
  item jsonb;
  par int;
  ids uuid[];
  new_id uuid;
  base int;
  created int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one task.';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'That is too many tasks at once (limit 200 per room).';
  end if;
  if not exists (select 1 from public.projects where id = p_project) then
    raise exception 'Project not found.';
  end if;

  rooms := coalesce(p_room_ids, '{}'::uuid[]);
  if cardinality(rooms) = 0 then
    rooms := array[null]::uuid[];
  else
    if (select count(*) from public.project_rooms where project_id = p_project and id = any(rooms))
       <> cardinality(rooms) then
      raise exception 'One of those rooms is not in this project.';
    end if;
  end if;

  select coalesce(max(sort_order), 0) into base from public.tasks where project_id = p_project;
  n := jsonb_array_length(p_items);

  foreach r in array rooms loop
    ids := '{}'::uuid[];
    for i in 0 .. n - 1 loop
      item := p_items -> i;
      if length(trim(coalesce(item ->> 'name', ''))) = 0 then
        raise exception 'Task % has no name.', i + 1;
      end if;
      par := nullif(item ->> 'parent', '')::int;
      if par is not null and (par < 0 or par >= i) then
        raise exception 'Task % waits on a task that does not come before it.', i + 1;
      end if;
      base := base + 1;
      insert into public.tasks (project_id, room_id, name, planned_hours, blocked_by, sort_order, created_by)
      values (
        p_project,
        r,
        trim(item ->> 'name'),
        nullif(item ->> 'hours', '')::numeric,
        case when par is null then null else ids[par + 1] end,
        base,
        auth.uid()
      )
      returning id into new_id;
      ids := ids || new_id;
      created := created + 1;
    end loop;
  end loop;

  return created;
end;
$$;

-- ---------- Copy tasks to other rooms ----------
-- Copies the chosen tasks into every room in p_room_ids. Waiting-on links between the
-- copied tasks are recreated inside each new room; a link to a task that was not copied
-- is dropped. Copies start as To do, 0%, with no actual dates. Planned dates and hours,
-- notes, materials and equipment come along; prices come along only when an admin does
-- the copying (the normal security rules decide that, so crew never see or copy prices).

create or replace function public.copy_tasks(p_task_ids uuid[], p_room_ids uuid[])
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project uuid;
  src record;
  m record;
  e record;
  r uuid;
  newmap jsonb;
  new_id uuid;
  new_child uuid;
  base int;
  created int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  if p_task_ids is null or cardinality(p_task_ids) = 0 then
    raise exception 'Choose at least one task to copy.';
  end if;
  if p_room_ids is null or cardinality(p_room_ids) = 0 then
    raise exception 'Choose at least one room to copy into.';
  end if;

  select min(project_id::text)::uuid into v_project from public.tasks where id = any(p_task_ids);
  if v_project is null
     or (select count(distinct project_id) from public.tasks where id = any(p_task_ids)) <> 1
     or (select count(*) from public.tasks where id = any(p_task_ids)) <> cardinality(p_task_ids) then
    raise exception 'Those tasks are not all in one project.';
  end if;
  if (select count(*) from public.project_rooms where project_id = v_project and id = any(p_room_ids))
     <> cardinality(p_room_ids) then
    raise exception 'One of those rooms is not in this project.';
  end if;

  select coalesce(max(sort_order), 0) into base from public.tasks where project_id = v_project;

  foreach r in array p_room_ids loop
    newmap := '{}'::jsonb;

    -- First pass: the tasks themselves (and their materials / equipment).
    for src in
      select * from public.tasks where id = any(p_task_ids) order by sort_order, created_at, id
    loop
      base := base + 1;
      insert into public.tasks
        (project_id, room_id, name, notes, status, percent_complete,
         planned_start, planned_end, planned_hours, sort_order, created_by)
      values
        (v_project, r, src.name, src.notes, 'todo', 0,
         src.planned_start, src.planned_end, src.planned_hours, base, auth.uid())
      returning id into new_id;
      newmap := newmap || jsonb_build_object(src.id::text, new_id::text);
      created := created + 1;

      for m in select * from public.task_materials where task_id = src.id order by sort_order, created_at loop
        insert into public.task_materials (task_id, name, quantity, unit, sort_order, created_by)
        values (new_id, m.name, m.quantity, m.unit, m.sort_order, auth.uid())
        returning id into new_child;
        insert into public.material_prices (material_id, unit_cost)
        select new_child, unit_cost from public.material_prices where material_id = m.id;
      end loop;

      for e in select * from public.task_equipment where task_id = src.id order by sort_order, created_at loop
        insert into public.task_equipment (task_id, name, kind, ready, sort_order, created_by)
        values (new_id, e.name, e.kind, false, e.sort_order, auth.uid())
        returning id into new_child;
        insert into public.equipment_prices (equipment_id, cost)
        select new_child, cost from public.equipment_prices where equipment_id = e.id;
      end loop;
    end loop;

    -- Second pass: recreate waiting-on links between the copies.
    for src in
      select * from public.tasks where id = any(p_task_ids) and blocked_by = any(p_task_ids)
    loop
      update public.tasks
      set blocked_by = (newmap ->> src.blocked_by::text)::uuid
      where id = (newmap ->> src.id::text)::uuid;
    end loop;
  end loop;

  return created;
end;
$$;

-- ---------- Team: let an admin promote or demote people in the app ----------
-- Profiles are read-only from the app, so role changes go through this function, which
-- checks the caller is an admin and never lets the last admin be removed.

create or replace function public.set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change roles.';
  end if;
  if p_role not in ('admin', 'crew') then
    raise exception 'Role must be admin or crew.';
  end if;
  if p_role = 'crew'
     and (select role from public.profiles where id = p_user) = 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'There must be at least one admin.';
  end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then
    raise exception 'Person not found.';
  end if;
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
revoke all on function public.bulk_add_tasks(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.bulk_add_tasks(uuid, uuid[], jsonb) to authenticated;
revoke all on function public.copy_tasks(uuid[], uuid[]) from public, anon;
grant execute on function public.copy_tasks(uuid[], uuid[]) to authenticated;
