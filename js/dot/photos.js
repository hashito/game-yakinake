// The photos, drawn as pixel art at boot (from 水無瀬病院 ドット版 dot/js/dot/photos.js): each picture of assets/photos/ is read once,
// to about 120 px on its short side with an ordered dither to a small palette, and kept as a blob URL. Every way the kit and the game
// show a photo (img.src, setAttribute, <img> in innerHTML, style.backgroundImage) is mapped to the pixel picture, and the dot CSS
// enlarges every picture with hard edges (image-rendering: pixelated). Text is never inside these photos (documents are HTML text).
const RE = /(?:^|[^\w-])assets\/photos\/([\w.-]+\.(?:webp|png|jpe?g))/;   // after a /, a quote, url( or the start
const map = new Map();   // file name -> blob URL
const SHORT = 120, LEVELS = 7;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

export const pixelUrl = (v) => {
  if (typeof v !== 'string' || !map.size) return v;
  const m = v.match(RE);
  return m && map.has(m[1]) ? map.get(m[1]) : v;
};
const mapCss = (v) => (typeof v === 'string' && map.size ? v.replace(/url\((['"]?)([^'")]+)\1\)/g, (all, q, u) => { const p = pixelUrl(u); return p === u ? all : `url(${q}${p}${q})`; }) : v);

async function pixelate(url) {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  const k = SHORT / Math.min(img.naturalWidth, img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * Math.min(1, k))), h = Math.max(1, Math.round(img.naturalHeight * Math.min(1, k)));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, w, h);
  const id = g.getImageData(0, 0, w, h), d = id.data, step = 255 / (LEVELS - 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, b = BAYER[(y & 3) * 4 + (x & 3)] * step;
    for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.max(0, Math.min(255, Math.round((d[i + ch] + b) / step) * step));
  }
  g.putImageData(id, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return URL.createObjectURL(blob);
}

/** pixel versions of every photo in the list (names under /assets/photos/); report(k) while it works */
export async function preparePhotos(names, report = () => {}) {
  let n = 0;
  const t0 = performance.now();
  // a few at a time: decoding is off the main thread, the dither is short
  const queue = [...names];
  const worker = async () => {
    while (queue.length) {
      const f = queue.shift();
      try { map.set(f, await pixelate(new URL(`../../assets/photos/${f}`, import.meta.url).href)); } catch (e) { console.warn('[dot] photo stays smooth:', f, e && e.message); }
      report(++n / names.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  refresh(document.body);
  return { photos: map.size, of: names.length, ms: Math.round(performance.now() - t0) };
}

// whatever was already on screen (the title art)
let fixAll = () => {};
function refresh() { fixAll(); }

/** route every photo the page shows through pixelUrl (installed once, before the game builds its shell) */
export function installPhotoHooks() {
  const P = HTMLImageElement.prototype, d = Object.getOwnPropertyDescriptor(P, 'src');
  Object.defineProperty(P, 'src', { configurable: true, enumerable: d.enumerable, get() { return d.get.call(this); }, set(v) { d.set.call(this, pixelUrl(v)); } });
  const sa = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (k, v) { return sa.call(this, k, k === 'src' && this instanceof HTMLImageElement ? pixelUrl(v) : k === 'style' ? mapCss(v) : v); };
  // style.backgroundImage is not a patchable accessor in every browser: the style attribute is watched instead (the change is made
  // before the next paint, so the smooth photo never shows; the request it started is cancelled or cached)
  const fix = (el) => {
    if (el.tagName === 'IMG') { const v = el.getAttribute('src') || ''; if (RE.test(v)) { const u = pixelUrl(v); if (u !== v) el.src = u; } }
    const st = el.getAttribute && el.getAttribute('style');
    if (st && RE.test(st)) for (const prop of ['background-image', 'background']) {
      const v = el.style.getPropertyValue(prop), u = mapCss(v);
      if (v && u !== v) el.style.setProperty(prop, u, el.style.getPropertyPriority(prop));
    }
  };
  new MutationObserver((list) => {
    if (!map.size) return;
    for (const m of list) {
      if (m.type === 'attributes') fix(m.target);
      else for (const n of m.addedNodes) if (n.nodeType === 1) { fix(n); if (n.querySelectorAll) for (const e of n.querySelectorAll('img, [style]')) fix(e); }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'style'] });
  fixAll = () => { for (const e of document.querySelectorAll('img, [style]')) fix(e); };
}
