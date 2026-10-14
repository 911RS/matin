import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const U1 = '00000000-0000-0000-0000-000000000001';
export const U2 = '00000000-0000-0000-0000-000000000002';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../supabase/migrations');

const BOOTSTRAP = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (
  id uuid default gen_random_uuid() primary key,
  bucket_id text,
  name text,
  owner uuid
);
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:cardinality(string_to_array(name, '/')) - 1] $$;

grant usage on schema public, storage, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant all on all tables in schema storage to anon, authenticated;
alter table storage.objects enable row level security;
`;

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('_cron.sql'))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

export async function resetDb(db: PGlite): Promise<void> {
  await db.exec('truncate auth.users, storage.objects cascade');
}

export async function asUser<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query('begin');
  try {
    await db.query(`set local role ${userId === null ? 'anon' : 'authenticated'}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? '']);
    const result = await fn();
    await db.query('commit');
    return result;
  } catch (err) {
    await db.query('rollback');
    throw err;
  } finally {
    await db.query('reset role');
  }
}

export async function createAuthUser(db: PGlite, id: string): Promise<void> {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@example.test`]);
}
