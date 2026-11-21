# -*- coding: utf-8 -*-
"""Builds a share picture (OGP, 1200 x 630) from a key picture and title text, all set in a JSON config:
the picture fills the frame (cover crop), optionally blurred / darkened, a dark gradient on the text side,
then texts (with an optional glow), chat bubbles, boxes / badges and an inset photo are drawn on top.
Optionally a small square thumbnail too. Text is drawn here, never generated. No ComfyUI needed.

From game-heiengo / game-arakawa / game-mikakunin / game-henji / game-kaidan tools/make_og.py (the same
layout written out per game), made game-agnostic.

Requires: Pillow. Fonts: Windows Yu Mincho / Yu Gothic by default (aliases mincho, gothic, gothic_b);
any .ttf / .ttc / .otf path works, and a missing font falls back to Noto / Meiryo / MS Gothic.

Usage:
    python tools/make_og.py                              # tools/og.json -> assets/og-image.png
    python tools/make_og.py tools/og.json --out assets/og-image.png --image assets/media/key_title.jpg
    python tools/make_og.py og.json --set title=返事 --set teaser="..."   # fills {title} {teaser} in the texts
    python tools/make_og.py og.json --root C:/path/to/game

Config (see tools/examples/og.example.json; colours are "#rrggbb" or [r, g, b]; x / y in px of the 1200 x 630 frame):
  { "image": "assets/media/key_title.jpg", "out": "assets/og-image.png", "size": [1200, 630], "bg": "#0c0e11",
    "brightness": 0.8, "blur": 0, "tint": { "color": "#0e121a", "amount": 0.6 },
    "shade": { "side": "left", "color": "#05070a", "from": 235, "to": 0, "reach": 0.85 },
    "fonts": { "title": "C:/Windows/Fonts/yumindb.ttf" },
    "texts": [ { "text": "{title}", "x": 66, "y": 120, "font": "mincho", "size": 112, "color": "#f1ede4",
                 "glow": "#f2b350", "max_width": 620, "line_gap": 14, "max_lines": 2, "spacing": 0 } ],
    "bubbles": [ { "text": "...", "x": 700, "y": 150, "side": "left", "size": 26, "fill": "#dfe2e6", "color": "#17191c", "max_width": 420 } ],
    "boxes": [ { "rect": [74, 540, 676, 584], "radius": 10, "outline": "#f2b350", "width": 2, "fill": null } ],
    "inset": { "image": null, "rect": [740, 65, 400, 500], "radius": 34 },
    "thumb": { "out": "assets/thumb.jpg", "size": 128 } }
  A text with "y": null goes just below the previous text. A config may also be a list of such objects.
"""
import argparse, json, os, sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIN = os.path.join(os.environ.get("WINDIR", "C:/Windows"), "Fonts")
FONTS = {
    "mincho": ["yumindb.ttf", "yumin.ttf", "NotoSerifJP-VF.ttf", "msmincho.ttc", "NotoSerifCJK-Bold.ttc"],
    "gothic": ["YuGothM.ttc", "NotoSansJP-VF.ttf", "meiryo.ttc", "msgothic.ttc", "NotoSansCJK-Regular.ttc"],
    "gothic_b": ["YuGothB.ttc", "NotoSansJP-VF.ttf", "meiryob.ttc", "msgothic.ttc", "NotoSansCJK-Bold.ttc"],
}
SEARCH = [WIN, "C:/Windows/Fonts", os.path.expanduser("~/AppData/Local/Microsoft/Windows/Fonts"),
          "/usr/share/fonts/opentype/noto", "/usr/share/fonts/truetype/noto", "/System/Library/Fonts", "/Library/Fonts"]
_warned = set()


def color(c, default=(255, 255, 255)):
    if c is None:
        return default
    if isinstance(c, str):
        c = c.lstrip("#")
        return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
    return tuple(c)


def font(name, size, aliases):
    """name: an alias (mincho / gothic / gothic_b / one from the config "fonts"), a file name or a path"""
    cands = []
    if name in aliases:
        cands.append(aliases[name])
    cands += FONTS.get(name, [])
    if name not in aliases and name not in FONTS:
        cands.append(name)
    cands += FONTS["gothic"]
    for c in cands:
        for p in ([c] if os.path.isabs(c) else [os.path.join(d, c) for d in SEARCH] + [os.path.join(ROOT, c)]):
            if os.path.isfile(p):
                try:
                    return ImageFont.truetype(p, size)
                except OSError:
                    continue
    if name not in _warned:
        print(f"  font '{name}' not found: using Pillow's default (no Japanese glyphs)")
        _warned.add(name)
    return ImageFont.load_default(size) if hasattr(ImageFont, "load_default") else ImageFont.load_default()


def cover_fill(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s + 1), int(im.height * s + 1)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def wrap(d, text, f, width, spacing=0):
    """wrap per character (Japanese has no spaces); explicit \\n kept"""
    out = []
    for para in str(text).split("\n"):
        cur = ""
        for ch in para:
            if width and d.textlength(cur + ch, font=f) + spacing * len(cur) > width and cur:
                out.append(cur)
                cur = ch
            else:
                cur += ch
        out.append(cur)
    return out


def draw_line(d, xy, text, f, fill, spacing=0):
    if not spacing:
        d.text(xy, text, font=f, fill=fill)
        return
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + spacing


def fill_vars(s, vars_):
    for k, val in vars_.items():
        s = s.replace("{" + k + "}", val)
    return s


def build(cfg, root, vars_, out_override=None, image_override=None):
    W, H = cfg.get("size", [1200, 630])
    aliases = {k: (v if os.path.isabs(v) else v) for k, v in (cfg.get("fonts") or {}).items()}
    base = Image.new("RGB", (W, H), color(cfg.get("bg"), (12, 14, 17)))
    src = image_override or cfg.get("image")
    photo = None
    if src:
        p = src if os.path.isabs(src) else os.path.join(root, src)
        if os.path.exists(p):
            photo = Image.open(p).convert("RGB")
            im = cover_fill(photo, W, H)
            if cfg.get("blur"):
                im = im.filter(ImageFilter.GaussianBlur(float(cfg["blur"])))
            if cfg.get("brightness") is not None:
                im = ImageEnhance.Brightness(im).enhance(float(cfg["brightness"]))
            if cfg.get("tint"):
                im = Image.blend(im, Image.new("RGB", (W, H), color(cfg["tint"].get("color"), (14, 18, 26))), float(cfg["tint"].get("amount", 0.5)))
            base = im
        else:
            print(f"  key picture {src} not found: plain background")
    sh = cfg.get("shade", {"side": "left"})
    if sh:
        mask = Image.new("L", (W, H))
        md = ImageDraw.Draw(mask)
        a0, a1, reach = int(sh.get("from", 235)), int(sh.get("to", 0)), float(sh.get("reach", 0.85))
        side = sh.get("side", "left")
        n = W if side in ("left", "right") else H
        for i in range(n):
            t = min(1.0, i / max(1, n * reach))
            val = int(a0 + (a1 - a0) * t)
            j = i if side in ("left", "top") else n - 1 - i
            md.line([(j, 0), (j, H)] if side in ("left", "right") else [(0, j), (W, j)], fill=val)
        base = Image.composite(Image.new("RGB", (W, H), color(sh.get("color"), (5, 7, 10))), base, mask)
    ins = cfg.get("inset")
    if ins and (photo or ins.get("image")):
        ip = ins.get("image")
        pic = Image.open(ip if os.path.isabs(ip) else os.path.join(root, ip)).convert("RGB") if ip else photo
        x, y, w, h = ins.get("rect", [740, 65, 400, 500])
        pic = cover_fill(pic, w, h)
        m = Image.new("L", (w, h), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=int(ins.get("radius", 30)), fill=255)
        base.paste(pic, (x, y), m)
    d = ImageDraw.Draw(base)
    for b in cfg.get("boxes", []):
        d.rounded_rectangle(b["rect"], radius=int(b.get("radius", 0)), fill=color(b["fill"]) if b.get("fill") else None,
                            outline=color(b["outline"]) if b.get("outline") else None, width=int(b.get("width", 1)))
    y_next = 0
    for t in cfg.get("texts", []):
        f = font(t.get("font", "gothic"), int(t.get("size", 30)), aliases)
        lines = wrap(d, fill_vars(t["text"], vars_), f, t.get("max_width"), t.get("spacing", 0))
        if t.get("max_lines") and len(lines) > t["max_lines"]:
            lines = lines[:t["max_lines"]]
            lines[-1] = lines[-1][:-1] + "…"
        x = int(t.get("x", 70))
        y = int(t["y"]) if t.get("y") is not None else y_next
        lh = f.size + int(t.get("line_gap", 10))
        if t.get("glow"):
            g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            gd = ImageDraw.Draw(g)
            for i, l in enumerate(lines):
                draw_line(gd, (x, y + i * lh), l, f, color(t["glow"]) + (int(t.get("glow_alpha", 120)),), t.get("spacing", 0))
            g = g.filter(ImageFilter.GaussianBlur(float(t.get("glow_radius", 14))))
            base.paste(g, (0, 0), g)
            d = ImageDraw.Draw(base)
        for i, l in enumerate(lines):
            draw_line(d, (x, y + i * lh), l, f, color(t.get("color"), (240, 240, 240)), t.get("spacing", 0))
        y_next = y + lh * len(lines) + int(t.get("after", 16))
    for b in cfg.get("bubbles", []):
        f = font(b.get("font", "gothic"), int(b.get("size", 26)), aliases)
        lines = wrap(d, fill_vars(b["text"], vars_), f, b.get("max_width", 480))[:int(b.get("max_lines", 3))]
        lh = f.size + 10
        bw = max(d.textlength(l, font=f) for l in lines) + 44
        bh = lh * len(lines) + 22
        x = int(b.get("x", 700)) - (bw if b.get("side") == "right" else 0)
        y = int(b["y"])
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(layer).rounded_rectangle([x, y, x + bw, y + bh], radius=int(b.get("radius", 22)),
                                                fill=color(b.get("fill"), (223, 226, 230)) + (int(b.get("alpha", 236)),))
        base = Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB")
        d = ImageDraw.Draw(base)
        for i, l in enumerate(lines):
            d.text((x + 22, y + 11 + i * lh), l, font=f, fill=color(b.get("color"), (23, 25, 28)))
    out = out_override or cfg.get("out", "assets/og-image.png")
    out = out if os.path.isabs(out) else os.path.join(root, out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if out.lower().endswith(".png"):
        base.save(out, "PNG", optimize=True)
    else:
        base.save(out, "JPEG", quality=int(cfg.get("quality", 86)), optimize=True, progressive=True)
    print(f"wrote {out} {base.size} {os.path.getsize(out) // 1024}KB")
    th = cfg.get("thumb")
    if th and photo:
        s = int(th.get("size", 128))
        tp = th.get("out", "assets/thumb.jpg")
        tp = tp if os.path.isabs(tp) else os.path.join(root, tp)
        cover_fill(photo, s * 2, s * 2).resize((s, s), Image.LANCZOS).save(tp, "JPEG", quality=80, optimize=True)
        print(f"wrote {tp} ({s}x{s})")
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description="OGP picture from a key picture + text (see the docstring)")
    ap.add_argument("config", nargs="?", default="tools/og.json")
    ap.add_argument("--out", help="output file (overrides the config)")
    ap.add_argument("--image", help="key picture (overrides the config)")
    ap.add_argument("--set", action="append", default=[], metavar="NAME=TEXT", help="fill {NAME} in the texts")
    ap.add_argument("--root", default=ROOT, help="project folder (relative paths start here)")
    a = ap.parse_args(argv)
    root = os.path.abspath(a.root)
    p = a.config if os.path.isabs(a.config) else os.path.join(root, a.config)
    if not os.path.exists(p):
        print(f"no config {p} (see tools/examples/og.example.json)")
        return 1
    cfg = json.load(open(p, encoding="utf-8"))
    vars_ = dict(s.split("=", 1) for s in a.set if "=" in s)
    for c in (cfg if isinstance(cfg, list) else [cfg]):
        vars_c = dict(c.get("vars", {}))
        vars_c.update(vars_)
        build(c, root, vars_c, a.out, a.image)
    return 0


if __name__ == "__main__":
    sys.exit(main())
