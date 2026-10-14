import type { ItemRow, OutfitRow, ProfileRow } from '@tenue/backend';

export type ProfilePatch = Partial<Omit<ProfileRow, 'id' | 'expo_push_token'>>;
export type OutfitPatch = Partial<Pick<OutfitRow, 'item_ids' | 'seed' | 'status' | 'weather'>>;
export type ImageContentType = 'image/webp' | 'image/png' | 'image/jpeg';

export interface Repo {
  userId(): Promise<string | null>;
  getProfile(): Promise<ProfileRow>;
  updateProfile(patch: ProfilePatch): Promise<void>;
  claimPushToken(token: string | null): Promise<void>;
  listItems(opts?: { includeArchived?: boolean }): Promise<ItemRow[]>;
  saveItem(row: ItemRow): Promise<void>;
  uploadImage(localUri: string, path: string, contentType: ImageContentType): Promise<void>;
  imageUrl(path: string): Promise<string>;
  getOutfit(date: string): Promise<OutfitRow | null>;
  insertOutfit(row: OutfitRow): Promise<'inserted' | 'conflict'>;
  updateOutfit(date: string, patch: OutfitPatch): Promise<void>;
  listOutfits(fromDate: string, toDate: string): Promise<OutfitRow[]>;
  deleteAccount(): Promise<void>;
}
