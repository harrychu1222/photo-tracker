-- ============================================================
-- Site Log — Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- ============================================================

-- ---------- Tables ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invite_codes (
  code text primary key,
  label text,                          -- e.g. "Crew invite, Sept 2026" — for your own reference
  max_uses int not null default 1,
  uses int not null default 0,
  expires_at timestamptz,              -- null = never expires
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,          -- path inside the 'photos' storage bucket
  location text not null default '',
  room text not null default '',
  category text not null default '',
  status text not null default 'todo', -- 'todo' | 'progress' | 'done' | 'blocked'
  quoting_status text,                 -- null | 'pending_quotation' | 'quoted' | 'rejected'
  tags text[] not null default '{}',   -- free-form extra tags
  notes text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create index if not exists photos_created_at_idx on public.photos (created_at desc);
create index if not exists photos_tags_idx on public.photos using gin (tags);

-- ---------- Invite-code gated signup ----------
-- The client calls supabase.auth.signUp({ email, password, options: { data: { invite_code } } }).
-- This trigger validates the code BEFORE the auth user is created, so an invalid
-- or exhausted code blocks signup entirely (no client-side bypass is possible).

create or replace function public.validate_invite_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_row public.invite_codes%rowtype;
begin
  v_code := new.raw_user_meta_data ->> 'invite_code';

  if v_code is null or v_code = '' then
    raise exception 'An invite code is required to sign up.';
  end if;

  select * into v_row from public.invite_codes where code = v_code for update;

  if not found then
    raise exception 'Invite code not recognized.';
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    raise exception 'This invite code has expired.';
  end if;

  if v_row.uses >= v_row.max_uses then
    raise exception 'This invite code has already been used.';
  end if;

  update public.invite_codes set uses = uses + 1 where code = v_code;

  return new;
end;
$$;

drop trigger if exists on_auth_user_validate_invite on auth.users;
create trigger on_auth_user_validate_invite
  before insert on auth.users
  for each row execute function public.validate_invite_code();

-- Creates the profile row once the (now invite-validated) user exists.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.photos enable row level security;

-- Any signed-in (permitted) user can see who else's on the team.
drop policy if exists "profiles are readable by authenticated users" on public.profiles;
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- invite_codes has no policies for normal users on purpose: nobody can read,
-- create, or edit codes from the client. Manage codes from the Supabase
-- Table Editor (as yourself, using the dashboard's service role) — see README.

-- Shared team gallery: every permitted user can see every photo,
-- but can only add/change/remove their own.
drop policy if exists "photos are readable by authenticated users" on public.photos;
create policy "photos are readable by authenticated users"
  on public.photos for select
  to authenticated
  using (true);

drop policy if exists "users can insert their own photos" on public.photos;
create policy "users can insert their own photos"
  on public.photos for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can update their own photos" on public.photos;
create policy "users can update their own photos"
  on public.photos for update
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can delete their own photos" on public.photos;
create policy "users can delete their own photos"
  on public.photos for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------- Storage ----------
-- Create the bucket first (Dashboard > Storage > New bucket > name it "photos",
-- keep it PRIVATE/not public), then run the policies below.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "authenticated users can view site photos" on storage.objects;
create policy "authenticated users can view site photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'photos');

-- Uploads must live under a folder named for the uploader's own user id,
-- e.g. "3fa1.../my-photo.jpg" — the app's upload code does this automatically.
drop policy if exists "users can upload into their own folder" on storage.objects;
create policy "users can upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can delete their own uploads" on storage.objects;
create policy "users can delete their own uploads"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
