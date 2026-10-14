import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, expect, test } from 'vitest';
import type { OutfitRow } from '../src/rows.ts';
import { asUser, createAuthUser, createDb, resetDb, U1 } from './db.ts';

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
}, 60_000);

beforeEach(() => resetDb(db));

const insertItem = (warmth = 2) =>
  db.query(
    `insert into items (id, user_id, category, color_hex, color_family, warmth, formality, image_path, original_path)
     values ('10000000-0000-0000-0000-000000000001', $1, 'top', '#000000', 'black', $2, 'casual', 'a.webp', 'a.jpg')`,
    [U1, warmth],
  );

const insertOutfit = (id: string) =>
  db.query(
    `insert into outfits (id, user_id, date, item_ids, weather, seed)
     values ($1, $2, '2026-10-12', '{}', '{"feelsLikeC":20,"rain":false,"condition":"clearsky"}', 1)`,
    [id, U1],
  );

test('creating an auth user creates a profile with defaults', async () => {
  await createAuthUser(db, U1);
  const { rows } = await db.query('select locale, push_time::text, timezone from profiles where id = $1', [U1]);
  expect(rows).toEqual([{ locale: 'en', push_time: '07:30:00', timezone: 'UTC' }]);
});

test('one outfit per user per day', async () => {
  await createAuthUser(db, U1);
  await insertOutfit('20000000-0000-0000-0000-000000000001');
  await expect(insertOutfit('20000000-0000-0000-0000-000000000002')).rejects.toMatchObject({ code: '23505' });
});

test('updated_at changes on update', async () => {
  await createAuthUser(db, U1);
  await insertItem();
  const before = await db.query<{ updated_at: Date }>('select updated_at from items');
  await new Promise((r) => setTimeout(r, 20));
  await db.query('update items set warmth = 3');
  const after = await db.query<{ updated_at: Date }>('select updated_at from items');
  expect(after.rows[0]!.updated_at.getTime()).toBeGreaterThan(before.rows[0]!.updated_at.getTime());
});

test('outfits.updated_at advances on update', async () => {
  await createAuthUser(db, U1);
  await insertOutfit('20000000-0000-0000-0000-000000000001');
  const before = await db.query<{ updated_at: Date }>('select updated_at from outfits');
  await new Promise((r) => setTimeout(r, 20));
  await db.query("update outfits set status = 'worn'");
  const after = await db.query<{ updated_at: Date }>('select updated_at from outfits');
  expect(after.rows[0]!.updated_at.getTime()).toBeGreaterThan(before.rows[0]!.updated_at.getTime());
});

test('deleting the auth user cascades', async () => {
  await createAuthUser(db, U1);
  await insertItem();
  await insertOutfit('20000000-0000-0000-0000-000000000001');
  await db.query('delete from auth.users where id = $1', [U1]);
  for (const table of ['profiles', 'items', 'outfits']) {
    const { rows } = await db.query(`select 1 from ${table}`);
    expect(rows).toEqual([]);
  }
});

test('warmth outside 1..3 is rejected', async () => {
  await createAuthUser(db, U1);
  await expect(insertItem(4)).rejects.toMatchObject({ code: '23514' });
  await expect(insertItem(0)).rejects.toMatchObject({ code: '23514' });
});

test('outfits.pushed_at exists and is nullable', async () => {
  const { rows } = await db.query(
    `select is_nullable, data_type from information_schema.columns where table_name = 'outfits' and column_name = 'pushed_at'`,
  );
  expect(rows).toEqual([{ is_nullable: 'YES', data_type: 'timestamp with time zone' }]);
});

test('items.unavailable_until is a nullable date that the owner can set', async () => {
  const { rows } = await db.query(
    `select is_nullable, data_type from information_schema.columns where table_name = 'items' and column_name = 'unavailable_until'`,
  );
  expect(rows).toEqual([{ is_nullable: 'YES', data_type: 'date' }]);
  await createAuthUser(db, U1);
  await insertItem();
  const read = () => db.query<{ u: string | null }>(`select unavailable_until::text as u from items where user_id = $1`, [U1]);
  expect((await read()).rows).toEqual([{ u: null }]);
  await asUser(db, U1, () => db.query(`update items set unavailable_until = '2026-10-15' where user_id = $1`, [U1]));
  expect((await read()).rows).toEqual([{ u: '2026-10-15' }]);
});

const insertRow = (row: OutfitRow) =>
  db.query<{ id: string }>(
    `insert into outfits (user_id, date, item_ids, weather, seed, status, pushed_at)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [row.user_id, row.date, row.item_ids, JSON.stringify(row.weather), row.seed, row.status, row.pushed_at ?? null],
  );

const outfitRow = (date: string, pushed_at: string | null): OutfitRow => ({
  user_id: U1,
  date,
  item_ids: ['10000000-0000-0000-0000-000000000001'],
  weather: { feelsLikeC: 12, rain: true, condition: 'rain' },
  seed: 42,
  status: 'suggested',
  pushed_at,
});

test('an outfit row without id gets a generated uuid', async () => {
  await createAuthUser(db, U1);
  const { rows } = await insertRow(outfitRow('2026-10-12', '2026-10-12T05:30:00Z'));
  expect(rows[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
});

test('the owner can insert an outfit row without id', async () => {
  await createAuthUser(db, U1);
  const { rows } = await asUser(db, U1, () => insertRow(outfitRow('2026-10-13', null)));
  expect(rows[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
  const stored = await db.query<{ weather: unknown }>('select weather from outfits');
  expect(stored.rows[0]!.weather).toEqual({ feelsLikeC: 12, rain: true, condition: 'rain' });
});

test('set_updated_at pins an empty search_path', async () => {
  const { rows } = await db.query<{ proconfig: string[] | null }>(
    "select proconfig from pg_proc where proname = 'set_updated_at'",
  );
  expect(rows[0]!.proconfig).toEqual(['search_path=""']);
});
