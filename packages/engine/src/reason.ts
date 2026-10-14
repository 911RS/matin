import type { ColorFamily, Item, Locale, Weather } from './types.ts';
import { colorKind } from './color.ts';
import { outerwearRule, shownTemperature } from './weather.ts';

const FR_COLORS: Record<ColorFamily, string> = {
  black: 'noir', white: 'blanc', grey: 'gris', navy: 'marine', blue: 'bleu', beige: 'beige', brown: 'marron',
  green: 'vert', red: 'rouge', pink: 'rose', yellow: 'jaune', purple: 'violet', denim: 'denim', multi: 'multicolore',
};

function colorName(c: ColorFamily, locale: Locale): string {
  return locale === 'fr' ? FR_COLORS[c] : c;
}

function weatherPart(weather: Weather, noJacket: boolean, locale: Locale): string {
  const fr = locale === 'fr';
  if (noJacket) return fr ? 'Pas de veste dans ton placard' : 'No jacket in your closet';
  const rule = outerwearRule(weather);
  const t = shownTemperature(weather);
  if (t === null) {
    const prefix = fr ? 'Météo indisponible\u00a0: ' : 'Weather unavailable: ';
    if (rule === 'required' && weather.rain) return prefix + (fr ? 'veste conseillée' : 'jacket on');
    if (rule === 'required') return prefix + (fr ? 'couche chaude' : 'warm layer');
    if (rule === 'excluded') return prefix + (fr ? 'reste léger' : 'keep it light');
    return prefix + (fr ? 'pas besoin de veste' : 'no layer needed');
  }
  if (rule === 'required') {
    if (weather.rain) return fr ? 'Pluie prévue\u00a0: veste conseillée' : 'Rain expected: jacket on';
    return fr ? `${t}°C\u00a0: couche chaude` : `${t}°C: warm layer`;
  }
  if (rule === 'excluded') return fr ? `${t}°C\u00a0: reste léger` : `${t}°C: keep it light`;
  return fr ? `${t}°C, pas besoin de veste` : `${t}°C, no layer needed`;
}

function colorPart(items: Item[], locale: Locale): string | null {
  const fr = locale === 'fr';
  const kind = colorKind(items.map((i) => i.colorFamily));
  switch (kind.kind) {
    case 'neutral':
      return fr ? 'les neutres vont avec tout' : 'neutrals always work';
    case 'accent': {
      const c = colorName(kind.color, locale);
      return fr ? `${c} avec des neutres` : `${c} with neutrals`;
    }
    case 'pair': {
      const a = colorName(kind.a, locale);
      const b = colorName(kind.b, locale);
      return fr ? `${a} + ${b} vont bien ensemble` : `${a} + ${b} match`;
    }
    case 'clash':
      return null;
  }
}

export function buildReason(items: Item[], weather: Weather, noJacket: boolean, locale: Locale): string {
  const parts: string[] = [];
  parts.push(weatherPart(weather, noJacket, locale));
  const color = colorPart(items, locale);
  if (color) parts.push(color);
  return parts.join(' · ');
}
