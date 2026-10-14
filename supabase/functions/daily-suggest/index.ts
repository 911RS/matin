import { createClient } from 'npm:@supabase/supabase-js@2';
import { runDailySuggest, type DailyDeps } from '../_vendor/backend/src/daily.ts';
import type { ItemRow, OutfitRow, ProfileRow } from '../_vendor/backend/src/rows.ts';

function must<T>(result: { data: T | null; error: { message: string } | null }): T | null {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

const PAGE_SIZE = 1000;

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function secretMatches(provided: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(provided), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || !(await secretMatches(req.headers.get('Authorization') ?? '', `Bearer ${secret}`))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const deps: DailyDeps = {
    now: new Date(),
    fetchFn: fetch,
    log(event, detail) {
      console.error(JSON.stringify({ event, ...detail }));
    },
    async listProfiles() {
      const rows: ProfileRow[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const page = (must(
          await db
            .from('profiles')
            .select('*')
            .not('expo_push_token', 'is', null)
            .order('id')
            .range(from, from + PAGE_SIZE - 1),
        ) ?? []) as ProfileRow[];
        rows.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      return rows;
    },
    async listItems(userId) {
      return must(await db.from('items').select('*').eq('user_id', userId).is('archived_at', null)) as ItemRow[] ?? [];
    },
    async listRecentOutfits(userId, sinceDate) {
      return must(await db.from('outfits').select('*').eq('user_id', userId).gte('date', sinceDate)) as OutfitRow[] ?? [];
    },
    async getOutfit(userId, date) {
      return must(
        await db.from('outfits').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
      ) as OutfitRow | null;
    },
    async insertOutfit(row) {
      const { error } = await db.from('outfits').insert(row);
      if (!error) return 'inserted';
      if (error.code === '23505') return 'conflict';
      throw new Error(error.message);
    },
    async markPushed(userId, date, at) {
      const { error } = await db.from('outfits').update({ pushed_at: at }).eq('user_id', userId).eq('date', date);
      if (error) throw new Error(error.message);
    },
    async clearPushToken(token) {
      const { error } = await db.from('profiles').update({ expo_push_token: null }).eq('expo_push_token', token);
      if (error) throw new Error(error.message);
    },
  };

  try {
    const summary = await runDailySuggest(deps);
    return Response.json(summary);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Internal error' }, { status: 500 });
  }
});
