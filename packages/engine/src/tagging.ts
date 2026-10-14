import type { Category, ColorFamily } from './types.ts';

type Family = Exclude<ColorFamily, 'multi'>;

const PALETTE: Record<Family, string> = {
  black: '1a1a1a',
  white: 'f5f5f5',
  grey: '8c8c8c',
  navy: '1f2a44',
  blue: '3a6fd8',
  beige: 'd8c3a5',
  brown: '6b4423',
  green: '3f7d3a',
  red: 'c0392b',
  pink: 'e89ab5',
  yellow: 'f1c40f',
  purple: '7d3c98',
  denim: '5470a0',
};

type Lab = [number, number, number];

function toLab(hex: string): Lab {
  const lin = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin as [number, number, number];
  const xyz = [
    (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883,
  ];
  const f = xyz.map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116));
  return [116 * f[1]! - 16, 500 * (f[0]! - f[1]!), 200 * (f[1]! - f[2]!)];
}

const PALETTE_LAB = (Object.keys(PALETTE) as Family[]).map(
  (family) => [family, toLab(PALETTE[family])] as const,
);

export function hexToColorFamily(hex: string): Family {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error('Invalid hex');
  const lab = toLab(m[1]!.toLowerCase());
  let best: Family = 'black';
  let bestDist = Infinity;
  for (const [family, ref] of PALETTE_LAB) {
    const d = (lab[0] - ref[0]) ** 2 + (lab[1] - ref[1]) ** 2 + (lab[2] - ref[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = family;
    }
  }
  return best;
}

const KEYWORDS: [Category, string[]][] = [
  ['dress', ['dress', 'gown']],
  ['outerwear', ['jacket', 'coat', 'blazer', 'parka', 'raincoat', 'windbreaker', 'cardigan']],
  ['shoes', ['shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'sandal', 'sandals', 'footwear', 'loafer', 'loafers', 'heel', 'heels']],
  ['bottom', ['jeans', 'trousers', 'pants', 'shorts', 'skirt', 'leggings', 'chinos']],
  ['top', ['shirt', 't-shirt', 'sweater', 'hoodie', 'blouse', 'top', 'polo', 'sweatshirt', 'jersey', 'tank']],
];

function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  return new RegExp(`(?<![a-z])${escaped}(?![a-z])`).test(text);
}

export function labelsToCategory(labels: string[]): Category | null {
  for (const label of labels) {
    const text = label.toLowerCase();
    if (hasWord(text, 'shirt')) return 'top';
    for (const [category, words] of KEYWORDS) {
      if (words.some((w) => hasWord(text, w))) return category;
    }
  }
  return null;
}
