import { colors, makeType, radius, space, SYSTEM_FONT_STACK } from '../theme';

describe('space', () => {
  it('returns pixels', () => {
    expect(space(16)).toBe(16);
    expect(space(4)).toBe(4);
    expect(space(20)).toBe(20);
  });
});

describe('makeType', () => {
  it('follows the iOS text styles with system weights', () => {
    const t = makeType();
    expect(t.display).toEqual(expect.objectContaining({ fontSize: 34, lineHeight: 41, fontWeight: '700' }));
    expect(t.title).toEqual(expect.objectContaining({ fontSize: 20, lineHeight: 25, fontWeight: '600' }));
    expect(t.body).toEqual(expect.objectContaining({ fontSize: 17, lineHeight: 22, fontWeight: '400' }));
    expect(t.bodyStrong).toEqual(expect.objectContaining({ fontSize: 17, fontWeight: '600' }));
    expect(t.label).toEqual(expect.objectContaining({ fontSize: 15, lineHeight: 20, fontWeight: '500' }));
    expect(t.caption).toEqual(expect.objectContaining({ fontSize: 13, lineHeight: 18, color: colors.graphite }));
    expect(t.eyebrow).toEqual(expect.objectContaining({ fontSize: 13, textTransform: 'uppercase', color: colors.graphite }));
    expect(t.tab).toEqual(expect.objectContaining({ fontSize: 10, fontWeight: '500' }));
  });

  it('uses the platform font on native', () => {
    for (const style of Object.values(makeType('ios'))) expect(style).not.toHaveProperty('fontFamily');
  });

  it('asks the browser for the system font stack on the web', () => {
    for (const style of Object.values(makeType('web'))) expect(style.fontFamily).toBe(SYSTEM_FONT_STACK);
    expect(SYSTEM_FONT_STACK.startsWith('-apple-system')).toBe(true);
  });
});

describe('palette', () => {
  it('is paper with white cards and an ink accent', () => {
    expect(colors.paper).toBe('#F7F6F2');
    expect(colors.surface).toBe('#FFFFFF');
    expect(colors.accent).toBe(colors.ink);
    expect(radius.card).toBe(16);
    expect(radius.control).toBe(14);
  });
});

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('contrast', () => {
  it('keeps graphite text at 5:1 on paper, tile and surface', () => {
    for (const bg of [colors.paper, colors.tile, colors.surface]) expect(contrast(colors.graphite, bg)).toBeGreaterThanOrEqual(5);
  });



  it('gives the switch off-track 3:1 against surface and paper', () => {
    for (const bg of [colors.surface, colors.paper]) expect(contrast(colors.trackOff, bg)).toBeGreaterThanOrEqual(3);
  });

  it('measures known pairs', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast(colors.graphite, colors.paper)).toBeGreaterThan(5.3);
  });
});
