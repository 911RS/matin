const WEIGHTS = [5, 4, 3, 2, 1];

export function pickIndex(ranked: { score: number }[], rng: () => number): number {
  const best = ranked[0]!.score;
  let size = 0;
  while (size < WEIGHTS.length && size < ranked.length && ranked[size]!.score >= best - 5) size++;
  const weights = WEIGHTS.slice(0, size);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < size; i++) {
    r -= weights[i]!;
    if (r < 0) return i;
  }
  return size - 1;
}
