import type { Category } from '@tenue/engine';
import { layoutFlatLay } from '../flatLay';

const piece = (id: string, category: Category) => ({ id, category });
const W = 360;
const H = 480;

describe('layoutFlatLay', () => {
  it('orders outerwear, top, bottom, shoes from top to bottom', () => {
    const out = layoutFlatLay([piece('s', 'shoes'), piece('b', 'bottom'), piece('o', 'outerwear'), piece('t', 'top')], W, H);
    expect(out.map((p) => p.id)).toEqual(['o', 't', 'b', 's']);
    for (let i = 1; i < out.length; i++) expect(out[i]!.y).toBeGreaterThan(out[i - 1]!.y);
  });

  it('puts a dress in the top slot', () => {
    const out = layoutFlatLay([piece('s', 'shoes'), piece('d', 'dress'), piece('o', 'outerwear')], W, H);
    expect(out.map((p) => p.id)).toEqual(['o', 'd', 's']);
  });

  it('alternates horizontal offsets of 12% of the width', () => {
    const out = layoutFlatLay([piece('t', 'top'), piece('b', 'bottom'), piece('s', 'shoes')], W, H);
    const offsets = out.map((p) => Math.round(p.x + p.width / 2 - W / 2));
    expect(offsets).toEqual([Math.round(-0.12 * W), Math.round(0.12 * W), Math.round(-0.12 * W)]);
  });

  it('overlaps each piece with the previous one by about 10% of its height', () => {
    const out = layoutFlatLay([piece('o', 'outerwear'), piece('t', 'top'), piece('b', 'bottom'), piece('s', 'shoes')], W, H);
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1]!;
      const overlap = prev.y + prev.height - out[i]!.y;
      expect(overlap).toBeCloseTo(prev.height * 0.1, 5);
    }
  });

  it('fits inside the stage', () => {
    for (const n of [1, 2, 3, 4]) {
      const cats: Category[] = ['outerwear', 'top', 'bottom', 'shoes'];
      const out = layoutFlatLay(cats.slice(0, n).map((c, i) => piece(String(i), c)), W, H);
      for (const p of out) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.width).toBeLessThanOrEqual(W);
        expect(p.y + p.height).toBeLessThanOrEqual(H + 0.001);
      }
    }
  });

  it('stacks the top above the bottom and keeps shoes smallest', () => {
    const out = layoutFlatLay([piece('t', 'top'), piece('b', 'bottom'), piece('s', 'shoes')], W, H);
    const by = Object.fromEntries(out.map((p) => [p.id, p]));
    expect(by.t!.z).toBeGreaterThan(by.b!.z);
    expect(by.s!.height).toBeLessThan(by.t!.height);
  });

  it('returns nothing for an empty stage or no pieces', () => {
    expect(layoutFlatLay([], W, H)).toEqual([]);
    expect(layoutFlatLay([piece('t', 'top')], 0, 0)).toEqual([]);
  });
});
