// Sunset Cover Studio — page wiring: photos, layout, grade, words, panel editing,
// PNG export, the ?shot= screenshot scenes and the ?selftest=1 headless check.
import { drawCover, layoutPolygons, pointInPoly, GRADES, LAYOUT_LABELS, EXPORT_SIZES } from './cover.js';
import { runShot } from './shots.js';

const SAMPLES = [
  { name: 'Sunset portrait', src: 'samples/portrait.svg' },
  { name: 'Pier', src: 'samples/pier.jpg' },
  { name: 'Boulevard', src: 'samples/boulevard.jpg' },
];

const PANEL_COUNT = { single: 1, two: 2, three: 3, four: 4 };

const state = {
  layout: 'three',
  grade: 'sunset',
  caption: 'SUNSET HEIST',
  subcaption: 'VICE CITY • 2026',
  size: { w: 1080, h: 1080 },
  photos: [], // { name, src, img }
  assignment: [0, 1, 2, 0],
  zoom: [1, 1, 1, 1],
  panX: [0, 0, 0, 0],
  panY: [0, 0, 0, 0],
  selected: 0,
  seed: 20261119,
};

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subcaptionInput = document.getElementById('subcaption');
const statusEl = document.getElementById('status');
const libraryEl = document.getElementById('library');
const panelControlsEl = document.getElementById('panel-controls');
const zoomInput = document.getElementById('zoom');
const panxInput = document.getElementById('panx');
const panyInput = document.getElementById('pany');

function setStatus(text) {
  statusEl.textContent = text;
}

/** Load an image from a URL, resolving to the image (or null when it cannot load). */
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Rebuild the photo library from [{name, src}], loading every image, then re-render. */
async function setLibrary(entries) {
  state.photos = entries.map((entry) => ({ ...entry, img: null }));
  renderLibrary();
  const loaded = await Promise.all(entries.map((entry) => loadImage(entry.src)));
  loaded.forEach((img, i) => { state.photos[i].img = img; });
  render();
}

function renderLibrary() {
  libraryEl.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${photo.name}`;
    libraryEl.appendChild(li);
  });
  rebuildPanelControls();
}

function panelCount() {
  return PANEL_COUNT[state.layout] ?? 3;
}

function engineState(selected) {
  return {
    photos: state.photos.map((photo) => photo.img),
    assignment: state.assignment,
    zoom: state.zoom,
    panX: state.panX,
    panY: state.panY,
    layout: state.layout,
    grade: state.grade,
    caption: state.caption,
    subcaption: state.subcaption,
    seed: state.seed,
    selected,
  };
}

function render() {
  if (canvas.width !== state.size.w || canvas.height !== state.size.h) {
    canvas.width = state.size.w;
    canvas.height = state.size.h;
  }
  drawCover(canvas, engineState(state.selected));
}

function syncChoiceButtons() {
  document.querySelectorAll('.layout-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.layout === state.layout);
    btn.setAttribute('aria-pressed', String(btn.dataset.layout === state.layout));
  });
  document.querySelectorAll('.grade-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.grade === state.grade);
    btn.setAttribute('aria-pressed', String(btn.dataset.grade === state.grade));
  });
}

function rebuildPanelControls() {
  panelControlsEl.innerHTML = '';
  const count = panelCount();
  for (let i = 0; i < count; i++) {
    const label = document.createElement('label');
    label.textContent = `Panel ${i + 1} photo `;
    const select = document.createElement('select');
    select.dataset.panel = String(i);
    state.photos.forEach((photo, j) => {
      const option = document.createElement('option');
      option.value = String(j);
      option.textContent = photo.name;
      select.appendChild(option);
    });
    select.value = String(state.assignment[i] ?? (i % Math.max(1, state.photos.length)));
    select.addEventListener('change', () => {
      state.assignment[i] = Number(select.value);
      render();
    });
    select.addEventListener('focus', () => { state.selected = i; render(); });
    label.appendChild(select);
    panelControlsEl.appendChild(label);
  }
  syncSliders();
}

function syncSliders() {
  const i = state.selected;
  zoomInput.value = String(state.zoom[i] ?? 1);
  panxInput.value = String(state.panX[i] ?? 0);
  panyInput.value = String(state.panY[i] ?? 0);
  document.getElementById('zoom-val').textContent = `${(state.zoom[i] ?? 1).toFixed(2)}×`;
  document.getElementById('panx-val').textContent = String(state.panX[i] ?? 0);
  document.getElementById('pany-val').textContent = String(state.panY[i] ?? 0);
}

function applyLayout(layout) {
  if (!PANEL_COUNT[layout]) return;
  state.layout = layout;
  state.selected = 0;
  syncChoiceButtons();
  rebuildPanelControls();
  render();
}

function applyGrade(grade) {
  if (!GRADES[grade]) return;
  state.grade = grade;
  syncChoiceButtons();
  render();
}

/** Apply a full scene (used by ?shot=): layout, grade, words, size, photo set. */
async function setScene(scene) {
  if (scene.layout && PANEL_COUNT[scene.layout]) state.layout = scene.layout;
  if (scene.grade && GRADES[scene.grade]) state.grade = scene.grade;
  if (typeof scene.caption === 'string') {
    state.caption = scene.caption;
    captionInput.value = scene.caption;
  }
  if (typeof scene.subcaption === 'string') {
    state.subcaption = scene.subcaption;
    subcaptionInput.value = scene.subcaption;
  }
  if (scene.size) state.size = scene.size;
  state.selected = -1; // cover shots show no selection outline
  if (scene.photos) {
    const names = { 'samples/portrait.svg': 'Sunset portrait', 'samples/pier.jpg': 'Pier', 'samples/boulevard.jpg': 'Boulevard' };
    await setLibrary(scene.photos.map((src) => ({ name: names[src] ?? src, src })));
  }
  state.assignment = [0, 1, 2, 0];
  syncChoiceButtons();
  rebuildPanelControls();
  render();
}

// Exposed for the screenshot scenes (shots.js) and for the self-test.
window.__studio = { setScene, render, state };

// --- controls ---------------------------------------------------------------

document.querySelectorAll('.layout-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyLayout(btn.dataset.layout));
});
document.querySelectorAll('.grade-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyGrade(btn.dataset.grade));
});

captionInput.addEventListener('input', () => { state.caption = captionInput.value; render(); });
subcaptionInput.addEventListener('input', () => { state.subcaption = subcaptionInput.value; render(); });

document.getElementById('size').addEventListener('change', (event) => {
  const [w, h] = event.target.value.split('x').map(Number);
  state.size = { w, h };
  render();
});

document.getElementById('photos').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;
  const entries = files.map((file) => ({ name: file.name, src: URL.createObjectURL(file) }));
  const next = [...state.photos.map((p) => ({ name: p.name, src: p.src })), ...entries];
  await setLibrary(next);
  setStatus(`Added ${files.length} photo${files.length > 1 ? 's' : ''}.`);
  event.target.value = '';
});

document.getElementById('reset').addEventListener('click', async () => {
  await setLibrary(SAMPLES);
  setStatus('Sample photos restored.');
});

zoomInput.addEventListener('input', () => {
  state.zoom[state.selected] = Number(zoomInput.value);
  syncSliders();
  render();
});
panxInput.addEventListener('input', () => {
  state.panX[state.selected] = Number(panxInput.value);
  syncSliders();
  render();
});
panyInput.addEventListener('input', () => {
  state.panY[state.selected] = Number(panyInput.value);
  syncSliders();
  render();
});

document.getElementById('export').addEventListener('click', () => {
  const off = document.createElement('canvas');
  off.width = state.size.w;
  off.height = state.size.h;
  drawCover(off, engineState(-1));
  off.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed: the browser could not make a PNG.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sunset-cover-${state.size.w}x${state.size.h}.png`;
    a.click();
    setStatus(`Saved sunset-cover-${state.size.w}x${state.size.h}.png (${Math.round(blob.size / 1024)} KiB).`);
  }, 'image/png');
});

// --- canvas picking: click to select a panel, drag to pan, scroll to zoom ---

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

let dragging = false;
let lastPoint = null;

canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const polys = layoutPolygons(state.layout, canvas.width, canvas.height);
  const hit = polys.findIndex((poly) => pointInPoly(point.x, point.y, poly));
  if (hit >= 0) {
    state.selected = hit;
    syncSliders();
    render();
  }
  dragging = true;
  lastPoint = point;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragging || !lastPoint) return;
  const point = canvasPoint(event);
  const i = state.selected;
  const box = { w: canvas.width, h: canvas.height };
  state.panX[i] = Math.max(-0.4, Math.min(0.4, (state.panX[i] ?? 0) + (point.x - lastPoint.x) / box.w));
  state.panY[i] = Math.max(-0.4, Math.min(0.4, (state.panY[i] ?? 0) + (point.y - lastPoint.y) / box.h));
  lastPoint = point;
  syncSliders();
  render();
});

canvas.addEventListener('pointerup', () => { dragging = false; lastPoint = null; });
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const i = state.selected;
  const next = (state.zoom[i] ?? 1) * (1 - event.deltaY * 0.001);
  state.zoom[i] = Math.max(1, Math.min(3, next));
  syncSliders();
  render();
}, { passive: false });

// --- self-test: ?selftest=1 renders every export size headlessly and reports ---

async function runSelfTest() {
  const results = [];
  for (const size of EXPORT_SIZES) {
    const off = document.createElement('canvas');
    off.width = size.w;
    off.height = size.h;
    drawCover(off, engineState(-1));
    const url = off.toDataURL('image/png');
    results.push({ size: `${size.w}x${size.h}`, bytes: Math.round((url.length * 3) / 4), ok: url.length > 20000 });
  }
  const ok = results.every((r) => r.ok);
  window.__selftest = { ok, results };
  setStatus(ok
    ? `SELFTEST OK — ${results.map((r) => `${r.size} ${Math.round(r.bytes / 1024)} KiB`).join(', ')}`
    : 'SELFTEST FAIL — a render came back empty.');
  return ok;
}

// --- boot -------------------------------------------------------------------

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
syncChoiceButtons();
rebuildPanelControls();

if (shot) {
  await setLibrary(SAMPLES);
  await runShot(shot, query);
} else {
  await setLibrary(SAMPLES);
  render();
  if (query.get('selftest') === '1') {
    await runSelfTest();
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
