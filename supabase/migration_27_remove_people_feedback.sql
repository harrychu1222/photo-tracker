-- Stage 1: managers can remove a person from their company, and anyone can send feedback.
--
-- Removing keeps the person's row (so their name stays on old tasks, photos and entries) but
-- they lose all access: current_company() is null for them, so they see nothing. A manager can
-- restore them. Run after migration 25 and 26.

alter table public.profiles add column if not exists removed_at timestamptz;

-- A removed person belongs to no company any more, as far as access goes.
create or replace function public.current_company()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.company_id from public.platform_support s join public.platform_owners o on o.user_id = s.user_id where s.user_id = auth.uid()),
    (select p.company_id from public.profiles p join public.companies c on c.id = p.company_id
      where p.id = auth.uid() and p.removed_at is null and c.status = 'active')
  )
$$;

create or replace function public.remove_company_member(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.profiles;
begin
  if public.in_support_mode() then raise exception 'Support mode is read-only.'; end if;
  if not public.is_admin() then raise exception 'Only a manager can remove people.'; end if;
  if p_user = auth.uid() then raise exception 'You cannot remove yourself.'; end if;
  select * into v from public.profiles where id = p_user and company_id = public.current_company() and removed_at is null;
  if not found then raise exception 'Person not found.'; end if;
  if v.role = 'admin' and (select count(*) from public.profiles where company_id = v.company_id and role = 'admin' and removed_at is null) <= 1 then
    raise exception 'There must be at least one manager.';
  end if;
  update public.profiles set removed_at = now() where id = p_user;
end;
$$;

create or replace function public.restore_company_member(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.in_support_mode() then raise exception 'Support mode is read-only.'; end if;
  if not public.is_admin() then raise exception 'Only a manager can restore people.'; end if;
  update public.profiles set removed_at = null where id = p_user and company_id = public.current_company();
  if not found then raise exception 'Person not found.'; end if;
end;
$$;

-- Role changes only apply to people who are still in the company.
create or replace function public.set_user_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.in_support_mode() then raise exception 'Support mode is read-only.'; end if;
  if not public.is_admin() then raise exception 'Only an admin can change roles.'; end if;
  if p_role not in ('admin', 'crew') then raise exception 'Role must be admin or crew.'; end if;
  if p_role = 'crew'
     and (select role from public.profiles where id = p_user and company_id = public.current_company() and removed_at is null) = 'admin'
     and (select count(*) from public.profiles where role = 'admin' and company_id = public.current_company() and removed_at is null) <= 1 then
    raise exception 'There must be at least one admin.';
  end if;
  update public.profiles set role = p_role where id = p_user and company_id = public.current_company() and removed_at is null;
  if not found then raise exception 'Person not found.'; end if;
end;
$$;

-- Owner's company list counts only people who are still in.
create or replace function public.platform_companies()
returns table (company_id uuid, name text, status text, created_at timestamptz, people bigint, managers bigint, projects bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
    select c.id, c.name, c.status, c.created_at,
           (select count(*) from public.profiles p where p.company_id = c.id and p.removed_at is null),
           (select count(*) from public.profiles p where p.company_id = c.id and p.role = 'admin' and p.removed_at is null),
           (select count(*) from public.projects j where j.company_id = c.id)
      from public.companies c order by c.created_at;
end;
$$;

-- Feedback from inside the app ----------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company() references public.companies(id),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  message text not null check (length(trim(message)) > 0 and length(message) <= 4000),
  page text,
  created_at timestamptz not null default now()
);
create index if not exists feedback_company_idx on public.feedback (company_id);
alter table public.feedback enable row level security;
drop policy if exists "send feedback" on public.feedback;
create policy "send feedback" on public.feedback for insert to authenticated with check (user_id = auth.uid());
-- (no read policy: only the app owner reads feedback, through platform_feedback)

drop policy if exists tenant_select on public.feedback;
create policy tenant_select on public.feedback as restrictive for select to public using (company_id = (select public.current_company()));
drop policy if exists tenant_insert on public.feedback;
create policy tenant_insert on public.feedback as restrictive for insert to public with check (company_id = (select public.current_company()) and not public.in_support_mode());
drop policy if exists tenant_update on public.feedback;
create policy tenant_update on public.feedback as restrictive for update to public using (company_id = (select public.current_company()) and not public.in_support_mode()) with check (company_id = (select public.current_company()) and not public.in_support_mode());
drop policy if exists tenant_delete on public.feedback;
create policy tenant_delete on public.feedback as restrictive for delete to public using (company_id = (select public.current_company()) and not public.in_support_mode());

create or replace function public.platform_feedback(p_limit int default 100)
returns table (at timestamptz, company_name text, who text, message text, page text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
    select f.created_at, c.name, u.email::text, f.message, f.page
      from public.feedback f
      left join public.companies c on c.id = f.company_id
      left join auth.users u on u.id = f.user_id
     order by f.created_at desc limit greatest(least(p_limit, 500), 1);
end;
$$;

revoke execute on function public.remove_company_member(uuid), public.restore_company_member(uuid), public.platform_feedback(int) from public, anon;
