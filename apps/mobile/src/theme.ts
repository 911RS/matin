import type { TextStyle } from 'react-native';
import type { ColorFamily } from '@tenue/engine';

export const colors = {
  paper: '#F4F5F3',
  surface: '#FFFFFF',
  ink: '#16181A',
  graphite: '#5F6368',
  trackOff: '#84888D',
  line: '#E3E4E0',
  tile: '#ECEDE9',
  accent: '#2B4BDB',
  onAccent: '#FFFFFF',
  danger: '#C2412D',
  scrim: 'rgba(22, 24, 26, 0.4)',
} as const;

export const familyTint: Record<ColorFamily, string> = {
  black: '#E4E4E2',
  white: '#EDEEEA',
  grey: '#E3E5E6',
  navy: '#DCE2EE',
  blue: '#D9E4F7',
  beige: '#EFE7DA',
  brown: '#E9DDD3',
  green: '#DCE8DF',
  red: '#F3DCD8',
  pink: '#F5E1E8',
  yellow: '#F4EDCB',
  purple: '#E6DFF1',
  denim: '#DAE3EE',
  multi: '#ECE6F0',
};

export const weatherTint = {
  rain: '#DDE3EA',
  cold: '#DCE6EF',
  mild: '#E6EBE3',
  warm: '#F2E7D9',
} as const;

export const swatch: Record<ColorFamily, string> = {
  black: '#1C1C1C',
  white: '#F7F7F5',
  grey: '#9A9DA0',
  navy: '#1F2A44',
  blue: '#3A6FD8',
  beige: '#D8C3A5',
  brown: '#6B4423',
  green: '#3F7D3A',
  red: '#C0392B',
  pink: '#E89AB5',
  yellow: '#F1C40F',
  purple: '#7D3C98',
  denim: '#5470A0',
  multi: '#C0392B',
};

export const multiSwatch = [swatch.red, swatch.yellow, swatch.blue, swatch.green] as const;

export type Space = 0 | 4 | 8 | 12 | 16 | 20 | 24 | 32;

export function space(n: Space): number {
  return n;
}

export const size = {
  control: 52,
} as const;

export const radius = {
  stage: 28,
  tile: 20,
  input: 14,
  cell: 12,
  round: 999,
} as const;

export const fonts = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
} as const;

type Face = keyof typeof fonts;
type Weight = '400' | '500' | '600' | '700';
export type TypeToken = 'display' | 'title' | 'body' | 'bodyStrong' | 'label' | 'caption' | 'tab';

const WEIGHT: Record<Face, Weight> = { regular: '400', medium: '500', semibold: '600', bold: '700' };

const SCALE: Record<TypeToken, { face: Face; style: TextStyle }> = {
  display: { face: 'semibold', style: { fontSize: 34, lineHeight: 38, letterSpacing: -0.6, color: colors.ink } },
  title: { face: 'semibold', style: { fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: colors.ink } },
  body: { face: 'regular', style: { fontSize: 16, lineHeight: 23, color: colors.ink } },
  bodyStrong: { face: 'semibold', style: { fontSize: 16, lineHeight: 23, color: colors.ink } },
  label: { face: 'medium', style: { fontSize: 14, lineHeight: 19, color: colors.ink } },
  caption: { face: 'regular', style: { fontSize: 13, lineHeight: 18, color: colors.graphite } },
  tab: { face: 'medium', style: { fontSize: 12, lineHeight: 16, color: colors.graphite } },
};

export type TypeScale = Record<TypeToken, TextStyle>;

export function makeType(fontsFailed: boolean): TypeScale {
  const out = {} as TypeScale;
  for (const key of Object.keys(SCALE) as TypeToken[]) {
    const { face, style } = SCALE[key];
    out[key] = fontsFailed ? { ...style, fontWeight: WEIGHT[face] } : { fontFamily: fonts[face], ...style };
  }
  return out;
}

export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const googleMark = {
  red: '#EA4335',
  blue: '#4285F4',
  yellow: '#FBBC05',
  green: '#34A853',
} as const;
