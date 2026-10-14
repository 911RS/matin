import { argbFromRgba, colorHex, dominantColor, opaqueBounds, sampleSize } from '../pixelOps';

describe('pixelOps', () => {
  it('dominantColor picks the most frequent bucket mean', () => {
    const red = 0xfff01010;
    const blue = 0xff1010f0;
    expect(dominantColor([red, red, red, blue])).toBe(red);
  });

  it('dominantColor is null when all transparent', () => {
    expect(dominantColor([0x7fff0000, 0x00000000, 0x10ffffff])).toBeNull();
  });

  it('dominantColor ignores translucent pixels', () => {
    const green = 0xff20f020;
    const red = 0x7ff01010;
    expect(dominantColor([red, red, red, green])).toBe(green);
  });

  it('dominantColor tie goes to the lowest bucket', () => {
    const high = 0xfff0f0f0;
    const low = 0xff101010;
    expect(dominantColor([high, low, high, low])).toBe(low);
  });

  it('dominantColor averages pixels in the same bucket', () => {
    expect(dominantColor([0xff102030, 0xff1f2f3f])).toBe(0xff172737);
  });

  it('dominantColor of empty is null', () => {
    expect(dominantColor([])).toBeNull();
  });

  it('opaqueBounds finds a single pixel', () => {
    const pixels = new Array<number>(16).fill(0);
    pixels[1 * 4 + 2] = 0xff000000;
    expect(opaqueBounds(pixels, 4, 4)).toEqual([2, 1, 3, 2]);
  });

  it('opaqueBounds spans multiple pixels', () => {
    const pixels = new Array<number>(12).fill(0);
    pixels[0 * 4 + 1] = 0x80000000;
    pixels[2 * 4 + 3] = 0xffffffff;
    pixels[2 * 4 + 0] = 0x7fffffff;
    expect(opaqueBounds(pixels, 4, 3)).toEqual([1, 0, 4, 3]);
  });

  it('opaqueBounds is null when nothing is opaque', () => {
    expect(opaqueBounds(new Array<number>(16).fill(0x7fffffff), 4, 4)).toBeNull();
  });

  it('sampleSize is the smallest power of two within the max side', () => {
    expect(sampleSize(4000, 3000)).toBe(2);
    expect(sampleSize(1000, 800)).toBe(1);
    expect(sampleSize(9000, 6000)).toBe(8);
    expect(sampleSize(2048, 2048)).toBe(1);
    expect(sampleSize(2049, 10)).toBe(2);
  });

  it('argbFromRgba packs canvas bytes into ARGB pixels', () => {
    const rgba = new Uint8ClampedArray([0xf0, 0x10, 0x20, 0xff, 0x01, 0x02, 0x03, 0x7f]);
    expect(Array.from(argbFromRgba(rgba))).toEqual([0xfff01020, 0x7f010203]);
  });

  it('colorHex formats the RGB part in lowercase', () => {
    expect(colorHex(0xff1b2a4a)).toBe('#1b2a4a');
    expect(colorHex(0xff000000)).toBe('#000000');
  });
});
