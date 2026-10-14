import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemRow, OutfitRow, ProfileRow } from '@tenue/backend';
import { readBytes } from './files';
import type { ImageContentType, OutfitPatch, ProfilePatch, Repo } from './repo';

const URL_TTL_SECONDS = 3600;
const URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export class SupabaseRepo implements Repo {
  private readonly urlCache = new Map<string, { url: string; expiresAt: number }>();

  constructor(
    private readonly client: SupabaseClient,
    private readonly now: () => number = Date.now,
  ) {}

  async userId(): Promise<string | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return data.session?.user.id ?? null;
  }

  private async requireUserId(): Promise<string> {
    const id = await this.userId();
    if (!id) throw new Error('not signed in');
    return id;
  }

  async getProfile(): Promise<ProfileRow> {
    const id = await this.requireUserId();
    const { data, error } = await this.client.from('profiles').select('*').eq('id', id).single();
    if (error) throw error;
    return data as ProfileRow;
  }

  async updateProfile(patch: ProfilePatch): Promise<void> {
    const id = await this.requireUserId();
    const { expo_push_token: _token, ...safe } = patch as ProfilePatch & { expo_push_token?: unknown };
    const { error } = await this.client.from('profiles').update(safe).eq('id', id);
    if (error) throw error;
  }

  async claimPushToken(token: string | null): Promise<void> {
    const { error } = await this.client.rpc('claim_push_token', { token });
    if (error) throw error;
  }

  async listItems(opts?: { includeArchived?: boolean }): Promise<ItemRow[]> {
    let q = this.client.from('items').select('*');
    if (!opts?.includeArchived) q = q.is('archived_at', null);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as ItemRow[];
  }

  async saveItem(row: ItemRow): Promise<void> {
    const { error } = await this.client.from('items').upsert(row, { onConflict: 'id' });
    if (error) throw error;
  }

  async uploadImage(localUri: string, path: string, contentType: ImageContentType): Promise<void> {
    const bytes = await readBytes(localUri);
    const { error } = await this.client.storage
      .from('items')
      .upload(path, bytes, { contentType, upsert: true });
    if (error) throw error;
  }

  async imageUrl(path: string): Promise<string> {
    const cached = this.urlCache.get(path);
    if (cached && this.now() < cached.expiresAt - URL_REFRESH_MARGIN_MS) return cached.url;
    const { data, error } = await this.client.storage
      .from('items')
      .createSignedUrl(path, URL_TTL_SECONDS);
    if (error) throw error;
    this.urlCache.set(path, {
      url: data.signedUrl,
      expiresAt: this.now() + URL_TTL_SECONDS * 1000,
    });
    return data.signedUrl;
  }

  async getOutfit(date: string): Promise<OutfitRow | null> {
    const { data, error } = await this.client
      .from('outfits')
      .select('*')
      .eq('date', date)
      .maybeSingle();
    if (error) throw error;
    return (data as OutfitRow | null) ?? null;
  }

  async insertOutfit(row: OutfitRow): Promise<'inserted' | 'conflict'> {
    const { pushed_at: _pushedAt, ...rest } = row;
    const { error } = await this.client.from('outfits').insert(rest);
    if (!error) return 'inserted';
    if (error.code === '23505') return 'conflict';
    throw error;
  }

  async updateOutfit(date: string, patch: OutfitPatch): Promise<void> {
    const id = await this.requireUserId();
    let q = this.client.from('outfits').update(patch).eq('user_id', id).eq('date', date);
    if (patch.status === undefined) q = q.neq('status', 'worn');
    const { error } = await q;
    if (error) throw error;
  }

  async listOutfits(fromDate: string, toDate: string): Promise<OutfitRow[]> {
    const { data, error } = await this.client
      .from('outfits')
      .select('*')
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true });
    if (error) throw error;
    return (data ?? []) as OutfitRow[];
  }

  async deleteAccount(): Promise<void> {
    const { error } = await this.client.functions.invoke('delete-account');
    if (error) throw error;
    const { error: signOutError } = await this.client.auth.signOut();
    if (signOutError) console.warn('signOut after account deletion failed', signOutError);
  }
}
