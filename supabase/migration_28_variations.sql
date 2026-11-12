-- Stage 5: variations (changes to the agreed job, with a price) recorded per project.
-- Managers only. Run once in the Supabase SQL editor; safe to run again.
create table if not exists public.variations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company() references public.companies(id),
  project_id uuid not null references public.projects(id) on delete cascade,
  number int not null default 0,
  title text not null check (length(trim(title)) > 0),
  description text,
  amount numeric(12, 2) not null default 0,          -- extra (+) or credit (-)
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  raised_on date not null default current_date,
  decided_on date,
  approved_by text,                                   -- who agreed, e.g. the client's name
  approved_how text,                                  -- e.g. Email, Verbal, Signed
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists variations_project_idx on public.variations (project_id);
create index if not exists variations_company_idx on public.variations (company_id);

-- Numbers run 1, 2, 3 within each project.
create or replace function public.variation_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' and coalesce(new.number, 0) = 0 then
    perform pg_advisory_xact_lock(hashtext(new.project_id::text));
    select coalesce(max(number), 0) + 1 into new.number from public.variations where project_id = new.project_id;
  end if;
  return new;
end $$;
drop trigger if exists variation_number on public.variations;
create trigger variation_number before insert on public.variations for each row execute function public.variation_number();

drop trigger if exists company_match_project_id on public.variations;
create trigger company_match_project_id before insert or update on public.variations
  for each row execute function public.enforce_same_company('projects', 'project_id');

alter table public.variations enable row level security;
drop policy if exists "variations managers read" on public.variations;
create policy "variations managers read" on public.variations for select to authenticated using (public.is_admin());
drop policy if exists "variations managers insert" on public.variations;
create policy "variations managers insert" on public.variations for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
drop policy if exists "variations managers update" on public.variations;
create policy "variations managers update" on public.variations for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "variations managers delete" on public.variations;
create policy "variations managers delete" on public.variations for delete to authenticated using (public.is_admin());

drop policy if exists tenant_select on public.variations;
create policy tenant_select on public.variations as restrictive for select to public using (company_id = (select public.current_company()));
drop policy if exists tenant_insert on public.variations;
create policy tenant_insert on public.variations as restrictive for insert to public with check (company_id = (select public.current_company()) and not public.in_support_mode());
drop policy if exists tenant_update on public.variations;
create policy tenant_update on public.variations as restrictive for update to public using (company_id = (select public.current_company()) and not public.in_support_mode()) with check (company_id = (select public.current_company()) and not public.in_support_mode());
drop policy if exists tenant_delete on public.variations;
create policy tenant_delete on public.variations as restrictive for delete to public using (company_id = (select public.current_company()) and not public.in_support_mode());
