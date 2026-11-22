#!/usr/bin/env python3
"""The hands and the weapons in first person, fine dot (1.2.0, play test #7 「手や武器のドット絵をもっと細かく」): 320 x 192 px a
picture, twice the old 160 x 96, so a finger is 6-9 px wide and a knuckle, a nail, a crease and the cuff's seam can be drawn.

Seen from just behind the right shoulder: the white coat sleeve and the blue scrub cuff come in from the lower right, the right hand
holds the weapon the way that weapon is held (a pistol grip with the index on the trigger and the thumb along the frame, a pipe or an
axe handle in a full fist, a scalpel in a pencil grip between thumb and index, a long gun's pistol grip with the left hand forward on
the pump / fore-end), the muzzle or the head toward the middle of the screen. The flashlight is its own picture (the left hand,
lower left of the same canvas), drawn when the light is on.

Every shape is a hard polygon or a round-capped stroke (no smoothing) in a ramp of 4-5 tones (light from the upper left), then a
one-pixel ink outline. js/ext/weapon-art.js draws them with crisp pixels and moves them (sway, recoil, reload, strike).
The same pictures are the kit's common parts yakinake-fp-<id>.png (assets/fp-weapons in the game kit).

    python tools/dot/fpweapons.py [outDir]   -> <outDir or assets/fp>/<id>.png, fp.json (muzzle points, grip point)
"""
import json
import math
import os
import sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(HERE)), 'assets', 'fp')
W, H = 320, 192
K = {
    'ink': (10, 11, 14),
    # skin: 5 tones
    'sk0': (122, 78, 60), 'sk1': (168, 116, 90), 'sk2': (206, 152, 122), 'sk3': (228, 180, 148), 'sk4': (244, 208, 180), 'nail': (236, 196, 184), 'nailL': (252, 232, 222),
    # the white coat and the scrub cuff
    'co0': (128, 132, 128), 'co1': (176, 180, 174), 'co2': (214, 216, 210), 'co3': (236, 238, 232), 'co4': (250, 251, 248),
    'cu0': (32, 58, 78), 'cu1': (52, 88, 112), 'cu2': (78, 120, 146), 'cu3': (112, 156, 180),
    # black gun metal, steel, wood, plastic
    'g0': (18, 20, 24), 'g1': (34, 37, 43), 'g2': (54, 59, 67), 'g3': (84, 91, 101), 'g4': (128, 138, 150),
    's0': (60, 66, 74), 's1': (98, 106, 116), 's2': (142, 150, 160), 's3': (186, 194, 202), 's4': (230, 236, 240),
    'w0': (62, 34, 18), 'w1': (98, 56, 28), 'w2': (134, 80, 40), 'w3': (170, 108, 56), 'w4': (198, 140, 80),
    'y0': (120, 84, 14), 'y1': (176, 128, 24), 'y2': (222, 170, 40), 'y3': (246, 204, 80), 'y4': (255, 232, 150),
    'r0': (90, 18, 18), 'r1': (140, 30, 28), 'r2': (182, 46, 38), 'r3': (214, 78, 58),
    'rb0': (24, 24, 26), 'rb1': (44, 44, 48), 'rb2': (66, 66, 72),
    'blood': (104, 18, 18), 'bloodL': (146, 30, 26),
    'lens': (255, 246, 200), 'lensD': (220, 196, 120), 'bulb': (255, 255, 236),
    'brass': (170, 130, 50), 'brassL': (220, 182, 90), 'shell': (150, 30, 30), 'shellL': (196, 60, 50),
}


def canvas():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def P(d, pts, c):
    d.polygon([(round(x), round(y)) for x, y in pts], fill=K[c] + (255,))


def Ln(d, a, b, c, w=1):
    d.line([tuple(map(round, a)), tuple(map(round, b))], fill=K[c] + (255,), width=w)


def disc(d, x, y, r, c):
    d.ellipse([round(x - r), round(y - r), round(x + r), round(y + r)], fill=K[c] + (255,))


def stroke(d, a, b, w, c):
    """a round-capped thick stroke (a finger, a barrel)"""
    Ln(d, a, b, c, int(w))
    disc(d, a[0], a[1], w / 2 - 0.5, c)
    disc(d, b[0], b[1], w / 2 - 0.5, c)


def nrm(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1
    return -dy / L, dx / L


def quad(a, b, w0, w1=None):
    """the four corners of a band from a to b, w0 wide at a and w1 at b"""
    w1 = w0 if w1 is None else w1
    nx, ny = nrm(a, b)
    return [(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2), (b[0] + nx * w1 / 2, b[1] + ny * w1 / 2),
            (b[0] - nx * w1 / 2, b[1] - ny * w1 / 2), (a[0] - nx * w0 / 2, a[1] - ny * w0 / 2)]


def tube(d, a, b, w, ramp, w1=None, cap=True):
    """a lit cylinder from a to b: dark side, body, light, highlight stripe (ramp: 4 colour keys, dark to light)"""
    w1 = w if w1 is None else w1
    P(d, quad(a, b, w, w1), ramp[1])
    nx, ny = nrm(a, b)
    # the side away from the light (light from the upper left: the normal with negative x+y is lit)
    s = 1 if (nx + ny) > 0 else -1
    off0, off1 = w * 0.3 * s, w1 * 0.3 * s
    P(d, quad((a[0] + nx * off0, a[1] + ny * off0), (b[0] + nx * off1, b[1] + ny * off1), w * 0.4, w1 * 0.4), ramp[0])
    P(d, quad((a[0] - nx * off0 * 0.8, a[1] - ny * off0 * 0.8), (b[0] - nx * off1 * 0.8, b[1] - ny * off1 * 0.8), w * 0.3, w1 * 0.3), ramp[2])
    Ln(d, (a[0] - nx * off0 * 1.15, a[1] - ny * off0 * 1.15), (b[0] - nx * off1 * 1.15, b[1] - ny * off1 * 1.15), ramp[3])
    if cap:
        disc(d, b[0], b[1], w1 / 2 - 0.5, ramp[1])


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


def layer():
    return canvas()


def paste(base, top):
    base.alpha_composite(outline(top))


# ---------------------------------------------------------------- the arm
def sleeve(im, wrist=(236, 160), elbow=(330, 186), w=58):
    """the white coat sleeve from the lower right to the wrist, folds, the blue scrub cuff peeking out"""
    L, d = layer()
    ax, ay = wrist; bx, by = elbow
    # the scrub cuff (rib knit) just above the wrist
    P(d, quad((ax + 2, ay + 4), (ax + 22, ay + 12), w * 0.74, w * 0.8), 'cu1')
    for i in range(7):
        t = i / 6
        p0 = (ax - 8 + t * 4 + 0, ay - 14 + t * 30)
        Ln(d, p0, (p0[0] + 14, p0[1] + 6), 'cu0')
    P(d, quad((ax + 2, ay + 2), (ax + 8, ay + 5), w * 0.7, w * 0.72), 'cu2')
    Ln(d, (ax - 10, ay - 16), (ax + 10, ay - 8), 'cu3')
    # the coat
    P(d, quad((ax + 16, ay + 10), (bx, by), w, w * 1.25), 'co2')
    nx, ny = nrm((ax + 16, ay + 10), (bx, by))
    P(d, quad((ax + 16 - nx * w * 0.3, ay + 10 - ny * w * 0.3), (bx - nx * w * 0.38, by - ny * w * 0.38), w * 0.34, w * 0.42), 'co3')
    P(d, quad((ax + 16 + nx * w * 0.34, ay + 10 + ny * w * 0.34), (bx + nx * w * 0.42, by + ny * w * 0.42), w * 0.3, w * 0.4), 'co1')
    Ln(d, (ax + 16 - nx * w * 0.44, ay + 10 - ny * w * 0.44), (bx - nx * w * 0.56, by - ny * w * 0.56), 'co4', 2)
    # the cuff's hem: a turned edge, its stitch line, and two folds
    hem = quad((ax + 14, ay + 9), (ax + 22, ay + 13), w * 1.02, w * 1.04)
    P(d, hem, 'co3')
    Ln(d, ((hem[0][0] + hem[1][0]) / 2, (hem[0][1] + hem[1][1]) / 2), ((hem[2][0] + hem[3][0]) / 2, (hem[2][1] + hem[3][1]) / 2), 'co1')
    for t, c in ((0.42, 'co1'), (0.62, 'co0'), (0.8, 'co1')):
        px, py = ax + 16 + (bx - ax - 16) * t, ay + 10 + (by - ay - 10) * t
        Ln(d, (px - nx * w * 0.2, py - ny * w * 0.2), (px + nx * w * 0.36 + 6, py + ny * w * 0.36 - 2), c)
    paste(im, L)


# ---------------------------------------------------------------- hands
def finger(d, a, b, w, nail=False, tip=None):
    """one finger: two phalanges with a crease, lit from the top left; tip: where it ends if it bends"""
    tube(d, a, b, w, ('sk1', 'sk2', 'sk3', 'sk4'))
    if tip:
        tube(d, b, tip, w * 0.92, ('sk1', 'sk2', 'sk3', 'sk4'))
        nx, ny = nrm(a, b)
        Ln(d, (b[0] - nx * w * 0.42, b[1] - ny * w * 0.42), (b[0] + nx * w * 0.42, b[1] + ny * w * 0.42), 'sk1')
    end = tip or b
    if nail:
        st = b if tip else a
        dx, dy = end[0] - st[0], end[1] - st[1]; L = math.hypot(dx, dy) or 1
        ux, uy = dx / L, dy / L
        c = (end[0] - ux * w * 0.55, end[1] - uy * w * 0.55)
        P(d, quad((c[0] - ux * w * 0.4, c[1] - uy * w * 0.4), (c[0] + ux * w * 0.35, c[1] + uy * w * 0.35), w * 0.62), 'nail')
        Ln(d, (c[0] - ux * w * 0.3 - uy * 1, c[1] - uy * w * 0.3 + ux * 1), (c[0] + ux * w * 0.2 - uy * 1, c[1] + uy * w * 0.2 + ux * 1), 'nailL')


def knuckles(d, pts, r=4):
    for x, y in pts:
        disc(d, x, y, r, 'sk3')
        disc(d, x - 1, y - 1, max(1, r - 2), 'sk4')
        Ln(d, (x - r + 1, y + r - 1), (x + r - 1, y + r - 1), 'sk1')


def back_of_hand(d, pts):
    """the back of the hand: a rounded plate, lit on the upper left, shaded toward the little finger and the wrist, tendons
    fanning from the wrist (the last point) to the knuckle row (the first two points)"""
    n = len(pts)
    cx, cy = sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n
    soft = []
    for k in range(n):                                   # cut the corners: a plate with rounded edges
        a, b = pts[k], pts[(k + 1) % n]
        soft += [(a[0] * 0.8 + b[0] * 0.2, a[1] * 0.8 + b[1] * 0.2), (a[0] * 0.2 + b[0] * 0.8, a[1] * 0.2 + b[1] * 0.8)]
    P(d, soft, 'sk2')
    P(d, [(p[0] * 0.62 + cx * 0.38 + 4, p[1] * 0.62 + cy * 0.38 + 4) for p in soft[2:7]], 'sk1')        # the shaded side
    P(d, [(p[0] * 0.6 + cx * 0.4 - 3, p[1] * 0.6 + cy * 0.4 - 3) for p in soft[-3:] + soft[:3]], 'sk3')  # the lit side
    w = pts[-1]
    a, b = pts[0], pts[1]
    for t in (0.25, 0.5, 0.75):                            # tendons
        k = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        Ln(d, ((k[0] * 0.75 + w[0] * 0.25), (k[1] * 0.75 + w[1] * 0.25)), ((k[0] * 0.3 + w[0] * 0.7), (k[1] * 0.3 + w[1] * 0.7)), 'sk3')


def grip_hand(im, gx, gy, ang=-0.32, gw=26, gh=58, trigger=True, thumb='side', fingers=4, fw=10):
    """the right hand round a grip whose axis runs from (gx, gy) down at `ang` (radians from vertical, + = leaning right):
    the fingers wrap the front (left) of the grip and show as four stacked rounded segments with creases, the back of the hand and
    the knuckles on the right, the thumb along the left side of the frame (side) or over the top (over), the index on the trigger"""
    L, d = layer()
    ux, uy = math.sin(ang), math.cos(ang)          # down the grip
    rx, ry = uy, -ux                               # to the right of the grip
    def at(t, s):                                  # t down the grip, s to the right (px)
        return (gx + ux * t + rx * s, gy + uy * t + ry * s)
    # the palm and the back of the hand, behind the grip on the right
    back_of_hand(d, [at(2, gw * 0.2), at(-2, gw * 0.2 + 30), at(gh * 0.9, gw * 0.2 + 40), at(gh + 6, gw * 0.3 + 10), at(gh * 0.9, gw * 0.1)])
    # the wrist into the cuff
    P(d, [at(gh * 0.55, gw * 0.4 + 30), at(gh * 0.75, gw * 0.4 + 46), at(gh + 26, gw * 0.4 + 40), at(gh + 18, gw * 0.3 + 16)], 'sk2')
    P(d, [at(gh * 0.6, gw * 0.4 + 34), at(gh * 0.75, gw * 0.4 + 44), at(gh + 20, gw * 0.4 + 36)], 'sk1')
    # the fingers round the front of the grip (from the trigger guard down): each a segment from the back of the hand,
    # round the front, the tips tucked; drawn bottom up so the upper one overlaps
    n = fingers
    top = 10 if trigger else 2
    span = (gh - top - 4) / n
    for i in reversed(range(n)):
        t = top + span * (i + 0.5)
        w = fw - (1.5 if i == n - 1 else 0)
        a = at(t - 1, gw * 0.15 + 6)
        b = at(t + 1, -gw * 0.5 - w * 0.3)
        tip = at(t + 3, -gw * 0.5 + w * 0.2)
        finger(d, a, b, w, nail=False, tip=tip)
        # the crease between this finger and the next
        Ln(d, at(t + span * 0.5, gw * 0.1), at(t + span * 0.5, -gw * 0.5 - w * 0.2), 'sk0')
    # the knuckles on the back
    knuckles(d, [at(top + span * (i + 0.4), gw * 0.15 + 9) for i in range(n)], 4)
    # the index finger on the trigger, bent
    if trigger:
        a = at(top - 4, gw * 0.1 + 6)
        b = at(top - 6, -gw * 0.4)
        tip = at(top - 2, -gw * 0.62)
        finger(d, a, b, fw - 1, nail=True, tip=tip)
        knuckles(d, [at(top - 6, gw * 0.15 + 8)], 4)
    # the thumb: along the left of the frame toward the muzzle, nail toward us
    if thumb == 'side':
        a = at(top - 10, gw * 0.35 + 6)
        b = at(top - 24, gw * 0.05)
        tip = at(top - 36, -gw * 0.18)
        finger(d, a, b, fw + 1, nail=True, tip=tip)
    elif thumb == 'over':
        a = at(top - 2, gw * 0.4 + 8)
        b = at(top - 10, -gw * 0.1)
        tip = at(top - 6, -gw * 0.55)
        finger(d, a, b, fw + 1, nail=True, tip=tip)
    paste(im, L)


def support_hand(im, x, y, ang, w=14, n=4, under=True):
    """the left hand from the left, cupping a fore-end / pump: four finger tips curling over the top edge, the thumb along it"""
    L, d = layer()
    ux, uy = math.cos(ang), math.sin(ang)       # along the barrel (toward the muzzle)
    rx, ry = uy, -ux                            # down (to the lower left)
    def at(t, s):
        return (x + ux * t + rx * s, y + uy * t + ry * s)
    # the palm under the fore-end
    P(d, [at(-18, 4), at(22, 2), at(26, 22), at(-10, 30)], 'sk2')
    P(d, [at(-16, 6), at(18, 4), at(20, 10), at(-12, 12)], 'sk3')
    # the wrist off to the lower left
    P(d, [at(-10, 22), at(14, 22), at(0, 60), at(-30, 56)], 'sk1')
    P(d, [at(-8, 24), at(6, 24), at(-8, 54), at(-24, 50)], 'sk2')
    # the fingers wrapping over the far side (tips visible over the top edge)
    for i in range(n):
        t = -12 + i * (w * 0.75)
        finger(d, at(t, 10), at(t + 2, -6), w * 0.62, nail=True, tip=at(t + 4, -12))
    # the thumb along the near side
    finger(d, at(-14, 14), at(6, 12), w * 0.72, nail=True, tip=at(18, 10))
    paste(im, L)
    # the cuff and the sleeve of the left arm, off the bottom left
    L2, d2 = layer()
    wx, wy = at(-14, 58)
    P(d2, quad((wx, wy), (wx - 30, wy + 50), 30, 40), 'cu1')
    Ln(d2, (wx - 12, wy - 4), (wx + 14, wy + 4), 'cu3')
    P(d2, quad((wx - 10, wy + 16), (wx - 50, wy + 80), 44, 60), 'co2')
    Ln(d2, (wx - 30, wy + 10), (wx - 66, wy + 70), 'co4', 2)
    Ln(d2, (wx + 4, wy + 22), (wx - 30, wy + 82), 'co1', 2)
    paste(im, L2)


# ---------------------------------------------------------------- the weapons
def pistol():
    im, _ = canvas()
    sleeve(im, (240, 168), (330, 196), 56)
    G, d = layer()
    # the frame and the grip (polymer, black), leaning right
    P(d, [(196, 100), (226, 96), (246, 172), (214, 178)], 'g1')
    P(d, [(200, 102), (210, 101), (226, 172), (216, 174)], 'g2')
    for i in range(6):                                                  # the grip's texture
        Ln(d, (214 + i * 2, 118 + i * 9), (230 + i * 2, 116 + i * 9), 'g0')
    # the trigger guard
    d.arc([184, 96, 216, 132], 100, 260, fill=K['g1'] + (255,), width=5)
    P(d, [(198, 106), (203, 105), (206, 118), (200, 119)], 'g0')     # the trigger
    # the slide: long, toward the middle, top face lit, side face dark, the serrations at the back
    P(d, [(170, 52), (196, 48), (232, 98), (194, 104)], 'g3')          # top face
    P(d, [(176, 52), (186, 50), (214, 98), (204, 100)], 'g4')
    P(d, [(194, 104), (232, 98), (234, 112), (194, 118)], 'g1')        # side face
    Ln(d, (196, 108), (232, 103), 'g2')
    for i in range(6):
        Ln(d, (216 + i * 3, 100), (218 + i * 3, 112), 'g0')           # the serrations
    P(d, [(166, 50), (198, 45), (200, 54), (168, 58)], 'g2')           # the muzzle end
    P(d, [(176, 49), (186, 48), (186, 54), (176, 55)], 'g0')           # the bore
    disc(d, 181, 51, 2, 'ink')
    P(d, [(182, 42), (188, 42), (188, 48), (182, 48)], 'g4')           # the front sight, with its white dot
    disc(d, 185, 44, 1, 's4')
    P(d, [(216, 88), (230, 86), (230, 94), (216, 96)], 'g3')           # the rear sight, two dots
    disc(d, 219, 90, 1, 's4'); disc(d, 227, 89, 1, 's4')
    P(d, [(232, 98), (242, 100), (240, 112), (234, 112)], 'g2')        # the hammer
    paste(im, G)
    grip_hand(im, 214, 116, ang=-0.34, gw=28, gh=58, trigger=True, thumb=None, fw=11)
    T, d = layer()                                                      # the thumb along the left of the frame, toward the muzzle
    finger(d, (232, 116), (210, 102), 12, nail=True, tip=(198, 88))
    paste(im, T)
    return im, (181, 51)


def nailgun():
    im, _ = canvas()
    sleeve(im, (240, 166), (330, 196), 56)
    G, d = layer()
    # the body (yellow) with the motor housing, the nose and the nail magazine
    P(d, [(160, 62), (232, 50), (250, 112), (176, 126)], 'y2')
    P(d, [(166, 64), (228, 53), (232, 66), (170, 78)], 'y3')
    P(d, [(168, 66), (196, 61), (198, 66), (170, 71)], 'y4')
    P(d, [(176, 116), (250, 104), (250, 112), (176, 126)], 'y1')
    P(d, [(212, 58), (240, 54), (248, 82), (220, 86)], 'rb1')         # the rubber cap of the motor
    Ln(d, (216, 64), (242, 60), 'rb2')
    for i in range(4):
        Ln(d, (176 + i * 12, 92 - i * 2), (178 + i * 12, 104 - i * 2), 'y0')   # vents
    P(d, [(140, 64), (166, 60), (172, 96), (146, 102)], 'g1')          # the nose
    P(d, [(144, 66), (162, 63), (164, 70), (146, 73)], 'g3')
    P(d, [(132, 72), (146, 70), (148, 92), (134, 94)], 's2')           # the safety tip
    Ln(d, (134, 74), (144, 72), 's4')
    disc(d, 140, 82, 3, 'ink')
    P(d, [(166, 116), (188, 112), (176, 176), (156, 178)], 's0')       # the strip of nails
    for i in range(9):
        Ln(d, (164 - i * 0.6, 120 + i * 6), (186 - i * 1.3, 116 + i * 6), 's3')
    d.text((190, 80), 'NAIL', fill=K['y0'] + (255,))
    paste(im, G)
    H2, d2 = layer()                                                    # the handle under the body
    P(d2, [(206, 108), (230, 104), (248, 170), (220, 176)], 'rb1')
    P(d2, [(210, 110), (218, 108), (232, 170), (224, 172)], 'rb2')
    paste(im, H2)
    grip_hand(im, 222, 118, ang=-0.3, gw=26, gh=54, trigger=True, thumb='over', fw=11)
    return im, (140, 82)


def shotgun():
    im, _ = canvas()
    G, d = layer()
    # the stock to the lower right, wood
    P(d, [(222, 140), (270, 130), (320, 176), (320, 192), (238, 192)], 'w2')
    P(d, [(230, 142), (266, 134), (310, 174), (246, 182)], 'w3')
    Ln(d, (240, 150), (300, 176), 'w4')
    # the receiver
    P(d, [(184, 104), (236, 96), (248, 146), (196, 154)], 'g1')
    P(d, [(188, 106), (232, 98), (234, 108), (190, 116)], 'g3')
    P(d, [(204, 120), (226, 117), (228, 134), (206, 137)], 'g0')       # the ejection port
    # the barrel and the magazine tube, long toward the middle
    tube(d, (204, 104), (146, 24), 14, ('s0', 's1', 's2', 's4'), 12)
    tube(d, (196, 124), (140, 44), 12, ('g0', 'g1', 'g2', 'g3'), 10)
    P(d, [(138, 18), (154, 16), (156, 28), (140, 30)], 's1')           # the muzzle
    disc(d, 147, 23, 4, 'ink')
    disc(d, 148, 17, 2, 's4')                                          # the bead sight
    # the pump: ribbed wood round the tube
    P(d, [(150, 54), (180, 46), (196, 92), (166, 100)], 'w2')
    P(d, [(154, 56), (166, 52), (182, 94), (172, 97)], 'w3')
    for i in range(7):
        Ln(d, (156 + i * 3.6, 60 + i * 5.6), (182 + i * 2, 52 + i * 6), 'w0')
    paste(im, G)
    support_hand(im, 168, 72, math.atan2(-56, -40), w=13)
    sleeve(im, (262, 176), (330, 200), 54)
    grip_hand(im, 236, 146, ang=-0.5, gw=24, gh=40, trigger=True, thumb='over', fingers=3, fw=11)
    return im, (147, 23)


def rifle():
    im, _ = canvas()
    G, d = layer()
    P(d, [(226, 140), (272, 128), (320, 170), (320, 192), (240, 192)], 'w1')   # the stock
    P(d, [(234, 142), (268, 132), (312, 170), (248, 182)], 'w2')
    Ln(d, (244, 152), (302, 172), 'w3')
    P(d, [(190, 100), (240, 92), (250, 144), (200, 150)], 'g1')        # the action
    P(d, [(194, 102), (236, 95), (238, 104), (196, 110)], 'g3')
    tube(d, (226, 120), (250, 118), 6, ('s0', 's1', 's2', 's4'))      # the bolt handle
    disc(d, 252, 118, 5, 's2'); disc(d, 251, 116, 2, 's4')
    tube(d, (200, 104), (152, 10), 10, ('g0', 'g1', 'g2', 'g3'), 8)  # the barrel, long and thin
    P(d, [(150, 6), (160, 5), (161, 12), (151, 13)], 'g2')
    disc(d, 155, 9, 3, 'ink')
    P(d, [(160, 40), (186, 34), (206, 100), (178, 106)], 'w2')        # the fore-end
    P(d, [(164, 42), (174, 40), (192, 100), (184, 102)], 'w3')
    # the scope on its rings
    tube(d, (214, 92), (176, 26), 18, ('g0', 'g1', 'g2', 'g4'), 16)
    P(d, [(168, 14), (188, 10), (192, 26), (172, 30)], 'g2')          # the objective bell, seen from behind (no lens toward us)
    Ln(d, (170, 15), (187, 11), 'g4')
    for t in (0.35, 0.7):                                              # the rings on the receiver
        x, y = 214 + (176 - 214) * t, 92 + (26 - 92) * t
        P(d, quad((x + 10, y - 2), (x - 10, y + 2), 5), 'g0')
    P(d, [(206, 84), (228, 80), (232, 100), (210, 104)], 'g1')        # the eyepiece, its glass dark blue toward the eye
    disc(d, 219, 92, 7, 'g0'); disc(d, 219, 92, 5, 'cu0'); disc(d, 217, 90, 1, 'cu3')
    paste(im, G)
    support_hand(im, 184, 84, math.atan2(-60, -26), w=12)
    sleeve(im, (264, 176), (330, 200), 54)
    grip_hand(im, 238, 140, ang=-0.5, gw=24, gh=40, trigger=True, thumb='over', fingers=3, fw=11)
    return im, (155, 9)


def pipe():
    """a crowbar: a black steel bar, the hooked claw at the top end, a full fist round the lower end"""
    im, _ = canvas()
    sleeve(im, (244, 170), (330, 196), 56)
    G, d = layer()
    tube(d, (232, 190), (172, 18), 12, ('s0', 's1', 's2', 's4'))
    # the hook and claw at the top, bending toward the middle
    d.arc([136, 2, 184, 46], 200, 360, fill=K['s1'] + (255,), width=11)
    d.arc([138, 4, 182, 44], 210, 330, fill=K['s3'] + (255,), width=2)
    P(d, [(136, 22), (146, 24), (144, 34), (132, 30)], 's1')           # the claw's split tip
    Ln(d, (136, 26), (142, 30), 'ink')
    Ln(d, (186, 60), (196, 56), 'blood', 3); Ln(d, (190, 70), (194, 68), 'bloodL', 2)
    paste(im, G)
    grip_hand(im, 214, 128, ang=-0.32, gw=12, gh=44, trigger=False, thumb='over', fw=12)
    return im, None


def axe():
    im, _ = canvas()
    sleeve(im, (244, 170), (330, 196), 56)
    G, d = layer()
    tube(d, (236, 192), (180, 30), 14, ('w0', 'w1', 'w2', 'w4'))      # the hickory handle
    P(d, [(150, 6), (214, 0), (218, 40), (160, 52)], 'r2')            # the red head
    P(d, [(154, 8), (210, 3), (212, 12), (156, 18)], 'r3')
    P(d, [(160, 44), (216, 32), (218, 40), (160, 52)], 'r0')
    P(d, [(122, 4), (154, 0), (164, 56), (134, 64)], 's2')            # the blade, its bevel and edge
    P(d, [(122, 4), (132, 3), (142, 62), (134, 64)], 's3')
    Ln(d, (122, 5), (134, 63), 's4', 2)
    P(d, [(212, 6), (232, 10), (230, 30), (214, 34)], 'r1')           # the pick at the back
    Ln(d, (130, 24), (138, 40), 'blood', 3)
    paste(im, G)
    grip_hand(im, 216, 130, ang=-0.32, gw=14, gh=46, trigger=False, thumb='over', fw=12)
    return im, None


def scalpel():
    """a pencil grip: the steel handle between the thumb and the index, the blade's belly toward the middle"""
    im, _ = canvas()
    sleeve(im, (248, 172), (330, 196), 56)
    G, d = layer()
    tube(d, (226, 150), (180, 70), 8, ('s0', 's1', 's2', 's4'))
    for i in range(6):
        t = 0.45 + i * 0.07
        x, y = 226 + (180 - 226) * t, 150 + (70 - 150) * t
        Ln(d, (x - 3, y + 1), (x + 3, y - 1), 's0')                   # the grip's knurl
    P(d, [(170, 74), (182, 68), (184, 74), (174, 82)], 's1')          # the blade's shoulder
    P(d, [(158, 44), (168, 40), (182, 70), (172, 76)], 's3')          # the blade
    P(d, [(158, 44), (162, 43), (174, 74), (172, 76)], 's4')
    Ln(d, (166, 44), (180, 70), 's1')
    paste(im, G)
    # the hand: a loose fist, the index along the top of the handle, the thumb opposite
    L, d = layer()
    back_of_hand(d, [(222, 128), (262, 120), (272, 172), (232, 180), (214, 156)])
    for i, (y0, w) in enumerate(((142, 11), (154, 10), (166, 9))):
        finger(d, (232, y0), (212, y0 + 4), w, tip=(208, y0 + 12))
        Ln(d, (234, y0 + 6), (210, y0 + 8), 'sk0')
    knuckles(d, [(236, 140), (238, 152), (238, 164)], 4)
    finger(d, (234, 126), (206, 112), 10, nail=True, tip=(194, 102))  # the index along the handle
    knuckles(d, [(232, 128)], 4)
    finger(d, (224, 140), (204, 128), 11, nail=True, tip=(196, 118))  # the thumb opposite
    paste(im, L)
    return im, None


def hands():
    """bare hands: a loose right fist ready to shove"""
    im, _ = canvas()
    sleeve(im, (240, 168), (330, 196), 56)
    L, d = layer()
    back_of_hand(d, [(206, 104), (252, 100), (262, 160), (220, 170), (200, 138)])
    for i in range(4):
        y0 = 114 + i * 13
        finger(d, (218, y0), (194, y0 + 2), 11 - (1 if i == 3 else 0), tip=(194, y0 + 12))
        Ln(d, (218, y0 + 7), (190, y0 + 8), 'sk0')
    knuckles(d, [(214, 112 + i * 13) for i in range(4)], 5)
    finger(d, (226, 114), (204, 104), 12, nail=True, tip=(192, 112))  # the thumb over the fingers
    paste(im, L)
    return im, None


def flashlight():
    """the left hand round a torch at the lower left, pointing ahead into the room (1.2.1): the tail cap under the hand, the knurled
    barrel, the flared head with its bezel ring seen from behind (the lens faces away; only a sliver of its light shows at the rim),
    and a dithered beam leaving the lens toward the middle of the screen"""
    im, _ = canvas()
    tail, head = (44, 182), (124, 100)
    dx, dy = head[0] - tail[0], head[1] - tail[1]; Lh = math.hypot(dx, dy)
    ux, uy = dx / Lh, dy / Lh                     # along the barrel, toward the lens
    nx, ny = -uy, ux                               # across it
    at = lambda t, s=0: (tail[0] + ux * t + nx * s, tail[1] + uy * t + ny * s)
    # the beam: a pale wedge of dithered pixels from the lens toward the middle (drawn first, under everything)
    B = Image.new('RGBA', (W, H), (0, 0, 0, 0)); bp = B.load()
    hx, hy = at(Lh + 2)
    for y in range(H):
        for x in range(W):
            vx, vy = x - hx, y - hy
            t = vx * ux + vy * uy
            if t <= 0 or t > 100:
                continue
            s = abs(vx * nx + vy * ny)
            half = 11 + t * 0.42
            if s > half:
                continue
            k = (1 - t / 100) * (1 - (s / half) ** 2)
            a = int(120 * k)
            if a < 14 or (x + y) % 2 and k < 0.55:
                continue
            bp[x, y] = (255, 240, 190, a)
    im.alpha_composite(B)
    # the sleeve and cuff
    L2, d2 = layer()
    P(d2, quad((40, 176), (-4, 206), 46, 62), 'co2')
    Ln(d2, (24, 162), (-10, 192), 'co4', 2)
    P(d2, quad((46, 166), (34, 182), 34, 40), 'cu1')
    Ln(d2, (32, 158), (60, 166), 'cu3')
    paste(im, L2)
    G, d = layer()
    tube(d, at(6), at(Lh - 22), 15, ('g0', 'g1', 'g2', 'g4'), cap=False)                 # the barrel
    tube(d, at(0), at(8), 16, ('g0', 'g0', 'g1', 'g2'), cap=False)                         # the tail cap
    for t in range(30, int(Lh - 34), 4):                                                    # the knurl
        Ln(d, at(t, -6), at(t + 2, 6), 'g0')
    P(d, quad(at(Lh - 24), at(Lh - 4), 15, 24), 'g1')                                      # the flared head
    P(d, quad(at(Lh - 22, -3), at(Lh - 5, -5), 4, 6), 'g2')
    Ln(d, at(Lh - 22, -6), at(Lh - 5, -10), 'g4')
    # the bezel ring seen from behind: an ellipse across the axis, rim lit at the top, a sliver of lens light at the far edge
    cx, cy = at(Lh - 2)
    pts = []
    for i in range(24):
        a = i / 24 * math.tau
        pts.append((cx + nx * math.cos(a) * 13 + ux * math.sin(a) * 4, cy + ny * math.cos(a) * 13 + uy * math.sin(a) * 4))
    P(d, pts, 'g2')
    inner = [(cx + (p[0] - cx) * 0.72 + ux * 1.5, cy + (p[1] - cy) * 0.72 + uy * 1.5) for p in pts]
    P(d, inner, 'lensD')
    P(d, [(cx + (p[0] - cx) * 0.5 + ux * 2.5, cy + (p[1] - cy) * 0.5 + uy * 2.5) for p in pts], 'lens')
    Ln(d, pts[18], pts[6], 'g4')
    Ln(d, at(Lh - 30, -8), at(Lh - 30, 8), 'g0', 2)                                        # where the head screws on
    P(d, quad(at(Lh * 0.62, -7), at(Lh * 0.62 + 7, -7), 4), 'g4')                           # the switch
    paste(im, G)
    L, d = layer()
    # the hand: the back of the hand under the barrel, four fingers wrapping across it, the thumb along the top on the switch
    back_of_hand(d, [at(14, 18), at(46, 20), at(52, 4), at(20, -2), at(4, 14)])
    for i in range(4):
        t = 16 + i * 9
        finger(d, at(t, 14), at(t + 2, -4), 9, tip=at(t + 4, -11))
        Ln(d, at(t - 3, 6), at(t + 5, 6), 'sk0')
    knuckles(d, [at(14 + i * 9, 17) for i in range(4)], 4)
    finger(d, at(8, -10), at(30, -12), 10, tip=at(Lh * 0.62 - 2, -11), nail=True)            # the thumb, its tip by the switch
    paste(im, L)
    return im, (round(cx), round(cy))


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for fn in (hands, scalpel, pipe, axe, nailgun, pistol, shotgun, rifle, flashlight):
        im, muzzle = fn()
        im.save(os.path.join(OUT, f'{fn.__name__}.png'))
        meta[fn.__name__] = {'muzzle': list(muzzle) if muzzle else None}
    with open(os.path.join(OUT, 'fp.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'w': W, 'h': H, 'weapons': meta}, f, indent=1)
    print('fp weapons:', ', '.join(meta))


if __name__ == '__main__':
    main()
