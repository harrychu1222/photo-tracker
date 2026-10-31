-- Migration 14: materials that are not on a task yet.
-- A material can now be added from the Materials tab with no task, and linked to one later.
-- Safe to run more than once.

alter table public.task_materials alter column task_id drop not null;

alter table public.task_materials
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

create index if not exists task_materials_project_id_idx on public.task_materials (project_id);

-- Every material must belong to a task or to a project.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_materials_owner_check') then
    alter table public.task_materials
      add constraint task_materials_owner_check check (task_id is not null or project_id is not null);
  end if;
end $$;
