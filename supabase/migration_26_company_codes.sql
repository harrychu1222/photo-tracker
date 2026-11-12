-- M2b: the app owner chooses the invite codes when creating a company.
-- A company gets two codes: one manager code (one use; the new manager signs up with it) and one
-- crew code (many uses; the manager hands it to their crew). Managers can still make or remove
-- codes on the Team page. Codes are case-sensitive, 6-40 characters, no spaces.

drop function if exists public.platform_create_company(text);

create or replace function public.platform_check_code(p_code text)
returns text language plpgsql set search_path = public as $$
declare c text := trim(coalesce(p_code, ''));
begin
  if length(c) < 6 or length(c) > 40 or c ~ '\s' then
    raise exception 'A code needs 6 to 40 characters with no spaces.';
  end if;
  if exists (select 1 from public.invite_codes where code = c) then
    raise exception 'The code "%" is already used. Pick another.', c;
  end if;
  return c;
end;
$$;

create or replace function public.platform_create_company(p_name text, p_admin_code text, p_crew_code text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid; a text; c text;
begin
  if not public.is_platform_owner() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Type a company name.'; end if;
  a := public.platform_check_code(p_admin_code);
  if nullif(trim(coalesce(p_crew_code, '')), '') is not null then
    c := public.platform_check_code(p_crew_code);
    if c = a then raise exception 'The two codes must be different.'; end if;
  end if;
  insert into public.companies (name) values (trim(p_name)) returning id into v_company;
  insert into public.invite_codes (code, label, max_uses, uses, expires_at, role, company_id)
  values (a, 'Manager of ' || trim(p_name), 1, 0, now() + interval '30 days', 'admin', v_company);
  if c is not null then
    insert into public.invite_codes (code, label, max_uses, uses, expires_at, role, company_id)
    values (c, 'Crew of ' || trim(p_name), 100, 0, now() + interval '365 days', 'crew', v_company);
  end if;
  insert into public.platform_audit (user_id, company_id, action) values (auth.uid(), v_company, 'create_company');
end;
$$;

-- Add (or replace the wish for) another code on an existing company.
create or replace function public.platform_add_invite(p_company uuid, p_code text, p_role text, p_max_uses int default 1, p_days int default 30)
returns void language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_platform_owner() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if p_role not in ('admin', 'crew') then raise exception 'Role must be admin or crew.'; end if;
  if not exists (select 1 from public.companies where id = p_company) then raise exception 'Company not found.'; end if;
  c := public.platform_check_code(p_code);
  insert into public.invite_codes (code, label, max_uses, uses, expires_at, role, company_id)
  values (c, 'Added by app owner', greatest(p_max_uses, 1), 0, now() + make_interval(days => greatest(p_days, 1)), p_role, p_company);
  insert into public.platform_audit (user_id, company_id, action, reason) values (auth.uid(), p_company, 'add_invite', p_role);
end;
$$;

revoke execute on function public.platform_check_code(text), public.platform_create_company(text, text, text),
  public.platform_add_invite(uuid, text, text, int, int) from public, anon;
