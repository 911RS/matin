import { colors, familyTint, fonts, makeType, space, weatherTint } from '../theme';

describe('space', () => {
  it('returns pixels', () => {
    expect(space(16)).toBe(16);
    expect(space(4)).toBe(4);
    expect(space(20)).toBe(20);
  });
});

describe('makeType', () => {
  it('uses Instrument Sans faces without fontWeight when fonts loaded', () => {
    const t = makeType(false);
    expect(t.display).toEqual(
      expect.objectContaining({ fontFamily: fonts.semibold, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 }),
    );
    expect(t.title.fontFamily).toBe(fonts.semibold);
    expect(t.body.fontFamily).toBe(fonts.regular);
    expect(t.bodyStrong.fontFamily).toBe(fonts.semibold);
    expect(t.label.fontFamily).toBe(fonts.medium);
    expect(t.caption.fontFamily).toBe(fonts.regular);
    for (const style of Object.values(t)) expect(style).not.toHaveProperty('fontWeight');
  });

  it('drops the family and uses system weights when fonts failed', () => {
    const t = makeType(true);
    for (const style of Object.values(t)) expect(style).not.toHaveProperty('fontFamily');
    expect(t.display.fontWeight).toBe('600');
    expect(t.title.fontWeight).toBe('600');
    expect(t.bodyStrong.fontWeight).toBe('600');
    expect(t.label.fontWeight).toBe('500');
    expect(t.body.fontWeight).toBe('400');
    expect(t.caption.fontWeight).toBe('400');
    expect(t.display.fontSize).toBe(34);
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

  it('keeps graphite text at 4.5:1 on every stage tint', () => {
    for (const bg of [...Object.values(familyTint), ...Object.values(weatherTint)]) {
      expect(contrast(colors.graphite, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps ink text at 7:1 on every stage tint', () => {
    for (const bg of [...Object.values(familyTint), ...Object.values(weatherTint)]) {
      expect(contrast(colors.ink, bg)).toBeGreaterThanOrEqual(7);
    }
  });

  it('gives the switch off-track 3:1 against surface and paper', () => {
    for (const bg of [colors.surface, colors.paper]) expect(contrast(colors.trackOff, bg)).toBeGreaterThanOrEqual(3);
  });

  it('measures known pairs', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast(colors.graphite, colors.paper)).toBeGreaterThan(5.3);
  });
});

describe('tab type', () => {
  it('is 12 px in the medium face', () => {
    const t = makeType(false);
    expect(t.tab).toEqual(expect.objectContaining({ fontFamily: fonts.medium, fontSize: 12 }));
  });
});
