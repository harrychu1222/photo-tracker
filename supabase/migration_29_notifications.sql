-- Stage 6: notifications (in-app list, push to phones, 7am morning summary).
-- Needs migration 28 (variations). Run once in the Supabase SQL editor; safe to run again.
-- After this, follow the "Stage 6" steps in README.md (edge function, push keys, webhook).

alter table public.companies add column if not exists timezone text not null default 'Australia/Melbourne';
alter table public.companies add column if not exists last_summary_on date;

-- ---------- tables ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company() references public.companies(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  project_id uuid references public.projects(id) on delete cascade,
  tab text,                                   -- which tab to open inside the project
  push boolean not null default false,        -- should the phone get a push for this one
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null default public.current_company() references public.companies(id),
  kinds jsonb not null default '{}'::jsonb,   -- { "task_done": { "app": true, "push": false }, ... }
  email_morning boolean not null default true,
  variation_days int not null default 3 check (variation_days between 1 and 60),
  defect_days int not null default 7 check (defect_days between 1 and 90),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_mutes (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  company_id uuid not null default public.current_company() references public.companies(id),
  primary key (user_id, project_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null default public.current_company() references public.companies(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

drop trigger if exists company_match_project_id on public.notification_mutes;
create trigger company_match_project_id before insert or update on public.notification_mutes
  for each row execute function public.enforce_same_company('projects', 'project_id');

-- ---------- security: everyone sees and changes only their own rows ----------
do $$
declare t text;
begin
  foreach t in array array['notifications', 'notification_prefs', 'notification_mutes', 'push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_select on public.%I', t);
    execute format('create policy own_select on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('create policy tenant_select on public.%I as restrictive for select to public using (company_id = (select public.current_company()))', t);
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('create policy tenant_insert on public.%I as restrictive for insert to public with check (company_id = (select public.current_company()) and not public.in_support_mode())', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format('create policy tenant_update on public.%I as restrictive for update to public using (company_id = (select public.current_company()) and not public.in_support_mode()) with check (company_id = (select public.current_company()) and not public.in_support_mode())', t);
    execute format('drop policy if exists tenant_delete on public.%I', t);
    execute format('create policy tenant_delete on public.%I as restrictive for delete to public using (company_id = (select public.current_company()) and not public.in_support_mode())', t);
  end loop;
end $$;
-- notifications: people may mark read / delete their own, but only the system creates them.
drop policy if exists own_update on public.notifications;
create policy own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists own_delete on public.notifications;
create policy own_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
-- settings, mutes and push subscriptions: people manage their own.
do $$
declare t text;
begin
  foreach t in array array['notification_prefs', 'notification_mutes', 'push_subscriptions'] loop
    execute format('drop policy if exists own_insert on public.%I', t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('drop policy if exists own_update on public.%I', t);
    execute format('create policy own_update on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('drop policy if exists own_delete on public.%I', t);
    execute format('create policy own_delete on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------- who gets what ----------
create or replace function public.notif_push_default(p_kind text)
returns boolean language sql immutable as $$
  select p_kind in ('task_blocked', 'defect_urgent', 'task_assigned', 'task_changed', 'morning_summary')
$$;

-- Adds one notification per person: skips the person who did it, removed people, muted jobs,
-- and anyone who turned this kind off in the app.
create or replace function public.notify_users(
  p_company uuid, p_project uuid, p_kind text, p_title text, p_body text,
  p_actor uuid, p_audience text, p_user uuid default null, p_tab text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (company_id, user_id, kind, title, body, project_id, tab, push)
  select p_company, pr.id, p_kind, p_title, p_body, p_project, p_tab,
         coalesce((np.kinds -> p_kind ->> 'push')::boolean, public.notif_push_default(p_kind))
    from public.profiles pr
    left join public.notification_prefs np on np.user_id = pr.id
   where pr.company_id = p_company and pr.removed_at is null
     and (case p_audience when 'managers' then pr.role = 'admin' when 'user' then pr.id = p_user else false end)
     and pr.id is distinct from p_actor
     and coalesce((np.kinds -> p_kind ->> 'app')::boolean, true)
     and not exists (select 1 from public.notification_mutes m where m.user_id = pr.id and m.project_id = p_project);
end $$;
revoke execute on function public.notify_users(uuid, uuid, text, text, text, uuid, text, uuid, text) from public, anon, authenticated;

-- ---------- the events ----------
create or replace function public.notify_task_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare pname text; who uuid := auth.uid(); just_assigned boolean := false;
begin
  select name into pname from public.projects where id = new.project_id;
  if tg_op = 'UPDATE' and new.status = 'done' and old.status is distinct from 'done' then
    perform public.notify_users(new.company_id, new.project_id, 'task_done', 'Task finished', new.name || ' · ' || pname, who, 'managers', null, 'plan');
  end if;
  if tg_op = 'UPDATE' and new.status = 'blocked' and old.status is distinct from 'blocked' then
    perform public.notify_users(new.company_id, new.project_id, 'task_blocked', 'Task blocked', new.name || ' · ' || pname, who, 'managers', null, 'plan');
  end if;
  if new.assigned_user is not null and (tg_op = 'INSERT' or new.assigned_user is distinct from old.assigned_user) then
    just_assigned := true;
    perform public.notify_users(new.company_id, new.project_id, 'task_assigned', 'New task for you', new.name || ' · ' || pname || coalesce(' · starts ' || to_char(new.planned_start, 'DD Mon'), ''), who, 'user', new.assigned_user, 'plan');
  end if;
  if tg_op = 'UPDATE' and not just_assigned and new.assigned_user is not null and new.status <> 'done' and (
       (new.status = 'blocked' and old.status is distinct from 'blocked')
       or new.planned_start is distinct from old.planned_start or new.planned_end is distinct from old.planned_end) then
    perform public.notify_users(new.company_id, new.project_id, 'task_changed',
      case when new.status = 'blocked' then 'Your task is blocked' else 'Your task was rescheduled' end,
      new.name || ' · ' || pname, who, 'user', new.assigned_user, 'plan');
  end if;
  return new;
end $$;
drop trigger if exists notify_task_change on public.tasks;
create trigger notify_task_change after insert or update on public.tasks for each row execute function public.notify_task_change();

create or replace function public.notify_defect()
returns trigger language plpgsql security definer set search_path = public as $$
declare pname text;
begin
  select name into pname from public.projects where id = new.project_id;
  perform public.notify_users(new.company_id, new.project_id,
    case when new.priority = 'urgent' then 'defect_urgent' else 'defect_new' end,
    case when new.priority = 'urgent' then 'Urgent defect' else 'New defect' end,
    new.title || ' · ' || pname, auth.uid(), 'managers', null, 'defects');
  return new;
end $$;
drop trigger if exists notify_defect on public.defects;
create trigger notify_defect after insert on public.defects for each row execute function public.notify_defect();

create or replace function public.notify_issue()
returns trigger language plpgsql security definer set search_path = public as $$
declare pname text;
begin
  select name into pname from public.projects where id = new.project_id;
  perform public.notify_users(new.company_id, new.project_id, 'issue_new', 'Site issue', new.text || ' · ' || pname, auth.uid(), 'managers', null, 'site');
  return new;
end $$;
drop trigger if exists notify_issue on public.diary_issues;
create trigger notify_issue after insert on public.diary_issues for each row execute function public.notify_issue();

create or replace function public.notify_expense()
returns trigger language plpgsql security definer set search_path = public as $$
declare pname text;
begin
  select name into pname from public.projects where id = new.project_id;
  perform public.notify_users(new.company_id, new.project_id, 'expense_new', 'New expense', new.description || ' · $' || trim(to_char(new.amount_ex_gst, 'FM999,999,990.00')) || ' · ' || pname, auth.uid(), 'managers', null, 'money');
  return new;
end $$;
drop trigger if exists notify_expense on public.expenses;
create trigger notify_expense after insert on public.expenses for each row execute function public.notify_expense();

-- ---------- the 7am summary ----------
-- Runs every hour; each company gets its summary once a day, when it is 7am where the company is.
create or replace function public.run_morning_summary(p_force boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare
  c record; u record; today date; lines text[]; n int; total int := 0; muted uuid[];
begin
  delete from public.notifications where created_at < now() - interval '60 days';
  for c in select id, timezone, last_summary_on from public.companies loop
    today := (now() at time zone c.timezone)::date;
    continue when not p_force and (extract(hour from now() at time zone c.timezone) <> 7 or c.last_summary_on = today);
    update public.companies set last_summary_on = today where id = c.id;
    for u in
      select p.id, p.role, np.kinds, coalesce(np.variation_days, 3) as vd, coalesce(np.defect_days, 7) as dd
        from public.profiles p left join public.notification_prefs np on np.user_id = p.id
       where p.company_id = c.id and p.removed_at is null
    loop
      continue when coalesce((u.kinds -> 'morning_summary' ->> 'app')::boolean, true) = false;
      select coalesce(array_agg(project_id), '{}'::uuid[]) into muted from public.notification_mutes where user_id = u.id;
      lines := '{}';
      if u.role = 'admin' then
        select count(*) into n from public.tasks t join public.projects pj on pj.id = t.project_id
         where t.company_id = c.id and pj.status = 'active' and t.status <> 'done' and t.planned_end < today and not (t.project_id = any (muted));
        if n > 0 then lines := lines || format('%s overdue task%s', n, case when n = 1 then '' else 's' end); end if;
        select count(*) into n from public.task_materials m join public.tasks t on t.id = m.task_id
         where m.company_id = c.id and m.status <> 'delivered' and m.expected_on between today and today + 1 and not (t.project_id = any (muted));
        if n > 0 then lines := lines || format('%s material delivery due today or tomorrow', n); end if;
        select count(*) into n from public.task_materials m join public.tasks t on t.id = m.task_id
         where m.company_id = c.id and m.status = 'to_order' and t.status <> 'done' and t.planned_start between today and today + 3 and not (t.project_id = any (muted));
        if n > 0 then lines := lines || format('%s material%s not ordered for a task starting within 3 days', n, case when n = 1 then '' else 's' end); end if;
        if to_regclass('public.variations') is not null then
          execute 'select count(*) from public.variations where company_id = $1 and status = ''pending'' and raised_on <= $2 - $3 and not (project_id = any ($4))'
            into n using c.id, today, u.vd, muted;
          if n > 0 then lines := lines || format('%s variation%s waiting for a yes for over %s days', n, case when n = 1 then '' else 's' end, u.vd); end if;
        end if;
        select count(*) into n from public.defects d
         where d.company_id = c.id and d.status <> 'fixed' and d.raised_on <= today - u.dd and not (d.project_id = any (muted));
        if n > 0 then lines := lines || format('%s defect%s open for over %s days', n, case when n = 1 then '' else 's' end, u.dd); end if;
      else
        select count(*) into n from public.tasks t
         where t.company_id = c.id and t.assigned_user = u.id and t.status <> 'done' and not (t.project_id = any (muted))
           and t.planned_start <= today and coalesce(t.planned_end, t.planned_start) >= today;
        if n > 0 then lines := lines || format('%s task%s today', n, case when n = 1 then '' else 's' end); end if;
        select count(*) into n from public.tasks t
         where t.company_id = c.id and t.assigned_user = u.id and t.status <> 'done' and not (t.project_id = any (muted)) and t.planned_end < today;
        if n > 0 then lines := lines || format('%s overdue', n); end if;
      end if;
      if coalesce(array_length(lines, 1), 0) > 0 then
        insert into public.notifications (company_id, user_id, kind, title, body, push)
        values (c.id, u.id, 'morning_summary', 'Good morning', array_to_string(lines, E'\n'),
                coalesce((u.kinds -> 'morning_summary' ->> 'push')::boolean, true));
        total := total + 1;
      end if;
    end loop;
  end loop;
  return total;
end $$;
revoke execute on function public.run_morning_summary(boolean) from public, anon, authenticated;

-- Schedule it every hour (needs the pg_cron extension; Supabase: Database > Extensions).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('site-log-morning-summary', '0 * * * *', 'select public.run_morning_summary()');
exception when others then
  raise notice 'Could not schedule the morning summary automatically (%). Enable pg_cron in Database > Extensions, then run this file again.', sqlerrm;
end $$;
