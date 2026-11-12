-- F5: client progress link. The client sees the schedule and chosen photos only: no money,
-- no notes, no hours, no names of workers. Access is a secret link that can be switched off.
--
-- How it stays private:
--  * The link holds a random 256-bit secret. Only its SHA-256 hash is stored here, so
--    reading this table never reveals a working link.
--  * The public page calls client_view(token). It returns a fixed, small set of fields,
--    or null for a wrong, expired or switched-off link (no hint which).
--  * client_links and client_shared_photos are manager-only (RLS). The public (anon) role
--    has no access to any table, only to execute client_view.
--  * Shared photos are copied into a separate public bucket under random file names, so the
--    private "photos" bucket stays private. Stopping sharing deletes the copies.

create table if not exists public.client_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists client_links_project_idx on public.client_links (project_id);
alter table public.client_links enable row level security;
drop policy if exists "client links admin" on public.client_links;
create policy "client links admin" on public.client_links for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.client_shared_photos (
  project_id uuid not null references public.projects(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  public_path text not null unique,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (project_id, photo_id)
);
alter table public.client_shared_photos enable row level security;
drop policy if exists "client photos admin" on public.client_shared_photos;
create policy "client photos admin" on public.client_shared_photos for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public bucket for the shared copies (reading a known file name needs no login; listing is not allowed).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-photos', 'client-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
drop policy if exists "managers add client photos" on storage.objects;
create policy "managers add client photos" on storage.objects for insert to authenticated with check (bucket_id = 'client-photos' and public.is_admin());
drop policy if exists "managers remove client photos" on storage.objects;
create policy "managers remove client photos" on storage.objects for delete to authenticated using (bucket_id = 'client-photos' and public.is_admin());

-- The one door for the public page.
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
               'path', s.public_path,
               'room', r.name,
               'taken', coalesce(p.taken_at, p.created_at))
             order by coalesce(p.taken_at, p.created_at) desc)
        from public.client_shared_photos s
        join public.photos p on p.id = s.photo_id
        left join public.project_rooms r on r.id = p.room_id
       where s.project_id = l.project_id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.client_view(text) from public;
grant execute on function public.client_view(text) to anon, authenticated;
