-- M1: separate spaces for each company.
--
-- READ FIRST: take a backup of your database before running this, and deploy the matching app
-- version (which fixes three "on conflict" targets) right after. See README "Companies (M1)".
--
-- How it works
--  * Every row of every table belongs to one company (company_id). Existing data goes to one
--    default company, created here. Nothing is deleted or changed otherwise.
--  * Each person belongs to exactly one company (profiles.company_id), with the role they
--    already have (admin = manager, crew).
--  * company_id fills in by itself on insert (current_company()), so the app does not need to
--    send it, and a person can never read or write another company's rows.
--  * The isolation is done with RESTRICTIVE policies added to every table. They are AND-ed
--    with all the existing rules (money stays manager-only inside a company), so no existing
--    rule is weakened or rewritten.
--  * A trigger refuses a row that points at another company's project, task, etc.
--  * Storage: the photos and receipts buckets get company-aware read rules.
--  * The app owner (platform_owners) has no automatic access to company data. To look inside
--    a company they start a READ-ONLY support session with a reason; it is logged.
--
-- Tables you add in future must get a company_id column too; copy the pattern at the end.

-- 1. Companies and platform tables ---------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);
alter table public.companies enable row level security;

create table if not exists public.platform_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_owners enable row level security;

create table if not exists public.platform_support (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  reason text,
  started_at timestamptz not null default now()
);
alter table public.platform_support enable row level security;

create table if not exists public.platform_audit (
  id bigint generated always as identity primary key,
  user_id uuid,
  company_id uuid,
  action text not null,
  reason text,
  at timestamptz not null default now()
);
alter table public.platform_audit enable row level security;
-- (no policies on the three platform tables: only the functions below can use them)

insert into public.companies (name)
select 'My company' where not exists (select 1 from public.companies);

-- 2. People belong to a company -------------------------------------------------------------
alter table public.profiles add column if not exists company_id uuid references public.companies(id);
update public.profiles set company_id = (select id from public.companies order by created_at limit 1) where company_id is null;
alter table public.profiles alter column company_id set not null;

-- 3. Helper functions -------------------------------------------------------------------------
create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_owners where user_id = auth.uid())
$$;

create or replace function public.in_support_mode()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_support s join public.platform_owners o on o.user_id = s.user_id where s.user_id = auth.uid())
$$;

-- The company whose data this person sees: their own (if it is active), or, for the app owner
-- in a support session, the company being looked at.
create or replace function public.current_company()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.company_id from public.platform_support s join public.platform_owners o on o.user_id = s.user_id where s.user_id = auth.uid()),
    (select p.company_id from public.profiles p join public.companies c on c.id = p.company_id where p.id = auth.uid() and c.status = 'active')
  )
$$;

-- Manager of the current company (or the app owner in a read-only support session).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.company_id = public.current_company())
         or public.in_support_mode()
$$;

-- 4. company_id on every table -----------------------------------------------------------------
do $$
declare
  t text;
  c uuid := (select id from public.companies order by created_at limit 1);
begin
  for t in
    select tablename from pg_tables
     where schemaname = 'public' and tablename not in ('companies', 'platform_owners', 'platform_support', 'platform_audit')
  loop
    execute format('alter table public.%I add column if not exists company_id uuid references public.companies(id)', t);
    execute format('update public.%I set company_id = %L where company_id is null', t, c);
    if t <> 'invite_codes' then  -- a code typed in by hand without a company is refused at sign-up instead
      execute format('alter table public.%I alter column company_id set not null', t);
    end if;
    if t not in ('profiles', 'invite_codes') then
      execute format('alter table public.%I alter column company_id set default public.current_company()', t);
    end if;
    execute format('create index if not exists %I on public.%I (company_id)', t || '_company_idx', t);
  end loop;
end $$;

-- 5. Isolation: restrictive policies on every table ------------------------------------------------
do $$
declare
  t text;
  sel text;
begin
  for t in
    select tablename from pg_tables
     where schemaname = 'public' and tablename not in ('companies', 'platform_owners', 'platform_support', 'platform_audit')
  loop
    sel := case when t = 'profiles'
                then 'company_id = (select public.current_company()) or id = auth.uid()'
                else 'company_id = (select public.current_company())' end;
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('create policy tenant_select on public.%I as restrictive for select to public using (%s)', t, sel);
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('create policy tenant_insert on public.%I as restrictive for insert to public with check (company_id = (select public.current_company()) and not public.in_support_mode())', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format('create policy tenant_update on public.%I as restrictive for update to public using (company_id = (select public.current_company()) and not public.in_support_mode()) with check (company_id = (select public.current_company()) and not public.in_support_mode())', t);
    execute format('drop policy if exists tenant_delete on public.%I', t);
    execute format('create policy tenant_delete on public.%I as restrictive for delete to public using (company_id = (select public.current_company()) and not public.in_support_mode())', t);
  end loop;
end $$;

-- A person can read their own company's row.
drop policy if exists "read own company" on public.companies;
create policy "read own company" on public.companies for select to authenticated using (id = (select public.current_company()));
-- Managers can see their company's invite codes.
drop policy if exists "managers read company invites" on public.invite_codes;
create policy "managers read company invites" on public.invite_codes for select to authenticated using (public.is_admin());

-- 6. A row may not point at another company's project, task, etc. ---------------------------------
create or replace function public.enforce_same_company()
returns trigger language plpgsql set search_path = public as $$
declare
  v uuid := (to_jsonb(new) ->> tg_argv[1])::uuid;
  ok boolean;
begin
  if v is null then return new; end if;
  execute format('select exists (select 1 from public.%I where id = $1 and company_id = $2)', tg_argv[0]) into ok using v, new.company_id;
  if not ok then
    raise exception 'That item belongs to a different company.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare
  r record;
begin
  for r in
    select c.table_name::text as t, 'projects'::text as parent, 'project_id'::text as fk
      from information_schema.columns c
      join pg_tables p on p.schemaname = 'public' and p.tablename = c.table_name
     where c.table_schema = 'public' and c.column_name = 'project_id'
    union all select 'task_dependencies', 'tasks', 'task_id'
    union all select 'task_equipment', 'tasks', 'task_id'
    union all select 'material_prices', 'task_materials', 'material_id'
    union all select 'equipment_prices', 'task_equipment', 'equipment_id'
    union all select 'time_entry_rates', 'time_entries', 'entry_id'
  loop
    execute format('drop trigger if exists company_match_%s on public.%I', r.fk, r.t);
    execute format('create trigger company_match_%s before insert or update on public.%I for each row execute function public.enforce_same_company(%L, %L)', r.fk, r.t, r.parent, r.fk);
  end loop;
end $$;

-- 7. Rows that were one-per-database are now one-per-company -------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.business_profile'::regclass and contype = 'p' and pg_get_constraintdef(oid) = 'PRIMARY KEY (company_id)') then
    alter table public.business_profile drop constraint if exists business_profile_pkey;
    alter table public.business_profile drop constraint if exists business_profile_singleton_check;
    alter table public.business_profile add primary key (company_id);
  end if;
end $$;
alter table public.checklist_templates drop constraint if exists checklist_templates_name_key;
create unique index if not exists checklist_templates_company_name_idx on public.checklist_templates (company_id, name);
drop index if exists public.task_workers_name_idx;
create unique index if not exists task_workers_company_name_idx on public.task_workers (company_id, lower(name));

-- 8. Sign-up joins the company of the invite code ----------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_company uuid;
begin
  select role, company_id into v_role, v_company from public.invite_codes where code = new.raw_user_meta_data ->> 'invite_code';
  if v_company is null then
    raise exception 'This invite code is not linked to a company.';
  end if;
  insert into public.profiles (id, email, role, company_id) values (new.id, new.email, coalesce(v_role, 'crew'), v_company);
  return new;
end;
$$;

create or replace function public.set_user_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.in_support_mode() then raise exception 'Support mode is read-only.'; end if;
  if not public.is_admin() then raise exception 'Only an admin can change roles.'; end if;
  if p_role not in ('admin', 'crew') then raise exception 'Role must be admin or crew.'; end if;
  if p_role = 'crew'
     and (select role from public.profiles where id = p_user and company_id = public.current_company()) = 'admin'
     and (select count(*) from public.profiles where role = 'admin' and company_id = public.current_company()) <= 1 then
    raise exception 'There must be at least one admin.';
  end if;
  update public.profiles set role = p_role where id = p_user and company_id = public.current_company();
  if not found then raise exception 'Person not found.'; end if;
end;
$$;

-- 9. Company managers: invite people, rename the company ---------------------------------------------
create or replace function public.create_company_invite(p_label text default null, p_role text default 'crew', p_max_uses int default 1, p_days int default 14)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if public.in_support_mode() then raise exception 'Support mode is read-only.'; end if;
  if not public.is_admin() then raise exception 'Only a manager can invite people.'; end if;
  if p_role not in ('admin', 'crew') then raise exception 'Role must be admin or crew.'; end if;
  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.invite_codes (code, label, max_uses, uses, expires_at, role, company_id)
  values (v_code, p_label, greatest(p_max_uses, 1), 0, now() + make_interval(days => greatest(p_days, 1)), p_role, public.current_company());
  return v_code;
end;
$$;

create or replace function public.revoke_company_invite(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.in_support_mode() then raise exception 'Support mode is read-only.'; end if;
  if not public.is_admin() then raise exception 'Only a manager can remove invites.'; end if;
  delete from public.invite_codes where code = p_code and company_id = public.current_company();
end;
$$;

create or replace function public.rename_company(p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.in_support_mode() then raise exception 'Support mode is read-only.'; end if;
  if not public.is_admin() then raise exception 'Only a manager can rename the company.'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Type a company name.'; end if;
  update public.companies set name = trim(p_name) where id = public.current_company();
end;
$$;

-- 10. App owner: companies, read-only support sessions, audit log --------------------------------------
create or replace function public.platform_companies()
returns table (company_id uuid, name text, status text, created_at timestamptz, people bigint, managers bigint, projects bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
    select c.id, c.name, c.status, c.created_at,
           (select count(*) from public.profiles p where p.company_id = c.id),
           (select count(*) from public.profiles p where p.company_id = c.id and p.role = 'admin'),
           (select count(*) from public.projects j where j.company_id = c.id)
      from public.companies c order by c.created_at;
end;
$$;

-- Creates a company and returns a one-time code. Whoever signs up with it becomes its first manager.
create or replace function public.platform_create_company(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_code text;
begin
  if not public.is_platform_owner() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Type a company name.'; end if;
  insert into public.companies (name) values (trim(p_name)) returning id into v_company;
  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.invite_codes (code, label, max_uses, uses, expires_at, role, company_id)
  values (v_code, 'First manager of ' || trim(p_name), 1, 0, now() + interval '14 days', 'admin', v_company);
  insert into public.platform_audit (user_id, company_id, action) values (auth.uid(), v_company, 'create_company');
  return v_code;
end;
$$;

create or replace function public.platform_set_company_status(p_company uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'Status must be active or suspended.'; end if;
  update public.companies set status = p_status where id = p_company;
  insert into public.platform_audit (user_id, company_id, action, reason) values (auth.uid(), p_company, 'set_status', p_status);
end;
$$;

create or replace function public.start_support(p_company uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason for looking inside this company.'; end if;
  if not exists (select 1 from public.companies where id = p_company) then raise exception 'Company not found.'; end if;
  insert into public.platform_support (user_id, company_id, reason) values (auth.uid(), p_company, trim(p_reason))
  on conflict (user_id) do update set company_id = excluded.company_id, reason = excluded.reason, started_at = now();
  insert into public.platform_audit (user_id, company_id, action, reason) values (auth.uid(), p_company, 'start_support', trim(p_reason));
end;
$$;

create or replace function public.stop_support()
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  if not public.is_platform_owner() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  delete from public.platform_support where user_id = auth.uid() returning company_id into v_company;
  if v_company is not null then
    insert into public.platform_audit (user_id, company_id, action) values (auth.uid(), v_company, 'stop_support');
  end if;
end;
$$;

-- For the "you are viewing <company>" banner: returns a row only while a support session is on.
create or replace function public.support_status()
returns table (company_id uuid, company_name text, reason text, started_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.company_id, c.name, s.reason, s.started_at
    from public.platform_support s join public.companies c on c.id = s.company_id
   where s.user_id = auth.uid() and public.is_platform_owner()
$$;

create or replace function public.platform_audit_log(p_limit int default 200)
returns table (at timestamptz, who text, company_name text, action text, reason text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
    select a.at, u.email::text, c.name, a.action, a.reason
      from public.platform_audit a
      left join auth.users u on u.id = a.user_id
      left join public.companies c on c.id = a.company_id
     order by a.at desc limit greatest(least(p_limit, 1000), 1);
end;
$$;

-- Only signed-in people may call these (the ones that act check who is calling).
revoke execute on function public.platform_companies(), public.platform_create_company(text), public.platform_set_company_status(uuid, text),
  public.start_support(uuid, text), public.stop_support(), public.support_status(), public.platform_audit_log(int),
  public.create_company_invite(text, text, int, int), public.revoke_company_invite(text), public.rename_company(text),
  public.set_user_role(uuid, text) from public, anon;

-- 11. Storage: photos and receipts follow the company ------------------------------------------------------
drop policy if exists "authenticated users can view site photos" on storage.objects;
create policy "authenticated users can view site photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.photos p where p.storage_path = storage.objects.name and p.company_id = (select public.current_company()))
  ));

drop policy if exists "users can upload into their own folder" on storage.objects;
create policy "users can upload into their own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text and not public.in_support_mode());

drop policy if exists "users can delete their own uploads" on storage.objects;
create policy "users can delete their own uploads" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text and not public.in_support_mode());

drop policy if exists "users can upload receipts into their own folder" on storage.objects;
create policy "users can upload receipts into their own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text and not public.in_support_mode());

drop policy if exists "owners and admins can view receipts" on storage.objects;
create policy "owners and admins can view receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (public.is_admin() and exists (select 1 from public.expenses e where e.receipt_path = storage.objects.name and e.company_id = (select public.current_company())))
  ));

drop policy if exists "owners and admins can remove receipts" on storage.objects;
create policy "owners and admins can remove receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and not public.in_support_mode() and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (public.is_admin() and exists (select 1 from public.expenses e where e.receipt_path = storage.objects.name and e.company_id = (select public.current_company())))
  ));

-- Pattern for a future table:
--   alter table public.new_table add column company_id uuid not null default public.current_company() references public.companies(id);
--   then re-run the "Isolation" loop (section 5) or copy its four restrictive policies.
