import en from '../en.json';
import fr from '../fr.json';

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

describe('i18n resources', () => {
  const flatEn = flatten(en as Tree);
  const flatFr = flatten(fr as Tree);

  it('have identical key sets', () => {
    expect(Object.keys(flatFr).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it('have no empty strings', () => {
    for (const [k, v] of [...Object.entries(flatEn), ...Object.entries(flatFr)]) {
      expect([k, v.trim().length > 0]).toEqual([k, true]);
    }
  });

  it('use the same interpolation variables in both languages', () => {
    const vars = (s: string) => (s.match(/{{\s*\w+\s*}}/g) ?? []).sort();
    for (const k of Object.keys(flatEn)) {
      expect([k, vars(flatFr[k])]).toEqual([k, vars(flatEn[k])]);
    }
  });

  it('never puts a plain space before : ; ? !  in French', () => {
    for (const [k, v] of Object.entries(flatFr)) {
      expect([k, / [:;?!]/.test(v)]).toEqual([k, false]);
    }
  });
});
