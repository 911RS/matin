"""Draws the flat garment cut-outs bundled for demo mode.

Usage: python3 -I scripts/make-demo-assets.py [out_dir]
Default out_dir: assets/demo next to this script's app folder.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SS = 4
LONG_SIDE = 720
CLEAR = (0, 0, 0, 0)

NAVY = (31, 42, 68, 255)
NAVY_RIB = (40, 53, 86, 255)
NAVY_SEAM = (24, 33, 54, 255)
BLUE = (148, 180, 226, 255)
BLUE_SEAM = (122, 154, 202, 255)
BLUE_DARK = (108, 140, 190, 255)
BEIGE = (216, 195, 165, 255)
BEIGE_SEAM = (196, 172, 139, 255)
BEIGE_BAND = (205, 183, 151, 255)
DENIM = (84, 112, 160, 255)
DENIM_SEAM = (196, 156, 92, 255)
DENIM_DARK = (70, 95, 140, 255)
GREEN = (63, 125, 58, 255)
GREEN_DARK = (52, 106, 48, 255)
GREEN_SEAM = (46, 94, 43, 255)
WHITE = (247, 247, 245, 255)
SOLE = (234, 234, 229, 255)
SOLE_EDGE = (201, 203, 198, 255)
SOLE_LINE = (214, 215, 210, 255)
PANEL = (238, 238, 234, 255)
SEAM = (212, 213, 208, 255)
COLLAR = (218, 219, 214, 255)
LACE = (207, 208, 203, 255)
BROWN = (107, 68, 35, 255)
BROWN_DARK = (84, 52, 26, 255)
BROWN_SOLE = (52, 36, 24, 255)
BROWN_ELASTIC = (70, 48, 30, 255)
GREY = (154, 157, 160, 255)
GREY_DARK = (128, 131, 135, 255)
GREY_SEAM = (112, 115, 119, 255)
BUTTON = (60, 62, 66, 255)


def canvas(w, h):
    return Image.new("RGBA", (w * SS, h * SS), CLEAR)


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


def fit(img):
    scale = LONG_SIDE / max(img.width, img.height)
    if scale >= 1:
        return img
    return img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)


def line(d, a, b, fill, width):
    d.line(pts([a, b]), fill=fill, width=int(width * SS))


def rounded(d, box, r, fill):
    x0, y0, x1, y1 = box
    d.rounded_rectangle((x0 * SS, y0 * SS, x1 * SS, y1 * SS), radius=r * SS, fill=fill)


def dot(d, x, y, r, fill):
    d.ellipse(pts([(x - r, y - r), (x + r, y + r)]), fill=fill)


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
    d.ellipse(pts([(372, 30), (528, 104)]), fill=CLEAR)
    d.rectangle(pts([(352, 0), (548, 52)]), fill=CLEAR)
    d.polygon(pts([(300, 70), (360, 52), (372, 52), (310, 74)]), fill=NAVY)
    d.polygon(pts([(600, 70), (540, 52), (528, 52), (590, 74)]), fill=NAVY)
    line(d, (250, 330), (232, 250), NAVY_SEAM, 3)
    line(d, (650, 330), (668, 250), NAVY_SEAM, 3)
    return finish(img, w, h)


def shirt():
    w, h = 900, 860
    img = canvas(w, h)
    d = ImageDraw.Draw(img)
    body = [
        (310, 60), (390, 40), (510, 40), (590, 60),
        (760, 140), (870, 600), (790, 624), (742, 600),
        (650, 320), (662, 820), (450, 836), (238, 820), (250, 320),
        (158, 600), (110, 624), (30, 600), (140, 140),
    ]
    d.polygon(pts(body), fill=BLUE)
    d.polygon(pts([(30, 600), (110, 624), (158, 600), (150, 560), (40, 560)]), fill=BLUE_DARK)
    d.polygon(pts([(870, 600), (790, 624), (742, 600), (750, 560), (860, 560)]), fill=BLUE_DARK)
    d.polygon(pts([(390, 40), (450, 120), (370, 150), (330, 64)]), fill=BLUE_DARK)
    d.polygon(pts([(510, 40), (450, 120), (530, 150), (570, 64)]), fill=BLUE_DARK)
    line(d, (450, 120), (450, 830), BLUE_SEAM, 3)
    for y in (190, 300, 410, 520, 630, 740):
        dot(d, 462, y, 7, WHITE)
    line(d, (250, 320), (236, 230), BLUE_SEAM, 3)
    line(d, (650, 320), (664, 230), BLUE_SEAM, 3)
    rounded(d, (500, 220, 600, 330), 8, BLUE_SEAM)
    rounded(d, (504, 224, 596, 326), 6, BLUE)
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


def jeans():
    w, h = 560, 1000
    img = canvas(w, h)
    d = ImageDraw.Draw(img)
    legs = [
        (96, 40), (464, 40), (492, 300), (500, 960), (320, 972),
        (282, 400), (278, 400), (240, 972), (60, 960), (68, 300),
    ]
    d.polygon(pts(legs), fill=DENIM)
    d.polygon(pts([(94, 40), (466, 40), (470, 96), (90, 96)]), fill=DENIM_DARK)
    line(d, (90, 96), (470, 96), DENIM_SEAM, 2)
    for x in (140, 260, 300, 420):
        rounded(d, (x - 7, 34, x + 7, 108), 3, DENIM_DARK)
    dot(d, 282, 68, 9, DENIM_SEAM)
    line(d, (286, 96), (292, 300), DENIM_SEAM, 2)
    d.arc(pts([(232, 214), (296, 326)]), 270, 360, fill=DENIM_SEAM, width=2 * SS)
    d.arc(pts([(90, 66), (226, 246)]), 0, 90, fill=DENIM_SEAM, width=2 * SS)
    d.arc(pts([(334, 66), (470, 246)]), 90, 180, fill=DENIM_SEAM, width=2 * SS)
    d.polygon(pts([(66, 920), (240, 930), (240, 972), (60, 960)]), fill=DENIM_DARK)
    d.polygon(pts([(320, 930), (494, 920), (500, 960), (320, 972)]), fill=DENIM_DARK)
    line(d, (170, 410), (150, 920), DENIM_SEAM, 2)
    line(d, (390, 410), (410, 920), DENIM_SEAM, 2)
    return finish(img, w, h)


def dress():
    w, h = 720, 1080
    img = canvas(w, h)
    d = ImageDraw.Draw(img)
    straps_l = [(250, 30), (282, 30), (300, 170), (268, 170)]
    straps_r = [(470, 30), (438, 30), (420, 170), (452, 170)]
    d.polygon(pts(straps_l), fill=GREEN_DARK)
    d.polygon(pts(straps_r), fill=GREEN_DARK)
    bodice = path(
        (230, 160),
        [
            ((300, 210), (420, 210), (490, 160)),
            ((500, 260), (480, 360), (470, 420)),
            ((420, 432), (300, 432), (250, 420)),
            ((240, 360), (220, 260), (230, 160)),
        ],
    )
    d.polygon(pts(bodice), fill=GREEN)
    skirt = path(
        (250, 420),
        [
            ((400, 440), (320, 440), (470, 420)),
            ((560, 640), (640, 860), (700, 1030)),
            ((480, 1066), (240, 1066), (20, 1030)),
            ((80, 860), (160, 640), (250, 420)),
        ],
    )
    d.polygon(pts(skirt), fill=GREEN)
    rounded(d, (246, 406, 474, 440), 10, GREEN_DARK)
    for x0, x1 in ((320, 230), (400, 490)):
        line(d, (x0, 450), (x1, 1040), GREEN_SEAM, 2)
    line(d, (360, 200), (360, 410), GREEN_SEAM, 2)
    return finish(img, w, h)


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


def pair(single, w, h, back_at, front_at):
    out = Image.new("RGBA", (w, h), CLEAR)
    back = single.rotate(-3, resample=Image.BICUBIC, expand=True)
    front = single.rotate(2, resample=Image.BICUBIC, expand=True)
    out.alpha_composite(back, back_at)
    out.alpha_composite(front, front_at)
    return out


def sneakers():
    return pair(sneaker(700, 320), 820, 520, (96, 0), (0, 130))


def boot(w, h):
    img = canvas(w, h)
    d = ImageDraw.Draw(img)
    shape = path(
        (60, 420),
        [
            ((50, 300), (70, 120), (90, 30)),
            ((150, 22), (230, 22), (290, 30)),
            ((300, 150), (310, 230), (330, 280)),
            ((440, 300), (580, 330), (620, 380)),
            ((640, 400), (640, 420), (630, 420)),
        ],
    )
    d.polygon(pts(shape), fill=BROWN)
    elastic = path((210, 40), [((220, 120), (236, 200), (250, 270)), ((230, 280), (190, 280), (170, 270)), ((172, 190), (180, 110), (180, 40))])
    d.polygon(pts(elastic), fill=BROWN_ELASTIC)
    tab = [(108, 0), (150, 0), (152, 40), (110, 44)]
    d.polygon(pts(tab), fill=BROWN_DARK)
    line(d, (330, 280), (604, 372), BROWN_DARK, 3)
    rounded(d, (40, 404, 640, 448), 14, BROWN_SOLE)
    rounded(d, (40, 404, 150, 464), 8, BROWN_SOLE)
    return finish(img, w, h)


def boots():
    return pair(boot(660, 470), 820, 640, (130, 0), (0, 150))


def coat():
    w, h = 940, 1160
    img = canvas(w, h)
    d = ImageDraw.Draw(img)
    body = [
        (300, 60), (380, 40), (560, 40), (640, 60),
        (800, 150), (910, 820), (830, 846), (782, 820),
        (680, 380), (700, 1120), (470, 1136), (240, 1120), (260, 380),
        (158, 820), (110, 846), (30, 820), (140, 150),
    ]
    d.polygon(pts(body), fill=GREY)
    d.polygon(pts([(380, 40), (470, 460), (400, 300), (330, 150), (340, 70)]), fill=GREY_DARK)
    d.polygon(pts([(560, 40), (470, 460), (540, 300), (610, 150), (600, 70)]), fill=GREY_DARK)
    line(d, (470, 460), (470, 1130), GREY_SEAM, 3)
    for y in (560, 700, 840):
        dot(d, 440, y, 11, BUTTON)
        dot(d, 500, y, 11, BUTTON)
    for x0, x1 in ((300, 420), (520, 640)):
        line(d, (x0, 760), (x1, 760), GREY_SEAM, 4)
    d.polygon(pts([(30, 820), (110, 846), (158, 820), (150, 770), (40, 770)]), fill=GREY_DARK)
    d.polygon(pts([(910, 820), (830, 846), (782, 820), (790, 770), (900, 770)]), fill=GREY_DARK)
    line(d, (260, 380), (244, 260), GREY_SEAM, 3)
    line(d, (680, 380), (696, 260), GREY_SEAM, 3)
    return finish(img, w, h)


PIECES = (
    ("top-navy-sweater", sweater),
    ("top-blue-shirt", shirt),
    ("bottom-beige-trousers", trousers),
    ("bottom-denim-jeans", jeans),
    ("dress-green", dress),
    ("shoes-white-sneakers", sneakers),
    ("shoes-brown-boots", boots),
    ("outerwear-grey-coat", coat),
)


def main():
    root = Path(__file__).resolve().parent.parent
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "assets" / "demo"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, draw in PIECES:
        art = fit(trim(draw()))
        art.save(out_dir / f"{name}.webp", "WEBP", quality=88, method=6)
        print(name, art.width, art.height)


if __name__ == "__main__":
    main()
