import type { Category } from '@tenue/engine';

export interface FlatLayInput {
  id: string;
  category: Category;
}

export interface FlatLayPiece {
  id: string;
  category: Category;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
}

export const FLAT_LAY_OFFSET = 0.12;
export const FLAT_LAY_OVERLAP = 0.1;
const PIECE_WIDTH = 0.68;

const RANK: Record<Category, number> = { outerwear: 0, top: 1, dress: 1, bottom: 2, shoes: 3 };
const WEIGHT: Record<Category, number> = { outerwear: 1.1, top: 1, dress: 1.6, bottom: 1.2, shoes: 0.55 };
const LAYER: Record<Category, number> = { outerwear: 0, bottom: 1, top: 2, dress: 2, shoes: 3 };

export function layoutFlatLay<T extends FlatLayInput>(items: T[], width: number, height: number): FlatLayPiece[] {
  if (items.length === 0 || width <= 0 || height <= 0) return [];
  const ordered = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => RANK[a.item.category] - RANK[b.item.category] || a.index - b.index)
    .map(({ item }) => item);

  const weights = ordered.map((i) => WEIGHT[i.category]);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const overlapped = weights.slice(0, -1).reduce((sum, w) => sum + w * FLAT_LAY_OVERLAP, 0);
  const unit = height / (total - overlapped);
  const pieceWidth = width * PIECE_WIDTH;

  let y = 0;
  return ordered.map((item, i) => {
    const pieceHeight = weights[i]! * unit;
    const side = ordered.length === 1 ? 0 : i % 2 === 0 ? -1 : 1;
    const center = width / 2 + side * FLAT_LAY_OFFSET * width;
    const piece: FlatLayPiece = {
      id: item.id,
      category: item.category,
      x: center - pieceWidth / 2,
      y,
      width: pieceWidth,
      height: pieceHeight,
      z: LAYER[item.category],
    };
    y += pieceHeight * (1 - FLAT_LAY_OVERLAP);
    return piece;
  });
}
