-- ============================================================
-- Migration 9 (stage 4b-2): expenses and receipt photos
-- Run once in the Supabase SQL editor, BEFORE deploying the matching app code.
-- Requires migrations 4 to 8 to have been run first.
-- Safe to re-run. Nothing existing is changed.
-- ============================================================

-- ---------- Expenses ----------
-- What was actually paid. Amounts are stored ex-GST (the app converts an amount that
-- includes GST before saving). A negative amount is a refund or credit note.
-- Admins see every expense; crew can add expenses and see only their own.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  expense_date date not null default current_date,
  supplier text,
  description text not null check (length(trim(description)) > 0),
  category text not null default 'materials'
    check (category in ('materials', 'equipment', 'subcontractor', 'other')),
  amount_ex_gst numeric(12, 2) not null,
  -- The material line this paid for, if any (one expense, one material line).
  material_id uuid references public.task_materials(id) on delete set null,
  receipt_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists expenses_project_id_idx on public.expenses (project_id);
create index if not exists expenses_material_id_idx on public.expenses (material_id);
create index if not exists expenses_date_idx on public.expenses (expense_date);

-- A linked material must belong to the same project as the expense.
create or replace function public.expenses_check_material()
returns trigger
language plpgsql
as $$
begin
  if new.material_id is not null and not exists (
    select 1
    from public.task_materials m
    join public.tasks t on t.id = m.task_id
    where m.id = new.material_id and t.project_id = new.project_id
  ) then
    raise exception 'That material is not in this project.';
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_check_material_trg on public.expenses;
create trigger expenses_check_material_trg
  before insert or update of material_id, project_id on public.expenses
  for each row execute function public.expenses_check_material();

alter table public.expenses enable row level security;

drop policy if exists "admins see all expenses, crew their own" on public.expenses;
create policy "admins see all expenses, crew their own"
  on public.expenses for select to authenticated
  using (public.is_admin() or created_by = auth.uid());

drop policy if exists "authenticated users can add their own expenses" on public.expenses;
create policy "authenticated users can add their own expenses"
  on public.expenses for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "admins or creators can update expenses" on public.expenses;
create policy "admins or creators can update expenses"
  on public.expenses for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists "admins or creators can delete expenses" on public.expenses;
create policy "admins or creators can delete expenses"
  on public.expenses for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- ---------- Receipt photos: their own private bucket ----------
-- Separate from the site photos so crew cannot browse receipts. Files live in a folder named
-- after whoever uploaded them. The uploader and admins can view and remove them.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "users can upload receipts into their own folder" on storage.objects;
create policy "users can upload receipts into their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owners and admins can view receipts" on storage.objects;
create policy "owners and admins can view receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "owners and admins can remove receipts" on storage.objects;
create policy "owners and admins can remove receipts"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
