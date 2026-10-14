const MAX_LABELS = 10;

const LABELS = new Map<string, string>(Object.entries({
  jersey: 'T-shirt',
  sweatshirt: 'Sweatshirt',
  cardigan: 'Cardigan',
  'trench coat': 'Coat',
  'fur coat': 'Coat',
  'lab coat': 'Coat',
  poncho: 'Raincoat',
  suit: 'Blazer',
  jean: 'Jeans',
  miniskirt: 'Skirt',
  overskirt: 'Skirt',
  hoopskirt: 'Skirt',
  sarong: 'Skirt',
  'swimming trunks': 'Shorts',
  gown: 'Dress',
  abaya: 'Dress',
  'running shoe': 'Sneakers',
  Loafer: 'Loafers',
  sandal: 'Sandals',
  clog: 'Shoe',
  'cowboy boot': 'Boots',
  'shoe shop': 'Shoe',
}));

export interface ImagenetCategory {
  categoryName?: string;
  score: number;
}

export function imagenetToLabels(categories: readonly ImagenetCategory[]): string[] {
  const labels: string[] = [];
  for (const { categoryName } of [...categories].sort((a, b) => b.score - a.score)) {
    const label = categoryName === undefined ? undefined : LABELS.get(categoryName);
    if (label !== undefined && !labels.includes(label)) labels.push(label);
    if (labels.length === MAX_LABELS) break;
  }
  return labels;
}
