import { dragCrop, FULL_CROP, isFullCrop, MIN_CROP, toPixels } from '../cropMath';

describe('dragCrop', () => {
  it('moves one corner and leaves the opposite corner in place', () => {
    expect(dragCrop(FULL_CROP, 'tl', 0.2, 0.1)).toEqual({ x: 0.2, y: 0.1, width: 0.8, height: 0.9 });
    expect(dragCrop(FULL_CROP, 'br', -0.25, -0.5)).toEqual({ x: 0, y: 0, width: 0.75, height: 0.5 });
    expect(dragCrop(FULL_CROP, 'tr', -0.1, 0.3)).toEqual({ x: 0, y: 0.3, width: 0.9, height: 0.7 });
    expect(dragCrop(FULL_CROP, 'bl', 0.4, -0.2)).toEqual({ x: 0.4, y: 0, width: 0.6, height: 0.8 });
  });

  it('never lets a corner leave the image', () => {
    expect(dragCrop(FULL_CROP, 'tl', -0.5, -0.5)).toEqual(FULL_CROP);
    expect(dragCrop({ x: 0.2, y: 0.2, width: 0.5, height: 0.5 }, 'br', 1, 1)).toEqual({ x: 0.2, y: 0.2, width: 0.8, height: 0.8 });
  });

  it('keeps a minimum size when a corner is dragged past the opposite one', () => {
    const c = dragCrop(FULL_CROP, 'tl', 2, 2);
    expect(c.width).toBeCloseTo(MIN_CROP);
    expect(c.height).toBeCloseTo(MIN_CROP);
    expect(c.x + c.width).toBeCloseTo(1);
    expect(c.y + c.height).toBeCloseTo(1);
  });

  it('moves the whole frame without resizing it, stopping at the edges', () => {
    const start = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };
    expect(dragCrop(start, 'move', 0.2, 0.1)).toEqual({ x: 0.3, y: 0.2, width: 0.5, height: 0.5 });
    expect(dragCrop(start, 'move', 1, -1)).toEqual({ x: 0.5, y: 0, width: 0.5, height: 0.5 });
  });
});

describe('isFullCrop', () => {
  it('treats a frame within half a percent of the edges as the full image', () => {
    expect(isFullCrop(FULL_CROP)).toBe(true);
    expect(isFullCrop({ x: 0.003, y: 0, width: 0.997, height: 1 })).toBe(true);
    expect(isFullCrop({ x: 0.1, y: 0, width: 0.9, height: 1 })).toBe(false);
  });
});

describe('toPixels', () => {
  it('turns the frame into whole pixels inside the image', () => {
    expect(toPixels({ x: 0.25, y: 0.1, width: 0.5, height: 0.8 }, 1000, 500)).toEqual({
      originX: 250,
      originY: 50,
      width: 500,
      height: 400,
    });
    expect(toPixels({ x: 0.333, y: 0.333, width: 0.667, height: 0.667 }, 100, 100)).toEqual({
      originX: 33,
      originY: 33,
      width: 67,
      height: 67,
    });
  });
});
