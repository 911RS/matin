import { FALLBACK_WEATHER, seedFromString, suggest, swapPiece } from '@tenue/engine';
import type { Category, Formality, Item, SuggestInput, Weather, WornOutfit } from '@tenue/engine';
import { daysBefore, localDate, toEngineItem, toWornOutfits } from '@tenue/backend';
import type { ItemRow, OutfitRow, ProfileRow } from '@tenue/backend';
import type { OutfitPatch, Repo } from '../data/repo';
import type { TodayState } from './types';
import { loadWeather as fetchDayWeather } from './weather';

export type FlowReads = Pick<Repo, 'getProfile' | 'listItems' | 'listOutfits'>;

export interface FlowDeps {
  repo: Repo;
  now: () => Date;
  fetchFn: typeof fetch;
  reads?: FlowReads;
  refreshed?: Set<string>;
  onRefresh?: (result: FlowResult) => void;
}

export type OutfitState = Extract<TodayState, { kind: 'outfit' }>;

export const HISTORY_DAYS = 7;

export function loadWeather(deps: FlowDeps, profile: ProfileRow, date: string): Promise<Weather> {
  return fetchDayWeather(deps.fetchFn, profile, date);
}

interface Context {
  profile: ProfileRow;
  date: string;
  rows: ItemRow[];
  items: Item[];
  recentOutfits: WornOutfit[];
}

function contextOf(profile: ProfileRow, date: string, rows: ItemRow[], recent: OutfitRow[]): Context {
  return { profile, date, rows, items: rows.map(toEngineItem), recentOutfits: toWornOutfits(recent) };
}

async function context(deps: FlowDeps, date?: string): Promise<Context> {
  const reads = deps.reads ?? deps.repo;
  const profile = await reads.getProfile();
  const day = date ?? localDate(deps.now(), profile.timezone);
  const rows = await reads.listItems();
  const recent = await reads.listOutfits(daysBefore(day, HISTORY_DAYS), day);
  return contextOf(profile, day, rows, recent);
}

function inputFor(ctx: Context, weather: Weather, seed: number, occasion?: Formality | null): SuggestInput {
  return {
    items: ctx.items,
    recentOutfits: ctx.recentOutfits,
    weather,
    date: ctx.date,
    seed,
    locale: ctx.profile.locale,
    ...(occasion ? { occasion } : {}),
  };
}

function stateFor(ctx: Context, row: OutfitRow): TodayState | null {
  const byId = new Map(ctx.rows.map((r) => [r.id, r]));
  const items = row.item_ids.flatMap((id) => byId.get(id) ?? []);
  if (items.length === 0) return null;
  return { kind: 'outfit', date: ctx.date, row, items };
}

async function fresh(deps: FlowDeps, ctx: Context, row: OutfitRow): Promise<TodayState> {
  const result = suggest(inputFor(ctx, row.weather ?? FALLBACK_WEATHER, row.seed));
  if (!('itemIds' in result)) return { kind: 'missing', date: ctx.date, missing: result.missing };
  return stateFor(ctx, { ...row, item_ids: result.itemIds }) ?? { kind: 'missing', date: ctx.date, missing: [] };
}

function firstSuggestion(ctx: Context, weather: Weather): { kind: 'row'; row: OutfitRow } | Extract<TodayState, { kind: 'missing' }> {
  const seed = seedFromString(`${ctx.profile.id}|${ctx.date}`);
  const result = suggest(inputFor(ctx, weather, seed));
  if (!('itemIds' in result)) return { kind: 'missing', date: ctx.date, missing: result.missing };
  return {
    kind: 'row',
    row: { user_id: ctx.profile.id, date: ctx.date, item_ids: result.itemIds, weather, seed, status: 'suggested' },
  };
}

export interface CachedReads {
  profile: ProfileRow;
  items: ItemRow[];
  recent: OutfitRow[];
}

export function offlineToday(cache: CachedReads, date: string): { state: TodayState; insert: OutfitRow | null } {
  const from = daysBefore(date, HISTORY_DAYS);
  const recent = cache.recent.filter((o) => o.date >= from && o.date <= date);
  const ctx = contextOf(cache.profile, date, cache.items, recent);
  const first = firstSuggestion(ctx, FALLBACK_WEATHER);
  if (first.kind === 'missing') return { state: first, insert: null };
  const state = stateFor(ctx, first.row);
  return state ? { state, insert: first.row } : { state: { kind: 'missing', date, missing: [] }, insert: null };
}

export function offlineTomorrow(cache: CachedReads, today: string, todayRow: OutfitRow | null = null): TodayState {
  const tomorrow = tomorrowOf(today);
  const from = daysBefore(tomorrow, HISTORY_DAYS);
  const recent = cache.recent.filter((o) => o.date >= from && o.date <= tomorrow && o.date !== todayRow?.date);
  const ctx = contextOf(cache.profile, tomorrow, cache.items, todayRow ? [...recent, todayRow] : recent);
  const first = firstSuggestion(ctx, FALLBACK_WEATHER);
  if (first.kind === 'missing') return first;
  return stateFor(ctx, first.row) ?? { kind: 'missing', date: tomorrow, missing: [] };
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

async function refreshed(deps: FlowDeps, ctx: Context, row: OutfitRow): Promise<TodayState | null> {
  const { profile } = ctx;
  const baseSeed = seedFromString(`${profile.id}|${ctx.date}`);
  if (row.status !== 'suggested' || !row.weather.assumed || row.seed !== baseSeed) return null;
  if (profile.lat === null || profile.lon === null || !deps.onRefresh) return null;
  const original = suggest(inputFor(ctx, row.weather, baseSeed));
  if (!('itemIds' in original) || !sameSet(original.itemIds, row.item_ids)) return null;
  const seen = deps.refreshed ?? (deps.refreshed = new Set());
  if (seen.has(ctx.date)) return null;
  seen.add(ctx.date);
  const weather = await loadWeather(deps, profile, ctx.date);
  if (weather.assumed) return null;
  const next = suggest(inputFor(ctx, weather, row.seed));
  if (!('itemIds' in next)) return null;
  const updated = { ...row, weather, item_ids: next.itemIds };
  const state = stateFor(ctx, updated);
  if (!state) return null;
  deps.onRefresh({ state, patch: { weather, item_ids: next.itemIds } });
  return state;
}

export async function ensureToday(deps: FlowDeps, date?: string): Promise<TodayState> {
  const ctx = await context(deps, date);
  const existing = await deps.repo.getOutfit(ctx.date);
  if (existing) return (await refreshed(deps, ctx, existing)) ?? stateFor(ctx, existing) ?? fresh(deps, ctx, existing);

  const weather = await loadWeather(deps, ctx.profile, ctx.date);
  const first = firstSuggestion(ctx, weather);
  if (first.kind === 'missing') return first;

  const { row } = first;
  if ((await deps.repo.insertOutfit(row)) === 'inserted') {
    return stateFor(ctx, row) ?? { kind: 'missing', date: ctx.date, missing: [] };
  }
  const stored = await deps.repo.getOutfit(ctx.date);
  if (!stored) return { kind: 'missing', date: ctx.date, missing: [] };
  return stateFor(ctx, stored) ?? fresh(deps, ctx, stored);
}

export interface FlowResult {
  state: TodayState;
  patch: OutfitPatch | null;
}

function result(ctx: Context, row: OutfitRow, patch: OutfitPatch): FlowResult {
  const state = stateFor(ctx, row);
  return state ? { state, patch } : { state: { kind: 'missing', date: ctx.date, missing: [] }, patch: null };
}

export async function shuffle(
  deps: FlowDeps,
  state: OutfitState,
  shown: string[][] = [],
  occasion: Formality | null = null,
): Promise<FlowResult> {
  const ctx = await context(deps, state.date);
  const seed = state.row.seed + 1;
  const yesterday = daysBefore(state.date, 1);
  const seen: WornOutfit[] = [...shown, state.row.item_ids].map((itemIds) => ({ date: yesterday, itemIds }));
  const next = suggest(
    inputFor({ ...ctx, recentOutfits: [...ctx.recentOutfits, ...seen] }, state.row.weather, seed, occasion),
  );
  if (!('itemIds' in next)) return { state: { kind: 'missing', date: state.date, missing: next.missing }, patch: null };
  return result(ctx, { ...state.row, seed, item_ids: next.itemIds }, { seed, item_ids: next.itemIds });
}

export async function swap(
  deps: FlowDeps,
  state: OutfitState,
  slot: Category,
  occasion: Formality | null = null,
): Promise<FlowResult> {
  const ctx = await context(deps, state.date);
  const next = swapPiece(inputFor(ctx, state.row.weather, state.row.seed, occasion), state.row.item_ids, slot);
  return result(ctx, { ...state.row, item_ids: next.itemIds }, { item_ids: next.itemIds });
}

export async function pickOccasion(deps: FlowDeps, state: OutfitState, occasion: Formality | null): Promise<FlowResult> {
  const ctx = await context(deps, state.date);
  const { seed } = state.row;
  const next = suggest(inputFor(ctx, state.row.weather, seed, occasion));
  if (!('itemIds' in next)) return { state: { kind: 'missing', date: state.date, missing: next.missing }, patch: null };
  return result(ctx, { ...state.row, item_ids: next.itemIds }, { seed, item_ids: next.itemIds });
}

export function markWorn(state: OutfitState): FlowResult {
  const { item_ids, seed } = state.row;
  return { state: { ...state, row: { ...state.row, status: 'worn' } }, patch: { status: 'worn', item_ids, seed } };
}

export function tomorrowOf(date: string): string {
  return daysBefore(date, -1);
}

export type WeatherFor = (profile: ProfileRow, date: string) => Promise<Weather>;

export async function previewTomorrow(
  deps: FlowDeps,
  today: string,
  options: { weatherFor?: WeatherFor; todayRow?: OutfitRow | null } = {},
): Promise<TodayState> {
  const tomorrow = tomorrowOf(today);
  const ctx = await context(deps, tomorrow);
  const overlay = options.todayRow;
  const history = overlay ? [...ctx.recentOutfits.filter((w) => w.date !== overlay.date), ...toWornOutfits([overlay])] : ctx.recentOutfits;
  const weather = await (options.weatherFor ?? ((profile, date) => loadWeather(deps, profile, date)))(ctx.profile, tomorrow);
  const first = firstSuggestion({ ...ctx, recentOutfits: history }, weather);
  if (first.kind === 'missing') return first;
  return stateFor(ctx, first.row) ?? { kind: 'missing', date: tomorrow, missing: [] };
}
