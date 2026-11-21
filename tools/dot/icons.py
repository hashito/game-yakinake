#!/usr/bin/env python3
"""The pixel pictures of the things in the case (js/ext/case-data.js CATALOG): one PNG per item, 16 px per grid cell, drawn
lying the long way (the case turns them with the item). Shown in the case cells (image-rendering: pixelated) and listed in
pixel-items.json as the inventory picture.

    python tools/dot/icons.py      -> assets/icons/<id>.png
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'assets', 'icons')
C = 16
K = {  # the palette of js/dot/index.js YK_PALETTE (a few of its colours)
    'ink': (11, 16, 20), 'steel': (102, 128, 128), 'steelL': (180, 200, 194), 'steelD': (53, 73, 76), 'gun': (38, 54, 58), 'gunL': (74, 98, 100),
    'wood': (112, 73, 26), 'woodL': (160, 102, 30), 'red': (168, 34, 30), 'redL': (224, 74, 52), 'white': (221, 232, 226), 'cream': (246, 250, 246),
    'brass': (208, 138, 42), 'brassL': (240, 170, 72), 'blue': (70, 96, 154), 'blueL': (122, 150, 208), 'skin': (226, 173, 140), 'olive': (78, 106, 58),
    'grey': (118, 112, 106), 'greyL': (168, 162, 154), 'orange': (240, 170, 72), 'black': (5, 7, 10), 'yellow': (255, 216, 144),
}


def img(w, h):
    im = Image.new('RGBA', (w * C, h * C), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def R(d, x, y, w, h, c):
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=K[c])


def scalpel():
    im, d = img(2, 1)   # drawn the long way (the case shows 1x2 turned)
    R(d, 3, 7, 14, 3, 'steelD'); R(d, 3, 7, 14, 1, 'steelL'); R(d, 17, 6, 9, 4, 'steelL'); R(d, 17, 6, 9, 1, 'cream'); R(d, 26, 7, 3, 2, 'steelL')
    return im


def pipe():
    im, d = img(4, 1)
    R(d, 2, 5, 60, 6, 'steel'); R(d, 2, 5, 60, 2, 'steelL'); R(d, 2, 10, 60, 1, 'steelD'); R(d, 2, 4, 5, 8, 'steelD'); R(d, 57, 4, 5, 8, 'steelD')
    return im


def axe():
    im, d = img(4, 2)
    R(d, 4, 14, 52, 5, 'wood'); R(d, 4, 14, 52, 1, 'woodL')
    R(d, 44, 4, 12, 26, 'red'); R(d, 44, 4, 12, 3, 'redL'); R(d, 56, 6, 6, 22, 'steelL'); R(d, 56, 6, 2, 22, 'cream')
    return im


def nailgun():
    im, d = img(2, 2)
    R(d, 3, 6, 24, 10, 'orange'); R(d, 3, 6, 24, 2, 'yellow'); R(d, 6, 16, 8, 12, 'gun'); R(d, 6, 16, 2, 12, 'gunL'); R(d, 25, 8, 5, 6, 'steelD'); R(d, 16, 16, 8, 4, 'steel')
    return im


def pistol():
    im, d = img(2, 1)
    R(d, 4, 3, 24, 5, 'gun'); R(d, 4, 3, 24, 1, 'gunL'); R(d, 6, 8, 6, 7, 'gun'); R(d, 7, 8, 1, 7, 'gunL'); R(d, 13, 8, 4, 3, 'gunL'); R(d, 26, 4, 3, 2, 'ink')
    return im


def shotgun():
    im, d = img(4, 1)
    R(d, 2, 7, 18, 6, 'wood'); R(d, 2, 7, 18, 1, 'woodL'); R(d, 20, 5, 12, 5, 'gun'); R(d, 32, 5, 30, 3, 'gun'); R(d, 32, 5, 30, 1, 'gunL'); R(d, 34, 9, 14, 3, 'wood')
    return im


def rifle():
    im, d = img(5, 2)
    R(d, 3, 14, 22, 9, 'wood'); R(d, 3, 14, 22, 2, 'woodL'); R(d, 3, 20, 6, 6, 'wood'); R(d, 25, 13, 16, 6, 'gun'); R(d, 41, 14, 37, 3, 'gun'); R(d, 41, 14, 37, 1, 'gunL')
    R(d, 30, 8, 16, 4, 'ink'); R(d, 30, 8, 16, 1, 'gunL'); R(d, 46, 18, 20, 4, 'wood')
    return im


def box(c1, c2, label):
    im, d = img(1, 1)
    R(d, 2, 4, 12, 10, c1); R(d, 2, 4, 12, 2, c2); R(d, 4, 8, 8, 3, label)
    return im


def nails():
    im, d = img(1, 1)
    for i, x in enumerate((3, 6, 9, 12)):
        R(d, x, 3 + (i % 2), 1, 10, 'steelL'); R(d, x - 1, 3 + (i % 2), 3, 1, 'steel')
    return im


def shells():
    im, d = img(1, 1)
    for x in (2, 6, 10):
        R(d, x, 4, 3, 8, 'red'); R(d, x, 4, 3, 1, 'redL'); R(d, x, 12, 3, 2, 'brass')
    return im


def rifle_ammo():
    im, d = img(1, 1)
    for x in (3, 7, 11):
        R(d, x, 2, 2, 10, 'brass'); R(d, x, 2, 1, 10, 'brassL'); R(d, x, 1, 2, 2, 'steelD')
    return im


def p9():
    im, d = img(1, 1)
    R(d, 2, 5, 12, 9, 'olive'); R(d, 2, 5, 12, 2, (78, 106, 58) and 'greyL'); R(d, 4, 2, 2, 4, 'brass'); R(d, 7, 2, 2, 4, 'brass'); R(d, 10, 2, 2, 4, 'brass')
    return im


def bandage():
    im, d = img(1, 1)
    R(d, 3, 4, 10, 9, 'white'); R(d, 3, 4, 10, 2, 'cream'); R(d, 5, 6, 6, 1, 'greyL'); R(d, 5, 9, 6, 1, 'greyL')
    return im


def disinfect():
    im, d = img(1, 1)
    R(d, 5, 1, 6, 3, 'blue'); R(d, 4, 4, 8, 11, 'blueL'); R(d, 4, 4, 2, 11, 'cream'); R(d, 6, 8, 4, 3, 'white')
    return im


def aidkit():
    im, d = img(2, 1)
    R(d, 3, 3, 26, 11, 'white'); R(d, 3, 3, 26, 2, 'cream'); R(d, 14, 5, 4, 7, 'red'); R(d, 12, 7, 8, 3, 'red')
    return im


def medkit():
    im, d = img(2, 2)
    R(d, 3, 6, 26, 22, 'red'); R(d, 3, 6, 26, 3, 'redL'); R(d, 12, 2, 8, 4, 'gun'); R(d, 13, 10, 6, 14, 'white'); R(d, 9, 14, 14, 6, 'white')
    return im


def canned():
    im, d = img(1, 1)
    R(d, 3, 4, 10, 10, 'steel'); R(d, 3, 4, 10, 2, 'steelL'); R(d, 3, 7, 10, 4, 'redL'); R(d, 5, 8, 6, 2, 'cream')
    return im


def water():
    im, d = img(2, 1)
    R(d, 3, 4, 22, 8, 'blueL'); R(d, 3, 4, 22, 2, 'cream'); R(d, 25, 6, 3, 4, 'blue'); R(d, 9, 6, 8, 4, 'white')
    return im


def powder():
    im, d = img(1, 1)
    R(d, 3, 3, 10, 11, 'grey'); R(d, 3, 3, 10, 2, 'greyL'); R(d, 5, 7, 6, 4, 'ink'); R(d, 7, 8, 2, 2, 'redL')
    return im


def casing():
    im, d = img(1, 1)
    for x in (3, 9):
        R(d, x, 5, 4, 8, 'redL'); R(d, x, 5, 4, 1, 'cream'); R(d, x, 12, 4, 2, 'brass')
    return im


def big(draw):
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im); draw(d); return im


def key(c, tag):
    def f(d):
        R(d, 4, 10, 10, 10, c); R(d, 7, 13, 4, 4, 'black'); R(d, 14, 14, 14, 3, c); R(d, 22, 17, 2, 4, c); R(d, 26, 17, 2, 3, c); R(d, 4, 22, 8, 6, tag); R(d, 4, 22, 8, 1, 'cream')
    return lambda: big(f)


STORY = {
    'PENLIGHT': lambda: big(lambda d: (R(d, 4, 14, 20, 4, 'steel'), R(d, 4, 14, 20, 1, 'steelL'), R(d, 24, 13, 4, 6, 'steelL'), R(d, 28, 14, 3, 4, 'yellow'), R(d, 8, 12, 2, 2, 'steelD'))),
    'STETHO': lambda: big(lambda d: (R(d, 6, 4, 2, 14, 'ink'), R(d, 20, 4, 2, 14, 'ink'), R(d, 8, 18, 12, 2, 'ink'), R(d, 13, 20, 2, 6, 'ink'), R(d, 10, 25, 9, 5, 'steelL'), R(d, 11, 26, 7, 3, 'steel'))),
    'PHS': lambda: big(lambda d: (R(d, 10, 3, 12, 26, 'greyL'), R(d, 12, 6, 8, 8, 'blue'), R(d, 13, 7, 6, 2, 'blueL'), *[R(d, 12 + (i % 3) * 3, 17 + (i // 3) * 3, 2, 2, 'gun') for i in range(9)])),
    'KEYCARD': lambda: big(lambda d: (R(d, 3, 8, 26, 17, 'white'), R(d, 3, 8, 26, 4, 'blue'), R(d, 6, 15, 7, 8, 'skin'), R(d, 15, 16, 11, 2, 'grey'), R(d, 15, 20, 8, 2, 'grey'))),
    'KEYRING': lambda: big(lambda d: (d.ellipse([4, 4, 16, 16], outline=K['steelL'], width=2), R(d, 12, 14, 3, 14, 'brass'), R(d, 15, 24, 3, 2, 'brass'), R(d, 18, 12, 3, 14, 'steel'), R(d, 21, 22, 3, 2, 'steel'), R(d, 8, 15, 3, 13, 'brassL'))),
    'INSULIN': lambda: big(lambda d: (R(d, 10, 4, 12, 4, 'steelD'), R(d, 9, 8, 14, 20, 'cream'), R(d, 9, 13, 14, 8, 'orange'), R(d, 12, 15, 8, 4, 'white'))),
    'ANTIBIO': lambda: big(lambda d: (R(d, 4, 9, 24, 15, 'white'), R(d, 4, 9, 24, 3, 'blueL'), *[d.ellipse([7 + i * 6, 15, 11 + i * 6, 19], fill=K['redL']) for i in range(4)])),
    'FIREKEY': key('steelL', 'red'), 'LIFTKEY': key('steelL', 'blue'), 'ROOFKEY': key('brassL', 'olive'),
}

ICONS = {'scalpel': scalpel, 'pipe': pipe, 'axe': axe, 'nailgun': nailgun, 'pistol': pistol, 'shotgun': shotgun, 'rifle': rifle, 'nails': nails,
         'p9': p9, 'shell': shells, 'rifleAmmo': rifle_ammo, 'bandage': bandage, 'disinfect': disinfect, 'aidkit': aidkit, 'medkit': medkit,
         'canned': canned, 'water': water, 'powder': powder, 'casing': casing}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for k, f in ICONS.items():
        f().save(os.path.join(OUT, f'{k}.png'), optimize=True)
    for k, f in STORY.items():
        f().save(os.path.join(OUT, f'{k}.png'), optimize=True)
    print(len(ICONS) + len(STORY), 'icons ->', OUT)
