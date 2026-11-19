// Sunset Cover Studio — the cover drawing engine (no dependencies, no network).
//
// A cover is a set of slanted photo panels over a graded sunset backdrop, with one big
// condensed caption and a smaller sub-caption across the foot, a vignette, and a
// deterministic film grain. Every input is a plain value, so the same state always
// draws the same pixels.

/** Colour grades: backdrop stops, photo tint, caption ink, accent. */
export const GRADES = {
  sunset: {
    label: 'Sunset',
    sky: ['#2b1055', '#7597de'],
    back: ['#ff7a3d', '#ff2e88', '#5b2a86'],
    tint: 'rgba(255, 94, 58, 0.20)',
    tintMode: 'overlay',
    caption: '#ffffff',
    outline: '#1c0b2e',
    accent: '#ffd166',
    sub: '#ffe9d6',
  },
  neon: {
    label: 'Neon Night',
    sky: ['#12002e', '#3b0a6e'],
    back: ['#ff2fb3', '#7b2fff', '#00e5ff'],
    tint: 'rgba(0, 229, 255, 0.16)',
    tintMode: 'overlay',
    caption: '#f4feff',
    outline: '#12002e',
    accent: '#00e5ff',
    sub: '#d9f7ff',
  },
  gold: {
    label: 'Golden Hour',
    sky: ['#3a1c00', '#7a4a00'],
    back: ['#ffb347', '#ff8c00', '#7a2e00'],
    tint: 'rgba(255, 179, 71, 0.20)',
    tintMode: 'overlay',
    caption: '#fff8e7',
    outline: '#2e1500',
    accent: '#ffe08a',
    sub: '#ffedbe',
  },
};

/** Panel layouts: polygons in normalised (0..1) coordinates, slanted GTA-style. */
export function layoutPolygons(layout, w, h) {
  const polys = {
    single: [
      [[0, 0], [1, 0], [1, 1], [0, 1]],
    ],
    two: [
      [[0, 0], [0.54, 0], [0.46, 1], [0, 1]],
      [[0.54, 0], [1, 0], [1, 1], [0.46, 1]],
    ],
    three: [
      [[0, 0], [0.38, 0], [0.30, 1], [0, 1]],
      [[0.38, 0], [0.70, 0], [0.62, 1], [0.30, 1]],
      [[0.70, 0], [1, 0], [1, 1], [0.62, 1]],
    ],
    four: [
      [[0, 0], [0.52, 0], [0.48, 0.5], [0, 0.5]],
      [[0.52, 0], [1, 0], [1, 0.5], [0.48, 0.5]],
      [[0, 0.5], [0.48, 0.5], [0.44, 1], [0, 1]],
      [[0.48, 0.5], [1, 0.5], [1, 1], [0.44, 1]],
    ],
  }[layout] ?? [
    [[0, 0], [1, 0], [1, 1], [0, 1]],
  ];
  return polys.map((poly) => poly.map(([x, y]) => [x * w, y * h]));
}

export const LAYOUT_LABELS = {
  single: 'Single',
  two: 'Two panels',
  three: 'Three panels',
  four: 'Four panels',
};

export const EXPORT_SIZES = [
  { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
];

/** Deterministic PRNG (mulberry32) so the grain is identical on every run. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tracePath(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

/** Shrink a polygon a touch toward its centroid, leaving a thin gap between panels. */
function insetPoly(poly, w, h) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const fx = 1 - (5 / w);
  const fy = 1 - (5 / h);
  return poly.map(([x, y]) => [cx + (x - cx) * fx, cy + (y - cy) * fy]);
}

function polyBounds(poly) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Draw `img` cover-fitting `poly`, with a zoom factor and a pan offset (fractions of the panel). */
function drawPhotoInPanel(ctx, img, poly, zoom, panX, panY) {
  const box = polyBounds(poly);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(box.w / iw, box.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = box.x + (box.w - dw) / 2 + panX * box.w;
  const dy = box.y + (box.h - dh) / 2 + panY * box.h;
  ctx.save();
  tracePath(ctx, poly);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** Classic ray-casting point-in-polygon test, for clicking a panel to select it. */
export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A small deterministic grain tile, regenerated from the same seed every draw. */
function grainTile(seed, size = 128) {
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(size, size);
  const rand = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 28;
  }
  tctx.putImageData(img, 0, 0);
  return tile;
}

/** Fit a caption into `maxWidth`, shrinking from `startSize`; honours \n as a line break. */
function fitLines(ctx, text, maxWidth, startSize, family) {
  const rawLines = text.split('\n').filter((line) => line.trim().length > 0);
  const lines = rawLines.length ? rawLines : [''];
  let size = startSize;
  const measure = (s) => {
    ctx.font = `900 ${s}px ${family}`;
    return Math.max(...lines.map((line) => ctx.measureText(line).width));
  };
  while (size > 14 && measure(size) > maxWidth) size -= 2;
  ctx.font = `900 ${size}px ${family}`;
  return { lines, size };
}

const DISPLAY_FAMILY = "Impact, 'Arial Black', 'Franklin Gothic Heavy', 'Arial Narrow', sans-serif";

/**
 * Draw the whole cover onto `canvas` (at the canvas's own pixel size).
 *
 * state: {
 *   photos: HTMLImageElement[] (library, may hold nulls while loading),
 *   assignment: number[] (per panel, an index into photos),
 *   zoom: number[], panX: number[], panY: number[] (per panel),
 *   layout: 'single' | 'two' | 'three' | 'four',
 *   grade: 'sunset' | 'neon' | 'gold',
 *   caption: string, subcaption: string,
 *   seed: number (grain seed; fixed for determinism),
 *   selected: number (-1 for none; editor outline only),
 * }
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const polys = layoutPolygons(state.layout, w, h);

  // Backdrop: warm vertical grade wash.
  const back = ctx.createLinearGradient(0, 0, w * 0.25, h);
  grade.back.forEach((color, i) => back.addColorStop(i / (grade.back.length - 1), color));
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, w, h);

  // Panels: photo, clipped to its slanted shape, then a thin dark seam.
  polys.forEach((poly, i) => {
    const small = insetPoly(poly, w, h);
    const photo = state.photos[state.assignment[i] ?? 0] ?? null;
    if (photo) {
      drawPhotoInPanel(
        ctx,
        photo,
        small,
        state.zoom[i] ?? 1,
        state.panX[i] ?? 0,
        state.panY[i] ?? 0,
      );
    } else {
      ctx.save();
      tracePath(ctx, small);
      ctx.fillStyle = grade.sky[0];
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    tracePath(ctx, small);
    ctx.strokeStyle = 'rgba(10, 4, 20, 0.85)';
    ctx.lineWidth = Math.max(2, w * 0.002);
    ctx.stroke();
    ctx.restore();
  });

  // Grade tint over the photos, then a dark foot so the caption always reads.
  ctx.save();
  ctx.globalCompositeOperation = grade.tintMode;
  ctx.fillStyle = grade.tint;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const foot = ctx.createLinearGradient(0, h * 0.52, 0, h);
  foot.addColorStop(0, 'rgba(12, 4, 24, 0)');
  foot.addColorStop(1, 'rgba(12, 4, 24, 0.78)');
  ctx.fillStyle = foot;
  ctx.fillRect(0, 0, w, h);

  // Sun glow, top corner.
  const glow = ctx.createRadialGradient(w * 0.82, h * 0.06, 0, w * 0.82, h * 0.06, w * 0.55);
  glow.addColorStop(0, 'rgba(255, 240, 200, 0.35)');
  glow.addColorStop(1, 'rgba(255, 240, 200, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Vignette.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(8, 2, 16, 0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Sub-caption: small letterspaced caps with rules, above the main caption.
  const sub = (state.subcaption ?? '').trim().toUpperCase();
  const caption = (state.caption ?? '').trim().toUpperCase();
  const pad = w * 0.045;
  const maxW = w - pad * 2;
  const footTop = h * 0.80;

  if (sub) {
    const subSize = Math.max(13, Math.round(h * 0.020));
    ctx.font = `700 ${subSize}px ${DISPLAY_FAMILY}`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.32)}px`; } catch { /* older canvas: ignore */ }
    const subW = ctx.measureText(sub).width;
    const y = footTop - h * 0.012;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = grade.sub;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = subSize * 0.25;
    ctx.fillText(sub, pad, y);
    ctx.shadowBlur = 0;
    // A short accent bar above the sub-caption (never through the glyphs).
    ctx.fillStyle = grade.accent;
    const ruleY = y - subSize - 9;
    ctx.fillRect(pad, ruleY, Math.min(subW, maxW), 4);
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  }

  // Main caption: huge condensed caps, squashed horizontally for the poster look.
  if (caption) {
    const { lines, size } = fitLines(ctx, caption, maxW, Math.round(h * 0.135), DISPLAY_FAMILY);
    ctx.save();
    // Squash horizontally for the condensed poster look; the e offset keeps the
    // first glyph exactly on the left pad (0.86 * pad + e = pad). No vertical
    // scale: one would push the baseline below the canvas foot.
    ctx.transform(0.86, 0, 0, 1, pad * 0.14, 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.03;
    const lineH = size * 0.98;
    const totalH = lineH * lines.length;
    const startY = h - h * 0.035 - (totalH - lineH);
    lines.forEach((line, i) => {
      const y = startY + i * lineH;
      ctx.strokeStyle = grade.outline;
      ctx.lineWidth = Math.max(3, size * 0.09);
      ctx.strokeText(line, pad, y);
      ctx.fillStyle = grade.caption;
      ctx.fillText(line, pad, y);
    });
    ctx.restore();
  }

  // Deterministic grain over everything.
  const tile = grainTile(state.seed ?? 20261119);
  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Editor-only selection outline around the chosen panel.
  if (typeof state.selected === 'number' && state.selected >= 0 && polys[state.selected]) {
    ctx.save();
    tracePath(ctx, polys[state.selected]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, w * 0.004);
    ctx.setLineDash([Math.round(w * 0.018), Math.round(w * 0.01)]);
    ctx.stroke();
    ctx.restore();
  }
}
