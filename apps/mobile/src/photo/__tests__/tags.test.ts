import { toTags } from '../tags';

describe('toTags', () => {
  it('maps labels and dominant color', () => {
    expect(toTags({ dominantColor: '#1b2a4a', labels: ['Jeans'] })).toEqual({
      category: 'bottom',
      colorFamily: 'navy',
      colorHex: '#1b2a4a',
    });
  });

  it('returns null category without labels', () => {
    expect(toTags({ dominantColor: '#1b2a4a', labels: [] }).category).toBeNull();
  });

  it('falls back to multi for an invalid color', () => {
    const tags = toTags({ dominantColor: 'oops', labels: [] });
    expect(tags.colorFamily).toBe('multi');
    expect(tags.colorHex).toBe('oops');
  });
});
