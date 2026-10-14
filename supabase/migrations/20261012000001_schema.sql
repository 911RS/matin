create type item_category as enum ('top', 'bottom', 'dress', 'outerwear', 'shoes');
create type color_family as enum (
  'black', 'white', 'grey', 'navy', 'blue', 'beige', 'brown',
  'green', 'red', 'pink', 'yellow', 'purple', 'denim', 'multi'
);
create type formality as enum ('casual', 'smart', 'formal');
create type outfit_status as enum ('suggested', 'worn', 'skipped');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'en' check (locale in ('en', 'fr')),
  push_time time not null default '07:30',
  timezone text not null default 'UTC',
  lat double precision,
  lon double precision,
  expo_push_token text check (expo_push_token is null or expo_push_token ~ '^Expo(nent)?PushToken\[[^\]]+\]$'),
  created_at timestamptz not null default now()
);

create table items (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category item_category not null,
  color_hex text not null,
  color_family color_family not null,
  warmth smallint not null check (warmth between 1 and 3),
  formality formality not null,
  image_path text not null,
  original_path text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_user_active_idx on items (user_id) where archived_at is null;

create table outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  item_ids uuid[] not null,
  weather jsonb not null,
  seed integer not null,
  status outfit_status not null default 'suggested',
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create function set_updated_at() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger items_set_updated_at before update on items
  for each row execute function set_updated_at();
create trigger outfits_set_updated_at before update on outfits
  for each row execute function set_updated_at();

create function handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
