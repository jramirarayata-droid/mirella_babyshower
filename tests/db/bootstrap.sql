-- A small stand-in for a Supabase database, for testing migrations locally.
create role postgres login createrole bypassrls nosuperuser;
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role, authenticator to postgres with admin option;
create database sb owner postgres;
\c sb
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
grant usage on schema auth to postgres, anon, authenticated, service_role;
grant select, references on auth.users to postgres;
grant execute on function auth.uid() to public;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint,
  allowed_mime_types text[], owner uuid, created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;
grant usage on schema storage to postgres, anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

create schema realtime;
create table realtime.sent (topic text, event text, payload jsonb, at timestamptz default now());
create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
  language sql security definer as $$ insert into realtime.sent (topic, event, payload) values (topic, event, payload) $$;
grant usage on schema realtime to postgres, anon, authenticated, service_role;
grant execute on function realtime.send(jsonb, text, text, boolean) to anon, authenticated;
grant select on realtime.sent to postgres;

-- Supabase's default grants on public.
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
