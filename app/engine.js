// Sunset Cover Studio — drawing engine.
// Draws the multi-panel poster cover onto a canvas, deterministically:
// the same inputs always produce the same pixels.

export const GRADES = {
  sunset: {
    backdrop: ["#2b1055", "#7597de", "#ff6a3d", "#ffc46b"],
    wash: ["rgba(255,106,61,0.34)", "rgba(255,46,99,0.30)"],
    caption: "#ffffff",
    accent: "#ffd76a",
  },
  neon: {
    backdrop: ["#0b0221", "#3b0f66", "#ff00e5", "#00e5ff"],
    wash: ["rgba(255,0,229,0.30)", "rgba(0,229,255,0.30)"],
    caption: "#ffffff",
    accent: "#00e5ff",
  },
  gold: {
    backdrop: ["#241505", "#7a4a12", "#ffb52e", "#ffe9a8"],
    wash: ["rgba(255,181,46,0.36)", "rgba(255,233,168,0.22)"],
    caption: "#fff8e6",
    accent: "#ffb52e",
  },
};

export const LAYOUTS = ["trio", "duo", "quad", "solo"];

// Small deterministic PRNG so the grain is identical on every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Slanted panel polygons for a layout, each an array of [x, y] points.
// Panels slant down to the right, in the poster style.
export function panelPolygons(layout, width, height) {
  const slant = Math.round(height * 0.09);
  const strips = layout === "duo" ? 2 : layout === "quad" ? 4 : layout === "solo" ? 1 : 3;
  const polys = [];
  for (let i = 0; i < strips; i++) {
    const x0 = Math.round((width * i) / strips);
    const x1 = Math.round((width * (i + 1)) / strips);
    polys.push([
      [x0 - slant, -slant],
      [x1 + slant, -slant],
      [x1 + slant * 2, height + slant],
      [x0, height + slant],
    ]);
  }
  return polys;
}

export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function tracePolygon(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

function drawPhotoCover(ctx, img, box, crop) {
  const [bx, by, bw, bh] = box;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const zoom = crop.zoom || 1;
  const scale = Math.max(bw / iw, bh / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = bx + (bw - dw) / 2 + (crop.panX || 0);
  const dy = by + (bh - dh) / 2 + (crop.panY || 0);
  ctx.drawImage(img, dx, dy, dw, dh);
}

function panelBox(poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  return [x0, y0, x1 - x0, y1 - y0];
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const trial = line ? line + " " + word : word;
    if (ctx.measureText(trial).width <= maxWidth || !line) line = trial;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawGrain(ctx, width, height, seed) {
  const rand = mulberry32(seed);
  const tile = 128;
  const off = document.createElement("canvas");
  off.width = tile;
  off.height = tile;
  const octx = off.getContext("2d");
  const data = octx.createImageData(tile, tile);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  octx.putImageData(data, 0, 0);
  const pattern = ctx.createPattern(off, "repeat");
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// opts: { photos, layout, grade, title, subtitle, width, height, crops, selected }
// photos: array of canvas/image sources. crops: per-panel {zoom, panX, panY}.
export function drawCover(canvas, opts) {
  const width = opts.width;
  const height = opts.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const grade = GRADES[opts.grade] || GRADES.sunset;
  const photos = opts.photos && opts.photos.length ? opts.photos : [];
  const polys = panelPolygons(opts.layout || "trio", width, height);
  const crops = opts.crops || [];

  // Backdrop sky, visible in the slanted gaps between panels.
  const sky = ctx.createLinearGradient(0, 0, width * 0.25, height);
  grade.backdrop.forEach((color, i) => {
    sky.addColorStop(i / (grade.backdrop.length - 1), color);
  });
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Panels: each filled with a photo, clipped to its slanted shape.
  polys.forEach((poly, i) => {
    const photo = photos[i % photos.length];
    ctx.save();
    tracePolygon(ctx, poly);
    ctx.clip();
    if (photo) {
      // Pan offsets are stored against a 1080 px reference width so the
      // same crop reads the same way at every export size.
      const raw = crops[i] || { zoom: 1, panX: 0, panY: 0 };
      const crop = {
        zoom: raw.zoom || 1,
        panX: (raw.panX || 0) * (width / 1080),
        panY: (raw.panY || 0) * (height / 1080),
      };
      drawPhotoCover(ctx, photo, panelBox(poly), crop);
    } else {
      ctx.fillStyle = "#1c0b33";
      ctx.fillRect(0, 0, width, height);
    }
    // Warm wash inside each panel so photos share the grade.
    const wash = ctx.createLinearGradient(0, 0, 0, height);
    wash.addColorStop(0, grade.wash[0]);
    wash.addColorStop(1, grade.wash[1]);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  });

  // Crisp white dividers along the slanted panel edges.
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = Math.max(4, Math.round(width * 0.006));
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = Math.round(width * 0.004);
  for (let i = 1; i < polys.length; i++) {
    const edge = [polys[i][0], polys[i][3]];
    ctx.beginPath();
    ctx.moveTo(edge[0][0], edge[0][1]);
    ctx.lineTo(edge[1][0], edge[1][1]);
    ctx.stroke();
  }
  ctx.restore();

  // Vignette to pull the eye to the middle.
  const vig = ctx.createRadialGradient(
    width / 2, height * 0.45, Math.min(width, height) * 0.35,
    width / 2, height / 2, Math.max(width, height) * 0.75,
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(10,2,20,0.42)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  // Caption block: small sub-caption over one big bold title.
  const title = (opts.title || "").toUpperCase();
  const subtitle = (opts.subtitle || "").toUpperCase();
  const margin = Math.round(width * 0.05);
  const maxText = width - margin * 2;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const titleSize = Math.round(width * 0.135);
  ctx.font = `${titleSize}px Anton, "Arial Narrow", sans-serif`;
  let size = titleSize;
  let lines = wrapLines(ctx, title, maxText);
  while ((lines.length > 2 || ctx.measureText(lines[0]).width > maxText) && size > 24) {
    size = Math.round(size * 0.92);
    ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
    lines = wrapLines(ctx, title, maxText);
  }
  const lineHeight = Math.round(size * 1.02);
  const blockHeight = lines.length * lineHeight + Math.round(size * 0.42);
  let y = height - Math.round(height * 0.045) - blockHeight + lineHeight;
  ctx.translate(0, 0);
  ctx.rotate(0);
  // Sub-caption first, in the tall narrow face.
  const subSize = Math.max(18, Math.round(width * 0.028));
  ctx.font = `${subSize}px "Bebas Neue", "Arial Narrow", sans-serif`;
  try {
    ctx.letterSpacing = `${Math.round(subSize * 0.28)}px`;
  } catch (e) {
    /* older canvas: no letter spacing */
  }
  ctx.fillStyle = grade.accent;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText(subtitle, margin, y - lines.length * lineHeight - Math.round(subSize * 0.4));
  try {
    ctx.letterSpacing = "0px";
  } catch (e) {
    /* ignore */
  }
  // Main title, white with a dark edge so it reads over any photo.
  ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(20,5,30,0.85)";
  ctx.lineWidth = Math.max(3, Math.round(size * 0.09));
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = Math.round(size * 0.12);
  ctx.shadowOffsetY = Math.round(size * 0.05);
  for (const line of lines) {
    ctx.strokeText(line, margin, y);
    ctx.fillStyle = grade.caption;
    ctx.fillText(line, margin, y);
    y += lineHeight;
  }
  ctx.restore();

  // Fine deterministic grain over the finished cover.
  drawGrain(ctx, width, height, 20261119);
  return canvas;
}
