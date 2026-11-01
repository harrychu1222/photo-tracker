-- Your own task templates (saved from the new-project questionnaire).
create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  room_type text not null,
  items jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.task_templates enable row level security;
drop policy if exists "templates readable" on public.task_templates;
create policy "templates readable" on public.task_templates for select to authenticated using (true);
drop policy if exists "templates insert own" on public.task_templates;
create policy "templates insert own" on public.task_templates for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "templates delete own or admin" on public.task_templates;
create policy "templates delete own or admin" on public.task_templates for delete to authenticated using (created_by = auth.uid() or public.is_admin());
