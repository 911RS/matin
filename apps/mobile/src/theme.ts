import { Platform, StyleSheet } from 'react-native';
import type { TextStyle } from 'react-native';
import type { ColorFamily } from '@tenue/engine';

const PAPER = '#F7F6F2';
const INK = '#1F1F1C';

export const colors = {
  paper: PAPER,
  surface: '#FFFFFF',
  ink: INK,
  graphite: '#62615B',
  trackOff: '#8A8880',
  line: '#D9D7D0',
  tile: '#EFEEE9',
  accent: INK,
  onAccent: PAPER,
  danger: '#9A3B2E',
  scrim: 'rgba(31, 31, 28, 0.35)',
} as const;

export const hairline = StyleSheet.hairlineWidth;

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
  control: 50,
} as const;

export const radius = {
  stage: 20,
  card: 16,
  tile: 14,
  control: 14,
  input: 12,
  cell: 10,
  sheet: 20,
  round: 999,
} as const;

export const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export type TypeToken = 'display' | 'title' | 'body' | 'bodyStrong' | 'label' | 'caption' | 'eyebrow' | 'tab';

const SCALE: Record<TypeToken, TextStyle> = {
  display: { fontSize: 34, lineHeight: 41, letterSpacing: 0.37, fontWeight: '700', color: colors.ink },
  title: { fontSize: 20, lineHeight: 25, letterSpacing: 0.38, fontWeight: '600', color: colors.ink },
  body: { fontSize: 17, lineHeight: 22, letterSpacing: -0.41, fontWeight: '400', color: colors.ink },
  bodyStrong: { fontSize: 17, lineHeight: 22, letterSpacing: -0.41, fontWeight: '600', color: colors.ink },
  label: { fontSize: 15, lineHeight: 20, letterSpacing: -0.24, fontWeight: '500', color: colors.ink },
  caption: { fontSize: 13, lineHeight: 18, letterSpacing: -0.08, fontWeight: '400', color: colors.graphite },
  eyebrow: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.3,
    fontWeight: '400',
    textTransform: 'uppercase',
    color: colors.graphite,
  },
  tab: { fontSize: 10, lineHeight: 12, letterSpacing: 0.1, fontWeight: '500', color: colors.graphite },
};

export type TypeScale = Record<TypeToken, TextStyle>;

export function makeType(os: string = Platform.OS): TypeScale {
  const out = {} as TypeScale;
  for (const key of Object.keys(SCALE) as TypeToken[]) {
    out[key] = os === 'web' ? { fontFamily: SYSTEM_FONT_STACK, ...SCALE[key] } : { ...SCALE[key] };
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
