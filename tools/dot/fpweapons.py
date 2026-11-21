#!/usr/bin/env python3
"""The weapons in the hand, seen from behind the shoulder (first person): one dot picture per weapon, 160 x 96 px, the muzzle or
the head toward the middle of the screen and the grip and the white-coat sleeve coming in from the lower right. Drawn with hard
polygons (no smoothing), a light top face and a dark side face, then a one-pixel ink outline. js/ext/weapon-art.js draws them
scaled up with crisp pixels, kicked up on a shot and swung on a strike, with the muzzle flash on top.

    python tools/dot/fpweapons.py   -> assets/fp/<id>.png and assets/fp/fp.json (muzzle points)
"""
import json
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'assets', 'fp')
W, H = 160, 96
K = {
    'ink': (12, 14, 18), 'gun': (40, 44, 50), 'gunM': (62, 68, 76), 'gunL': (104, 112, 122), 'gunH': (150, 160, 170),
    'steel': (120, 128, 136), 'steelL': (172, 182, 190), 'steelH': (220, 228, 232), 'steelD': (70, 76, 84),
    'wood': (112, 66, 34), 'woodL': (150, 94, 48), 'woodD': (74, 42, 22),
    'skin': (214, 164, 132), 'skinL': (234, 192, 160), 'skinD': (166, 118, 92),
    'coat': (226, 228, 220), 'coatD': (170, 172, 166), 'coatL': (246, 248, 242), 'cuff': (90, 110, 130),
    'yel': (222, 170, 40), 'yelL': (250, 210, 90), 'yelD': (150, 108, 20), 'red': (170, 36, 32), 'redL': (214, 70, 52), 'redD': (110, 22, 22),
    'lens': (70, 120, 160), 'lensL': (150, 200, 230), 'blood': (110, 20, 20),
}


def canvas():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def P(d, pts, c):
    d.polygon(pts, fill=K[c] + (255,))


def L(d, a, b, c, w=1):
    d.line([a, b], fill=K[c] + (255,), width=w)


def outline(im):
    px = im.load(); out = im.copy(); o = out.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if 0 <= X < W and 0 <= Y < H and px[X, Y][3]:
                    o[x, y] = K['ink'] + (255,); break
    return out


def sleeve(d, x0=104):
    # the white coat sleeve from the lower right, the blue scrub cuff at the wrist
    P(d, [(x0, 96), (160, 96), (160, 74), (x0 + 30, 70), (x0 + 6, 78)], 'coat')
    P(d, [(x0 + 4, 96), (x0 + 22, 96), (x0 + 14, 80), (x0 + 6, 82)], 'coatD')
    P(d, [(x0 + 26, 74), (160, 76), (160, 72), (x0 + 30, 70)], 'coatL')
    P(d, [(x0 + 4, 80), (x0 + 30, 72), (x0 + 32, 76), (x0 + 8, 84)], 'cuff')


def fist(d, x, y, w=24, h=20):
    # a hand round a grip: back of the hand, four knuckles, the thumb over the top
    P(d, [(x, y + 4), (x + w, y), (x + w + 2, y + h - 4), (x + 2, y + h)], 'skin')
    P(d, [(x, y + 4), (x + w, y), (x + w, y + 4), (x + 1, y + 8)], 'skinL')
    for i in range(4):
        L(d, (x + 3 + i * 5, y + h - 2), (x + 4 + i * 5, y + h - 7), 'skinD')
    P(d, [(x - 4, y + 2), (x + 8, y - 2), (x + 10, y + 3), (x - 2, y + 7)], 'skin')
    L(d, (x - 3, y + 6), (x + 9, y + 3), 'skinD')


def pistol():
    im, d = canvas()
    sleeve(d)
    P(d, [(100, 64), (118, 62), (124, 90), (104, 94)], 'gun')            # grip
    P(d, [(103, 66), (108, 66), (110, 90), (105, 92)], 'gunM')
    fist(d, 98, 64, 26, 24)
    P(d, [(90, 30), (104, 29), (122, 60), (96, 63)], 'gunM')             # slide, top face
    P(d, [(93, 31), (99, 31), (108, 60), (100, 61)], 'gunL')
    P(d, [(96, 63), (122, 60), (122, 68), (98, 71)], 'gun')              # slide, side face
    for i in range(4):
        L(d, (112 + i * 2, 60), (113 + i * 2, 67), 'gunM')               # serrations
    P(d, [(97, 58), (101, 58), (101, 62), (97, 62)], 'gunH')             # rear sights
    P(d, [(115, 56), (119, 56), (119, 60), (115, 60)], 'gunH')
    P(d, [(95, 27), (98, 27), (98, 31), (95, 31)], 'gunH')               # front sight
    P(d, [(92, 30), (102, 29), (102, 33), (92, 34)], 'ink')              # bore
    return outline(im), (97, 31)


def shotgun():
    im, d = canvas()
    P(d, [(112, 74), (134, 70), (160, 92), (160, 96), (120, 96)], 'wood')   # stock
    P(d, [(116, 76), (132, 72), (150, 90), (124, 92)], 'woodL')
    sleeve(d, 108)
    P(d, [(98, 54), (124, 50), (128, 74), (102, 78)], 'gun')              # receiver
    P(d, [(100, 56), (122, 52), (122, 56), (101, 60)], 'gunM')
    fist(d, 106, 68, 22, 20)
    P(d, [(74, 14), (84, 13), (112, 52), (100, 55)], 'steel')             # barrel
    P(d, [(76, 15), (80, 14), (104, 52), (100, 53)], 'steelL')
    P(d, [(72, 20), (80, 19), (102, 58), (94, 60)], 'steelD')             # magazine tube
    P(d, [(80, 30), (94, 28), (104, 48), (86, 52)], 'wood')               # pump
    for i in range(5):
        L(d, (83 + i * 3, 31 + i * 4), (95 + i * 2, 30 + i * 4), 'woodD')
    P(d, [(76, 34), (90, 30), (94, 40), (80, 46)], 'skin')                # the left hand on the pump
    P(d, [(76, 34), (90, 30), (90, 33), (77, 37)], 'skinL')
    P(d, [(75, 12), (82, 11), (82, 16), (75, 17)], 'ink')                 # bore
    return outline(im), (78, 14)


def rifle():
    im, d = canvas()
    P(d, [(114, 72), (136, 68), (160, 88), (160, 96), (122, 96)], 'wood')
    P(d, [(118, 74), (134, 70), (152, 86), (126, 90)], 'woodL')
    sleeve(d, 110)
    P(d, [(96, 50), (122, 46), (126, 72), (100, 76)], 'gun')
    fist(d, 108, 66, 22, 20)
    P(d, [(78, 8), (84, 8), (106, 48), (100, 50)], 'gun')                 # barrel
    P(d, [(79, 9), (81, 9), (102, 48), (100, 49)], 'gunL')
    P(d, [(82, 24), (96, 22), (108, 46), (92, 50)], 'wood')               # fore-end
    P(d, [(90, 30), (102, 28), (112, 48), (98, 51)], 'gunM')              # scope
    P(d, [(92, 30), (97, 29), (106, 47), (100, 48)], 'gunL')
    P(d, [(88, 26), (100, 24), (102, 31), (90, 33)], 'gun')               # scope front
    P(d, [(91, 27), (98, 26), (99, 30), (92, 31)], 'lens')
    P(d, [(93, 27), (95, 27), (95, 29), (93, 29)], 'lensL')
    P(d, [(78, 26), (90, 22), (94, 32), (82, 38)], 'skin')
    P(d, [(79, 6), (83, 6), (83, 10), (79, 10)], 'ink')
    return outline(im), (81, 8)


def nailgun():
    im, d = canvas()
    sleeve(d)
    P(d, [(104, 62), (120, 60), (126, 88), (108, 92)], 'gun')             # handle
    fist(d, 102, 64, 24, 22)
    P(d, [(84, 36), (116, 30), (126, 58), (92, 66)], 'yel')               # body
    P(d, [(86, 37), (114, 31), (116, 36), (88, 42)], 'yelL')
    P(d, [(92, 60), (126, 54), (126, 58), (92, 66)], 'yelD')
    P(d, [(76, 34), (88, 32), (92, 46), (80, 50)], 'gun')                 # nose
    P(d, [(78, 35), (86, 34), (87, 37), (79, 39)], 'gunL')
    P(d, [(86, 50), (96, 48), (90, 76), (82, 76)], 'steelD')              # nail strip
    for i in range(6):
        L(d, (85 + i, 54 + i * 4), (93 + i, 53 + i * 4), 'steelL')
    P(d, [(77, 36), (81, 35), (82, 40), (78, 41)], 'ink')
    return outline(im), (79, 37)


def pipe():
    im, d = canvas()
    sleeve(d)
    P(d, [(96, 6), (106, 4), (128, 84), (116, 88)], 'steel')
    P(d, [(98, 6), (101, 5), (121, 86), (118, 87)], 'steelL')
    P(d, [(104, 5), (106, 4), (128, 84), (126, 85)], 'steelD')
    P(d, [(95, 4), (107, 2), (108, 8), (96, 10)], 'steelD')               # the fitting at the end
    P(d, [(97, 3), (104, 2), (104, 4), (97, 5)], 'steelH')
    L(d, (100, 30), (108, 28), 'blood', 2)
    fist(d, 104, 60, 24, 22)
    return outline(im), None


def axe():
    im, d = canvas()
    sleeve(d)
    P(d, [(98, 14), (106, 12), (128, 84), (118, 88)], 'wood')
    P(d, [(100, 14), (103, 13), (122, 86), (119, 87)], 'woodL')
    P(d, [(84, 4), (112, 0), (114, 20), (88, 26)], 'red')                 # the head
    P(d, [(86, 5), (110, 1), (110, 5), (87, 9)], 'redL')
    P(d, [(88, 22), (114, 16), (114, 20), (88, 26)], 'redD')
    P(d, [(72, 4), (86, 2), (90, 28), (76, 32)], 'steel')                 # the blade
    P(d, [(72, 4), (76, 4), (79, 31), (76, 32)], 'steelH')
    L(d, (75, 14), (80, 22), 'blood', 2)
    fist(d, 104, 60, 24, 22)
    return outline(im), None


def scalpel():
    im, d = canvas()
    sleeve(d)
    P(d, [(104, 48), (110, 47), (120, 76), (114, 78)], 'steel')
    P(d, [(105, 48), (107, 48), (116, 77), (114, 78)], 'steelL')
    for i in range(5):
        L(d, (107 + i * 2, 56 + i * 4), (111 + i * 2, 55 + i * 4), 'steelD')
    P(d, [(100, 30), (104, 28), (110, 48), (104, 49)], 'steelH')          # the blade
    P(d, [(100, 30), (102, 29), (106, 48), (104, 49)], 'steelL')
    fist(d, 106, 64, 22, 20)
    return outline(im), None


def hands():
    im, d = canvas()
    sleeve(d, 100)
    fist(d, 104, 62, 26, 22)
    return outline(im), None


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for fn in (hands, scalpel, pipe, axe, nailgun, pistol, shotgun, rifle):
        im, muzzle = fn()
        im.save(os.path.join(OUT, f'{fn.__name__}.png'))
        meta[fn.__name__] = {'muzzle': list(muzzle) if muzzle else None}
    with open(os.path.join(OUT, 'fp.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'w': W, 'h': H, 'weapons': meta}, f, indent=1)
    print('fp weapons:', ', '.join(meta))


if __name__ == '__main__':
    main()
