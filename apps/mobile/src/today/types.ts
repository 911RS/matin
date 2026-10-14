import type { Category } from '@tenue/engine';
import type { ItemRow, OutfitRow } from '@tenue/backend';

export type TodayState =
  | { kind: 'outfit'; date: string; row: OutfitRow; items: ItemRow[] }
  | { kind: 'missing'; date: string; missing: Category[] };
