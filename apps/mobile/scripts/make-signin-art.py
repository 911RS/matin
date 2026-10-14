"""Draws the flat cut-out silhouettes used on the sign-in stage.

Usage: python3 -I scripts/make-signin-art.py [out_dir]
Default out_dir: assets/signin next to this script's app folder.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SS = 4

NAVY = (31, 42, 68, 255)
NAVY_RIB = (40, 53, 86, 255)
NAVY_SEAM = (24, 33, 54, 255)
BEIGE = (216, 195, 165, 255)
BEIGE_SEAM = (196, 172, 139, 255)
BEIGE_BAND = (205, 183, 151, 255)
WHITE = (247, 247, 245, 255)
SOLE = (234, 234, 229, 255)
SOLE_EDGE = (201, 203, 198, 255)
SOLE_LINE = (214, 215, 210, 255)
PANEL = (238, 238, 234, 255)
SEAM = (212, 213, 208, 255)
COLLAR = (218, 219, 214, 255)
LACE = (207, 208, 203, 255)


def canvas(w, h):
    return Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))


def pts(points):
    return [(x * SS, y * SS) for x, y in points]


def finish(img, w, h):
    small = img.resize((w, h), Image.LANCZOS)
    alpha = small.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    small.putalpha(alpha)
    return small


def trim(img, pad=4):
    x0, y0, x1, y1 = img.getbbox()
    return img.crop((max(x0 - pad, 0), max(y0 - pad, 0), min(x1 + pad, img.width), min(y1 + pad, img.height)))


def line(d, a, b, fill, width):
    d.line(pts([a, b]), fill=fill, width=int(width * SS))


def rounded(d, box, r, fill):
    x0, y0, x1, y1 = box
    d.rounded_rectangle((x0 * SS, y0 * SS, x1 * SS, y1 * SS), radius=r * SS, fill=fill)


def sweater():
    w, h = 900, 780
    img = canvas(w, h)
    d = ImageDraw.Draw(img)
    body = [
        (300, 70), (360, 52), (540, 52), (600, 70),
        (760, 150), (880, 520), (870, 560), (770, 590), (742, 560),
        (650, 330), (660, 740), (240, 740), (250, 330),
        (158, 560), (130, 590), (30, 560), (20, 520), (140, 150),
    ]
    d.polygon(pts(body), fill=NAVY)
    d.polygon(pts([(240, 690), (660, 690), (660, 740), (240, 740)]), fill=NAVY_RIB)
    d.polygon(pts([(30, 560), (130, 590), (158, 560), (20, 520)]), fill=NAVY_RIB)
    d.polygon(pts([(870, 560), (770, 590), (742, 560), (880, 520)]), fill=NAVY_RIB)
    d.ellipse(pts([(352, 18), (548, 128)]), fill=NAVY_RIB)
    d.ellipse(pts([(372, 30), (528, 104)]), fill=(0, 0, 0, 0))
    d.rectangle(pts([(352, 0), (548, 52)]), fill=(0, 0, 0, 0))
    d.polygon(pts([(300, 70), (360, 52), (372, 52), (310, 74)]), fill=NAVY)
    d.polygon(pts([(600, 70), (540, 52), (528, 52), (590, 74)]), fill=NAVY)
    line(d, (250, 330), (232, 250), NAVY_SEAM, 3)
    line(d, (650, 330), (668, 250), NAVY_SEAM, 3)
    return finish(img, w, h)


def trousers():
    w, h = 560, 1000
    img = canvas(w, h)
    d = ImageDraw.Draw(img)
    legs = [
        (90, 40), (470, 40), (500, 300), (520, 960), (330, 975),
        (282, 380), (278, 380), (230, 975), (40, 960), (60, 300),
    ]
    d.polygon(pts(legs), fill=BEIGE)
    d.polygon(pts([(88, 40), (472, 40), (476, 100), (84, 100)]), fill=BEIGE_BAND)
    for x in (130, 250, 330, 440):
        rounded(d, (x - 8, 36, x + 8, 112), 4, BEIGE_SEAM)
    line(d, (290, 100), (296, 300), BEIGE_SEAM, 3)
    d.arc(pts([(230, 210), (300, 330)]), 270, 360, fill=BEIGE_SEAM, width=3 * SS)
    d.arc(pts([(84, 70), (220, 250)]), 0, 90, fill=BEIGE_SEAM, width=3 * SS)
    d.arc(pts([(340, 70), (476, 250)]), 90, 180, fill=BEIGE_SEAM, width=3 * SS)
    line(d, (165, 420), (140, 940), BEIGE_SEAM, 2)
    line(d, (395, 420), (420, 940), BEIGE_SEAM, 2)
    return finish(img, w, h)


def bezier(p0, p1, p2, p3, steps=24):
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        x = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]
        out.append((x, y))
    return out


def path(start, segments):
    out = [start]
    cur = start
    for c1, c2, end in segments:
        out += bezier(cur, c1, c2, end)
        cur = end
    return out


def sneaker(w, h):
    img = canvas(w, h)
    d = ImageDraw.Draw(img)
    upper = path(
        (40, 246),
        [
            ((24, 196), (26, 120), (62, 92)),
            ((110, 66), (160, 70), (196, 96)),
            ((280, 116), (360, 132), (440, 150)),
            ((600, 176), (690, 196), (692, 246)),
        ],
    )
    d.polygon(pts(upper), fill=WHITE)
    heel = path((40, 246), [((26, 190), (30, 130), (66, 100)), ((90, 150), (110, 200), (118, 246))])
    d.polygon(pts(heel), fill=PANEL)
    d.line(pts(heel[len(heel) // 2 :]), fill=SEAM, width=3 * SS)
    toe = path((540, 246), [((548, 206), (590, 182), (646, 192)), ((680, 204), (694, 226), (692, 246))])
    d.polygon(pts(toe), fill=PANEL)
    d.line(pts(toe[: len(toe) // 2 + 1]), fill=SEAM, width=3 * SS)
    d.ellipse(pts([(84, 84), (186, 104)]), fill=COLLAR)
    top = [(214 + i * 46, 104 + i * 10.5) for i in range(5)]
    bottom = [(228 + i * 46, 132 + i * 10.5) for i in range(5)]
    for i in range(4):
        line(d, top[i], bottom[i + 1], LACE, 4)
        line(d, bottom[i], top[i + 1], LACE, 4)
    for x, y in top + bottom:
        d.ellipse(pts([(x - 4, y - 4), (x + 4, y + 4)]), fill=SEAM)
    rounded(d, (16, 236, 702, 294), 28, SOLE_EDGE)
    rounded(d, (16, 236, 702, 274), 22, SOLE)
    line(d, (46, 256), (672, 256), SOLE_LINE, 2)
    return finish(img, w, h)


def shoes():
    single = sneaker(700, 320)
    w, h = 820, 520
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    back = single.rotate(-3, resample=Image.BICUBIC, expand=True)
    front = single.rotate(2, resample=Image.BICUBIC, expand=True)
    out.alpha_composite(back, (96, 0))
    out.alpha_composite(front, (0, 130))
    return out


def main():
    root = Path(__file__).resolve().parent.parent
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "assets" / "signin"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, art in (("top", sweater()), ("trousers", trousers()), ("shoes", shoes())):
        trimmed = trim(art)
        trimmed.save(out_dir / f"{name}.png", optimize=True)
        print(name, trimmed.width, trimmed.height)


if __name__ == "__main__":
    main()
