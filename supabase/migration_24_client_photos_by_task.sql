-- F5b: the client page shows the photos of finished tasks under each task, automatically.
-- Photos are no longer copied into a public bucket. A small server function (Edge Function
-- "client-photos") checks the link and returns short-lived addresses for the private photos.
--
--  * client_photo_choices: a manager's override per photo. share = true shows it even if its
--    task is not done; share = false hides it even if its task is done.
--  * Default (no choice): a photo is visible when it is linked to a task that is Done.
--  * client_view now returns each photo's id (never its storage path) and each task's id.
--  * client_photo_paths(token) returns storage paths and can only be called by the server
--    function (service_role), never by the public or by signed-in users.

create table if not exists public.client_photo_choices (
  project_id uuid not null references public.projects(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  share boolean not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (project_id, photo_id)
);
alter table public.client_photo_choices enable row level security;
drop policy if exists "client choices admin" on public.client_photo_choices;
create policy "client choices admin" on public.client_photo_choices for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Photos you had ticked in the first version stay shared.
insert into public.client_photo_choices (project_id, photo_id, share, created_by)
select project_id, photo_id, true, created_by from public.client_shared_photos
on conflict do nothing;

-- Which photos a client may see for a project (internal helper; nobody can call it directly).
create or replace function public.client_visible_photos(p_project uuid)
returns table (photo_id uuid, storage_path text, task_id uuid, room_id uuid, taken timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.storage_path, p.task_id, p.room_id, coalesce(p.taken_at, p.created_at)
    from public.photos p
    left join public.client_photo_choices c on c.project_id = p.project_id and c.photo_id = p.id
    left join public.tasks t on t.id = p.task_id and t.project_id = p.project_id
   where p.project_id = p_project
     and coalesce(c.share, t.status = 'done', false)
$$;
revoke all on function public.client_visible_photos(uuid) from public, anon, authenticated;

create or replace function public.client_view(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.client_links;
begin
  if p_token is null or length(p_token) < 30 or length(p_token) > 200 then
    return null;
  end if;
  select * into l from public.client_links
   where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
     and revoked_at is null
     and (expires_at is null or expires_at > now());
  if not found then
    return null;
  end if;
  update public.client_links set last_viewed_at = now() where id = l.id;
  return jsonb_build_object(
    'project', (select jsonb_build_object('name', p.name, 'status', p.status, 'start_date', p.start_date, 'end_date', p.end_date)
                  from public.projects p where p.id = l.project_id),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id,
               'name', t.name,
               'room', r.name,
               'level', r.level,
               -- internal "blocked" is shown to the client as not started yet
               'status', case when t.status = 'blocked' then 'todo' else t.status end,
               'percent', t.percent_complete,
               'planned_start', t.planned_start,
               'planned_end', t.planned_end,
               'actual_start', t.actual_start,
               'actual_end', t.actual_end)
             order by t.planned_start nulls last, t.sort_order, t.created_at)
        from public.tasks t left join public.project_rooms r on r.id = t.room_id
       where t.project_id = l.project_id), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.photo_id,
               'task_id', v.task_id,
               'room', r.name,
               'taken', v.taken)
             order by v.taken desc)
        from public.client_visible_photos(l.project_id) v
        left join public.project_rooms r on r.id = v.room_id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.client_view(text) from public;
grant execute on function public.client_view(text) to anon, authenticated;

-- Used only by the Edge Function (service role): the storage paths behind a valid link.
create or replace function public.client_photo_paths(p_token text)
returns table (photo_id uuid, storage_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.client_links;
begin
  if p_token is null or length(p_token) < 30 or length(p_token) > 200 then
    return;
  end if;
  select * into l from public.client_links
   where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
     and revoked_at is null
     and (expires_at is null or expires_at > now());
  if not found then
    return;
  end if;
  return query select v.photo_id, v.storage_path from public.client_visible_photos(l.project_id) v;
end;
$$;
revoke all on function public.client_photo_paths(text) from public, anon, authenticated;
grant execute on function public.client_photo_paths(text) to service_role;
