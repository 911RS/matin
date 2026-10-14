"""Generate synthetic clothing test photos for the photo dev screen.

Usage: python3 make-test-photos.py [output_dir]
"""

import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SIZE = (1200, 1600)


def scale(points, w, h):
    return [(x * w, y * h) for x, y in points]


TSHIRT = [
    (0.30, 0.20), (0.42, 0.17), (0.50, 0.21), (0.58, 0.17), (0.70, 0.20),
    (0.88, 0.33), (0.80, 0.42), (0.70, 0.36), (0.70, 0.80), (0.30, 0.80),
    (0.30, 0.36), (0.20, 0.42), (0.12, 0.33),
]

JEANS = [
    (0.32, 0.12), (0.68, 0.12), (0.72, 0.88), (0.56, 0.88), (0.50, 0.40),
    (0.44, 0.88), (0.28, 0.88),
]

SHIRT = [
    (0.32, 0.18), (0.44, 0.15), (0.50, 0.22), (0.56, 0.15), (0.68, 0.18),
    (0.80, 0.70), (0.72, 0.72), (0.68, 0.40), (0.68, 0.85), (0.32, 0.85),
    (0.32, 0.40), (0.28, 0.72), (0.20, 0.70),
]

JACKET = [
    (0.30, 0.15), (0.43, 0.12), (0.50, 0.20), (0.57, 0.12), (0.70, 0.15),
    (0.84, 0.75), (0.75, 0.77), (0.70, 0.42), (0.70, 0.88), (0.30, 0.88),
    (0.30, 0.42), (0.25, 0.77), (0.16, 0.75),
]


def gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        color = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
        draw.line([(0, y), (w, y)], fill=color)
    return img


def noisy(img, amount):
    noise = Image.effect_noise(img.size, amount).convert("RGB")
    return Image.blend(img, noise, 0.06)


def shadow(img, polygon, offset, blur):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).polygon([(x + offset, y + offset) for x, y in polygon], fill=110)
    mask = mask.filter(ImageFilter.GaussianBlur(blur))
    dark = Image.new("RGB", img.size, (0, 0, 0))
    return Image.composite(dark, img, mask)


def garment(img, points, color, detail=None):
    w, h = img.size
    polygon = scale(points, w, h)
    img = shadow(img, polygon, max(6, w // 120), max(8, w // 80))
    layer = Image.new("RGB", img.size, color)
    layer = noisy(layer, 40)
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.5))
    img = Image.composite(layer, img, mask)
    if detail:
        detail(ImageDraw.Draw(img), w, h)
    return img


def wood(size, seed):
    rng = random.Random(seed)
    w, h = size
    img = Image.new("RGB", size, (150, 104, 62))
    draw = ImageDraw.Draw(img)
    y = 0
    while y < h:
        plank = rng.randint(h // 10, h // 6)
        base = (rng.randint(135, 170), rng.randint(92, 118), rng.randint(52, 72))
        draw.rectangle([0, y, w, y + plank], fill=base)
        for _ in range(40):
            gy = y + rng.randint(0, plank)
            shade = rng.randint(-25, 10)
            draw.line(
                [(0, gy), (w, gy + rng.randint(-6, 6))],
                fill=tuple(max(0, min(255, c + shade)) for c in base),
                width=rng.randint(1, 3),
            )
        draw.line([(0, y), (w, y)], fill=(70, 45, 25), width=4)
        y += plank
    return img.filter(ImageFilter.GaussianBlur(0.8))


def sneaker(img, color):
    w, h = img.size
    upper = scale([
        (0.15, 0.62), (0.22, 0.45), (0.40, 0.40), (0.52, 0.30), (0.66, 0.30),
        (0.70, 0.42), (0.86, 0.52), (0.88, 0.62),
    ], w, h)
    sole = scale([(0.13, 0.62), (0.90, 0.62), (0.88, 0.68), (0.15, 0.68)], w, h)
    img = shadow(img, upper + sole, max(6, w // 120), max(8, w // 80))
    draw = ImageDraw.Draw(img)
    draw.polygon(upper, fill=color)
    draw.polygon(sole, fill=(240, 240, 236))
    for i in range(5):
        x = (0.46 + i * 0.035) * w
        draw.line([(x, 0.36 * h), (x + 0.04 * w, 0.44 * h)], fill=(250, 250, 250), width=max(3, w // 200))
    return img


def jeans_detail(draw, w, h):
    draw.line([(0.32 * w, 0.17 * h), (0.68 * w, 0.17 * h)], fill=(45, 45, 50), width=4)
    draw.line([(0.50 * w, 0.17 * h), (0.50 * w, 0.38 * h)], fill=(45, 45, 50), width=3)


def shirt_detail(draw, w, h):
    for i in range(6):
        y = (0.28 + i * 0.09) * h
        draw.ellipse([0.495 * w, y, 0.51 * w, y + 0.011 * w], fill=(225, 225, 222))
    draw.line([(0.50 * w, 0.22 * h), (0.50 * w, 0.85 * h)], fill=(232, 232, 230), width=2)


def make(out):
    out.mkdir(parents=True, exist_ok=True)

    floor = noisy(gradient(SIZE, (226, 222, 214), (200, 196, 188)), 30)
    garment(floor, TSHIRT, (27, 42, 74)).save(out / "navy-tshirt-light-floor.jpg", quality=92)

    dark = noisy(gradient(SIZE, (58, 56, 54), (34, 33, 32)), 30)
    garment(dark, JEANS, (18, 18, 20), jeans_detail).save(out / "black-jeans-dark-floor.jpg", quality=92)

    wall = noisy(gradient(SIZE, (244, 244, 242), (236, 236, 233)), 20)
    garment(wall, SHIRT, (248, 248, 246), shirt_detail).save(out / "white-shirt-white-wall.jpg", quality=92)

    sneaker(wood((1600, 1200), 7), (196, 30, 36)).save(out / "red-sneaker-wood.jpg", quality=92)

    noisy(gradient(SIZE, (214, 208, 196), (198, 192, 180)), 20).save(out / "empty-wall.jpg", quality=92)

    big = gradient((4000, 3000), (210, 206, 198), (186, 182, 174))
    garment(big, JACKET, (46, 110, 58)).save(out / "green-jacket-12mp.jpg", quality=85)


if __name__ == "__main__":
    make(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent)
