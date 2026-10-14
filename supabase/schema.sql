-- Run once in the Supabase SQL Editor. Safe to run again.

create table if not exists public.app_data (
  key text primary key,
  data jsonb not null,
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);

-- RLS on with no policies: only the server's secret key (which bypasses RLS) can read or write.
alter table public.app_data enable row level security;
revoke all on public.app_data from anon, authenticated;

-- Saves the catalog only if nobody else saved since `expected`. Returns the new catalog, or null on conflict.
create or replace function public.save_catalog(expected integer, payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_revision integer := expected + 1;
  result jsonb := jsonb_set(payload, '{revision}', to_jsonb(next_revision));
begin
  update public.app_data
     set data = result, revision = next_revision, updated_at = now()
   where key = 'catalog' and revision = expected;
  if found then return result; end if;

  insert into public.app_data (key, data, revision)
  values ('catalog', result, next_revision)
  on conflict (key) do nothing;
  if found then return result; end if;

  return null;
end;
$$;

-- Adds one consultation for a tonic and returns the whole usage map.
create or replace function public.increment_usage(tonic_id text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  insert into public.app_data as existing (key, data)
  values ('usage', jsonb_build_object(tonic_id, 1))
  on conflict (key) do update
    set data = jsonb_set(existing.data, array[tonic_id], to_jsonb(coalesce((existing.data ->> tonic_id)::integer, 0) + 1)),
        updated_at = now()
  returning data;
$$;

revoke execute on function public.save_catalog(integer, jsonb) from public, anon, authenticated;
revoke execute on function public.increment_usage(text) from public, anon, authenticated;
grant execute on function public.save_catalog(integer, jsonb) to service_role;
grant execute on function public.increment_usage(text) to service_role;

-- Private bucket for catalog photos; the app serves them through /api/images/<name>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
