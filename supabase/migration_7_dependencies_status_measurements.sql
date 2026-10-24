-- ============================================================
-- Migration 7 (stage 4a of project management): several "waiting on" per task,
-- material ordered / delivered status, and room measurements
-- Run once in the Supabase SQL editor, BEFORE deploying the matching app code.
-- Requires migrations 4, 5 and 6 to have been run first.
-- Safe to re-run. Nothing is deleted: your existing "waiting on" links are copied
-- into the new table, and the old column is left in place (the app no longer uses it).
-- ============================================================

-- ---------- Several "waiting on" per task ----------

create table if not exists public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_id uuid not null references public.tasks(id) on delete cascade,
  primary key (task_id, depends_on_id),
  constraint task_dependencies_not_self check (task_id <> depends_on_id)
);
create index if not exists task_dependencies_depends_on_idx on public.task_dependencies (depends_on_id);

-- Bring over the single links made so far.
insert into public.task_dependencies (task_id, depends_on_id)
select id, blocked_by from public.tasks where blocked_by is not null
on conflict do nothing;

-- Both tasks must be in the same project, and a chain can never loop back on itself.
create or replace function public.task_dependencies_check()
returns trigger
language plpgsql
as $$
begin
  if (select project_id from public.tasks where id = new.task_id)
     is distinct from (select project_id from public.tasks where id = new.depends_on_id) then
    raise exception 'A task can only wait on another task in the same project.';
  end if;

  if exists (
    with recursive up(id) as (
      select new.depends_on_id
      union
      select d.depends_on_id from public.task_dependencies d join up on d.task_id = up.id
    )
    select 1 from up where id = new.task_id
  ) then
    raise exception 'That would make a loop: the other task already waits on this one.';
  end if;

  return new;
end;
$$;

drop trigger if exists task_dependencies_check_trg on public.task_dependencies;
create trigger task_dependencies_check_trg
  before insert on public.task_dependencies
  for each row execute function public.task_dependencies_check();

alter table public.task_dependencies enable row level security;

drop policy if exists "dependencies are readable by authenticated users" on public.task_dependencies;
create policy "dependencies are readable by authenticated users"
  on public.task_dependencies for select to authenticated using (true);

-- Changing what a task waits on is editing the task, which any signed-in user can do.
drop policy if exists "authenticated users can add dependencies" on public.task_dependencies;
create policy "authenticated users can add dependencies"
  on public.task_dependencies for insert to authenticated with check (true);

drop policy if exists "authenticated users can remove dependencies" on public.task_dependencies;
create policy "authenticated users can remove dependencies"
  on public.task_dependencies for delete to authenticated using (true);

-- ---------- Material status: To order -> Ordered -> Delivered ----------

alter table public.task_materials
  add column if not exists status text not null default 'to_order';
alter table public.task_materials add column if not exists ordered_on date;
alter table public.task_materials add column if not exists delivered_on date;
-- Set on copies, whose quantities were made for another room; cleared when someone confirms them.
alter table public.task_materials
  add column if not exists check_qty boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_materials_status_check') then
    alter table public.task_materials
      add constraint task_materials_status_check check (status in ('to_order', 'ordered', 'delivered'));
  end if;
end $$;

-- ---------- Room measurements ----------
-- Measurements belong to a room, or to the whole project when room_id is empty.
-- They hold no money, so everyone signed in can read and add them.

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  room_id uuid references public.project_rooms(id) on delete set null,
  label text not null check (length(trim(label)) > 0),
  value numeric(12, 3) not null check (value >= 0),
  unit text,
  note text,
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists measurements_project_id_idx on public.measurements (project_id);
create index if not exists measurements_room_id_idx on public.measurements (room_id);

alter table public.measurements enable row level security;

drop policy if exists "measurements are readable by authenticated users" on public.measurements;
create policy "measurements are readable by authenticated users"
  on public.measurements for select to authenticated using (true);

drop policy if exists "authenticated users can create measurements" on public.measurements;
create policy "authenticated users can create measurements"
  on public.measurements for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "authenticated users can update measurements" on public.measurements;
create policy "authenticated users can update measurements"
  on public.measurements for update to authenticated using (true) with check (true);

drop policy if exists "admins or creators can delete measurements" on public.measurements;
create policy "admins or creators can delete measurements"
  on public.measurements for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- ---------- Bulk add tasks (now with several parents per task) ----------
-- Each item may carry "parents": [0, 2] (positions of earlier items it waits on). The
-- older single "parent" is still understood.

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
  parents jsonb;
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

      parents := coalesce(item -> 'parents', '[]'::jsonb);
      if jsonb_typeof(parents) is distinct from 'array' then
        parents := '[]'::jsonb;
      end if;
      if jsonb_array_length(parents) = 0 and nullif(item ->> 'parent', '') is not null then
        parents := jsonb_build_array((item ->> 'parent')::int);
      end if;

      base := base + 1;
      insert into public.tasks (project_id, room_id, name, planned_hours, sort_order, created_by)
      values (
        p_project,
        r,
        trim(item ->> 'name'),
        nullif(item ->> 'hours', '')::numeric,
        base,
        auth.uid()
      )
      returning id into new_id;
      ids := ids || new_id;
      created := created + 1;

      for par in select distinct (x)::int from jsonb_array_elements_text(parents) x loop
        if par < 0 or par >= i then
          raise exception 'Task % waits on a task that does not come before it.', i + 1;
        end if;
        insert into public.task_dependencies (task_id, depends_on_id) values (new_id, ids[par + 1]);
      end loop;
    end loop;
  end loop;

  return created;
end;
$$;

-- ---------- Copy tasks to other rooms (now copies every link between copied tasks) ----------
-- Copied materials start as To order and are flagged "check quantity", because the
-- quantities were worked out for a different room.

create or replace function public.copy_tasks(p_task_ids uuid[], p_room_ids uuid[])
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project uuid;
  src record;
  dep record;
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
        insert into public.task_materials (task_id, name, quantity, unit, sort_order, created_by, status, check_qty)
        values (new_id, m.name, m.quantity, m.unit, m.sort_order, auth.uid(), 'to_order', true)
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

    -- Recreate every "waiting on" link that sits entirely inside the copied set.
    for dep in
      select * from public.task_dependencies
      where task_id = any(p_task_ids) and depends_on_id = any(p_task_ids)
    loop
      insert into public.task_dependencies (task_id, depends_on_id)
      values ((newmap ->> dep.task_id::text)::uuid, (newmap ->> dep.depends_on_id::text)::uuid);
    end loop;
  end loop;

  return created;
end;
$$;

revoke all on function public.bulk_add_tasks(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.bulk_add_tasks(uuid, uuid[], jsonb) to authenticated;
revoke all on function public.copy_tasks(uuid[], uuid[]) from public, anon;
grant execute on function public.copy_tasks(uuid[], uuid[]) to authenticated;
