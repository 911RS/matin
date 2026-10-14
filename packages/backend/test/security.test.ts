import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, expect, test } from 'vitest';
import { asUser, createAuthUser, createDb, resetDb, U1, U2 } from './db.ts';

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
}, 60_000);

beforeEach(async () => {
  await resetDb(db);
  await createAuthUser(db, U1);
  await createAuthUser(db, U2);
});

const ITEM1 = '10000000-0000-0000-0000-000000000001';
const ITEM2 = '10000000-0000-0000-0000-000000000002';
const OUTFIT2 = '20000000-0000-0000-0000-000000000002';

const insertItem = (id: string, userId: string) =>
  db.query(
    `insert into items (id, user_id, category, color_hex, color_family, warmth, formality, image_path, original_path)
     values ($1, $2, 'top', '#000000', 'black', 2, 'casual', 'a.webp', 'a.jpg')`,
    [id, userId],
  );

const insertOutfit = (id: string, userId: string) =>
  db.query(
    `insert into outfits (id, user_id, date, item_ids, weather, seed)
     values ($1, $2, '2026-10-12', '{}', '{"feelsLikeC":20,"rain":false}', 1)`,
    [id, userId],
  );

const insertObject = (name: string) =>
  db.query("insert into storage.objects (bucket_id, name) values ('items', $1)", [name]);

test('user sees only own items', async () => {
  await asUser(db, U1, () => insertItem(ITEM1, U1));
  await asUser(db, U2, () => insertItem(ITEM2, U2));
  const { rows } = await asUser(db, U1, () => db.query('select id, user_id from items'));
  expect(rows).toEqual([{ id: ITEM1, user_id: U1 }]);
});

test('user cannot insert item for someone else', async () => {
  await expect(asUser(db, U1, () => insertItem(ITEM2, U2))).rejects.toMatchObject({ code: '42501' });
});

test('user cannot update or delete others rows', async () => {
  await insertOutfit(OUTFIT2, U2);
  const updated = await asUser(db, U1, () => db.query("update outfits set status = 'worn' where id = $1", [OUTFIT2]));
  expect(updated.affectedRows).toBe(0);
  const deleted = await asUser(db, U1, () => db.query('delete from outfits where id = $1', [OUTFIT2]));
  expect(deleted.affectedRows).toBe(0);
  const { rows } = await db.query('select status from outfits where id = $1', [OUTFIT2]);
  expect(rows).toEqual([{ status: 'suggested' }]);
});

test('user can update and delete own rows', async () => {
  await asUser(db, U1, () => insertOutfit('20000000-0000-0000-0000-000000000001', U1));
  const updated = await asUser(db, U1, () =>
    db.query("update outfits set status = 'worn' where user_id = $1", [U1]),
  );
  expect(updated.affectedRows).toBe(1);
  const deleted = await asUser(db, U1, () => db.query('delete from outfits where user_id = $1', [U1]));
  expect(deleted.affectedRows).toBe(1);
});

test('anon has no privileges on public tables and sees no storage objects', async () => {
  await insertItem(ITEM1, U1);
  await insertOutfit(OUTFIT2, U2);
  await insertObject(`${U1}/a.webp`);
  for (const table of ['items', 'profiles', 'outfits']) {
    await expect(asUser(db, null, () => db.query(`select * from ${table}`))).rejects.toMatchObject({ code: '42501' });
  }
  await expect(asUser(db, null, () => insertItem(ITEM2, U2))).rejects.toMatchObject({ code: '42501' });
  await expect(asUser(db, null, () => insertOutfit(OUTFIT2, U2))).rejects.toMatchObject({ code: '42501' });
  const { rows } = await asUser(db, null, () => db.query('select * from storage.objects'));
  expect(rows).toEqual([]);
});

test('user cannot reassign own item to someone else', async () => {
  await asUser(db, U1, () => insertItem(ITEM1, U1));
  await expect(
    asUser(db, U1, () => db.query('update items set user_id = $1 where id = $2', [U2, ITEM1])),
  ).rejects.toMatchObject({ code: '42501' });
});

test('profile: read and update own only', async () => {
  const other = await asUser(db, U1, () => db.query("update profiles set locale = 'fr' where id = $1", [U2]));
  expect(other.affectedRows).toBe(0);
  const own = await asUser(db, U1, () => db.query("update profiles set locale = 'fr' where id = $1", [U1]));
  expect(own.affectedRows).toBe(1);
  const { rows } = await asUser(db, U1, () => db.query('select id, locale from profiles'));
  expect(rows).toEqual([{ id: U1, locale: 'fr' }]);
});

test('profile: no insert or delete for users', async () => {
  await expect(
    asUser(db, U1, () => db.query('delete from profiles where id = $1', [U1])),
  ).rejects.toMatchObject({ code: '42501' });
  await expect(
    asUser(db, U1, () => db.query('insert into profiles (id) values ($1)', [U2])),
  ).rejects.toMatchObject({ code: '42501' });
});

test('storage: own folder only', async () => {
  await asUser(db, U1, () => insertObject(`${U1}/a.webp`));
  await expect(asUser(db, U1, () => insertObject(`${U2}/a.webp`))).rejects.toMatchObject({ code: '42501' });
  await asUser(db, U2, () => insertObject(`${U2}/a.webp`));
  const { rows } = await asUser(db, U2, () => db.query('select name from storage.objects'));
  expect(rows).toEqual([{ name: `${U2}/a.webp` }]);
});

test('storage: items bucket exists and is private', async () => {
  const { rows } = await db.query('select id, public from storage.buckets');
  expect(rows).toEqual([{ id: 'items', public: false }]);
});

test('storage: cannot move own object into another folder', async () => {
  await asUser(db, U1, () => insertObject(`${U1}/a.webp`));
  await expect(
    asUser(db, U1, () => db.query('update storage.objects set name = $1', [`${U2}/a.webp`])),
  ).rejects.toMatchObject({ code: '42501' });
});

test('storage: cannot update or delete others objects', async () => {
  await insertObject(`${U2}/a.webp`);
  const updated = await asUser(db, U1, () =>
    db.query('update storage.objects set name = $1 where name = $2', [`${U1}/b.webp`, `${U2}/a.webp`]),
  );
  expect(updated.affectedRows).toBe(0);
  const deleted = await asUser(db, U1, () => db.query('delete from storage.objects'));
  expect(deleted.affectedRows).toBe(0);
  const { rows } = await db.query('select name from storage.objects');
  expect(rows).toEqual([{ name: `${U2}/a.webp` }]);
});
