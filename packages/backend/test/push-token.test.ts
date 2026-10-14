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

const TOKEN = 'ExponentPushToken[abc123]';

const tokens = async () =>
  (await db.query<{ id: string; expo_push_token: string | null }>('select id, expo_push_token from profiles order by id'))
    .rows;

test('expo_push_token accepts Expo tokens and null', async () => {
  await db.query('update profiles set expo_push_token = $1 where id = $2', [TOKEN, U1]);
  await db.query('update profiles set expo_push_token = $1 where id = $2', ['ExpoPushToken[xyz]', U2]);
  await db.query('update profiles set expo_push_token = null where id = $1', [U2]);
  expect(await tokens()).toEqual([
    { id: U1, expo_push_token: TOKEN },
    { id: U2, expo_push_token: null },
  ]);
});

test('expo_push_token rejects malformed tokens', async () => {
  for (const bad of ['', 'abc', 'ExponentPushToken[]', 'ExponentPushToken[a]x', 'fcm:ExponentPushToken[a]']) {
    await expect(
      db.query('update profiles set expo_push_token = $1 where id = $2', [bad, U1]),
    ).rejects.toMatchObject({ code: '23514' });
  }
});

test('a token cannot be held by two profiles', async () => {
  await db.query('update profiles set expo_push_token = $1 where id = $2', [TOKEN, U1]);
  await expect(
    db.query('update profiles set expo_push_token = $1 where id = $2', [TOKEN, U2]),
  ).rejects.toMatchObject({ code: '23505' });
});

test('claim_push_token moves the token to the caller', async () => {
  await asUser(db, U1, () => db.query('select public.claim_push_token($1)', [TOKEN]));
  expect(await tokens()).toEqual([
    { id: U1, expo_push_token: TOKEN },
    { id: U2, expo_push_token: null },
  ]);
  await asUser(db, U2, () => db.query('select public.claim_push_token($1)', [TOKEN]));
  expect(await tokens()).toEqual([
    { id: U1, expo_push_token: null },
    { id: U2, expo_push_token: TOKEN },
  ]);
});

test('anon cannot execute claim_push_token', async () => {
  await expect(
    asUser(db, null, () => db.query('select public.claim_push_token($1)', [TOKEN])),
  ).rejects.toMatchObject({ code: '42501' });
  expect((await tokens()).every((r) => r.expo_push_token === null)).toBe(true);
});
