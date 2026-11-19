// Sunset Cover Studio — page wiring.
// Loads the sample portrait by default, wires every control to a live
// preview, exports the finished cover as a PNG, and answers two headless
// modes: ?shot=<scene> renders one demo scene full-screen for screenshots,
// and ?selftest=1 renders a cover off-screen and reports success.

import { drawCover, panelPolygons, pointInPolygon } from "./engine.js";
import { makeSamplePortrait } from "./sample.js";
import { SCENES } from "./scenes.js";

const EXPORT_SIZES = {
  "1080x1080": [1080, 1080],
  "1080x1350": [1080, 1350],
  "1920x1080": [1920, 1080],
};

const state = {
  photos: [],
  assignments: [0, 0, 0, 0],
  layout: "trio",
  grade: "sunset",
  title: "SUNSET HEIST",
  subtitle: "VICE CITY",
  size: "1080x1080",
  crops: [],
  selected: 0,
};

const canvas = document.getElementById("cover");
const thumbsEl = document.getElementById("thumbs");
const noteEl = document.getElementById("exportNote");
const hintEl = document.getElementById("panelHint");

function defaultCrops(count) {
  return Array.from({ length: count }, () => ({ zoom: 1, panX: 0, panY: 0 }));
}

// Spread one wide photo across the panels: each panel shows a different
// slice of it, like the different scenes of a poster. The offsets are in
// 1080-reference pixels and were tuned against the sample scene's palm
// (left), sun (middle) and person (right) so each panel lands on one.
function spreadCrops(count) {
  const byCount = {
    1: [0],
    2: [-260, 260],
    3: [-560, -40, 560],
    4: [800, 180, -450, -650],
  };
  const offsets = byCount[count] || byCount[3];
  return offsets.map((panX) => ({ zoom: 1.15, panX, panY: 0 }));
}

function panelCount() {
  return state.layout === "duo" ? 2 : state.layout === "quad" ? 4 : state.layout === "solo" ? 1 : 3;
}

function ensureCrops() {
  const n = panelCount();
  while (state.crops.length < n) state.crops.push({ zoom: 1, panX: 0, panY: 0 });
  state.crops.length = n;
  if (state.selected >= n) state.selected = 0;
}

function previewSize() {
  const [w, h] = EXPORT_SIZES[state.size];
  return [w, h];
}

function render() {
  ensureCrops();
  const [w, h] = previewSize();
  const panelPhotos = Array.from({ length: panelCount() }, (_, i) => {
    return state.photos[state.assignments[i] % state.photos.length];
  });
  drawCover(canvas, {
    photos: panelPhotos,
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    width: w,
    height: h,
    crops: state.crops,
    selected: state.selected,
  });
}

function refreshThumbs() {
  thumbsEl.innerHTML = "";
  state.photos.forEach((photo, i) => {
    const img = document.createElement("img");
    img.src = photo.toDataURL ? photo.toDataURL("image/png") : photo.src;
    img.alt = "Photo " + (i + 1);
    img.title = "Put this photo in panel " + (state.selected + 1);
    if (i === state.assignments[state.selected]) img.classList.add("selected");
    img.addEventListener("click", () => {
      state.assignments[state.selected] = i;
      refreshThumbs();
      render();
    });
    thumbsEl.appendChild(img);
  });
}

function bindButtons(rowId, attr, apply) {
  const row = document.getElementById(rowId);
  row.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      row.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      apply(btn.dataset[attr]);
      render();
    });
  });
}

function loadUserPhotos(files) {
  const readers = [...files].map((file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = reader.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  });
  Promise.all(readers).then((imgs) => {
    const good = imgs.filter(Boolean);
    if (!good.length) {
      noteEl.textContent = "That file could not be read as a photo.";
      return;
    }
    state.photos.push(...good);
    noteEl.textContent = good.length + " photo(s) added.";
    refreshThumbs();
    render();
  });
}

function exportPng() {
  const [w, h] = EXPORT_SIZES[state.size];
  const off = document.createElement("canvas");
  const panelPhotos = Array.from({ length: panelCount() }, (_, i) => {
    return state.photos[state.assignments[i] % state.photos.length];
  });
  drawCover(off, {
    photos: panelPhotos,
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    width: w,
    height: h,
    crops: state.crops,
  });
  off.toBlob((blob) => {
    if (!blob) {
      noteEl.textContent = "Export failed: the browser could not make the PNG.";
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sunset-cover-" + state.size + ".png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    noteEl.textContent = "Exported " + w + " × " + h + " PNG.";
  }, "image/png");
}

// Clicking the preview picks the panel under the pointer for cropping.
canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const polys = panelPolygons(state.layout, canvas.width, canvas.height);
  for (let i = 0; i < polys.length; i++) {
    if (pointInPolygon(x, y, polys[i])) {
      state.selected = i;
      hintEl.textContent = "Panel " + (i + 1) + " selected — crop it with the sliders.";
      syncCropInputs();
      return;
    }
  }
});

function syncCropInputs() {
  const crop = state.crops[state.selected] || { zoom: 1, panX: 0, panY: 0 };
  document.getElementById("zoomInput").value = crop.zoom;
  document.getElementById("panXInput").value = crop.panX;
  document.getElementById("panYInput").value = crop.panY;
}

function bindCrop() {
  const zoom = document.getElementById("zoomInput");
  const panX = document.getElementById("panXInput");
  const panY = document.getElementById("panYInput");
  const update = () => {
    ensureCrops();
    state.crops[state.selected] = {
      zoom: parseFloat(zoom.value),
      panX: parseFloat(panX.value),
      panY: parseFloat(panY.value),
    };
    render();
  };
  zoom.addEventListener("input", update);
  panX.addEventListener("input", update);
  panY.addEventListener("input", update);
}

function bootEditor() {
  state.photos = [makeSamplePortrait()];
  state.assignments = [0, 0, 0, 0];
  state.crops = spreadCrops(3);
  bindButtons("layoutRow", "layout", (v) => {
    state.layout = v;
  });
  bindButtons("gradeRow", "grade", (v) => {
    state.grade = v;
  });
  bindButtons("sizeRow", "size", (v) => {
    state.size = v;
  });
  document.getElementById("photoInput").addEventListener("change", (e) => {
    loadUserPhotos(e.target.files);
  });
  document.getElementById("titleInput").addEventListener("input", (e) => {
    state.title = e.target.value;
    render();
  });
  document.getElementById("subtitleInput").addEventListener("input", (e) => {
    state.subtitle = e.target.value;
    render();
  });
  document.getElementById("exportBtn").addEventListener("click", exportPng);
  bindCrop();
  refreshThumbs();
  syncCropInputs();
  render();
}

// Headless screenshot mode: one demo scene, full screen, no editor chrome.
function bootShot(sceneName) {
  const scene = SCENES[sceneName];
  if (!scene) {
    document.title = "SHOT FAIL: unknown scene";
    return;
  }
  document.body.classList.add("shot-mode");
  const sample = makeSamplePortrait();
  const panelCount = scene.layout === "duo" ? 2 : scene.layout === "quad" ? 4 : scene.layout === "solo" ? 1 : 3;
  // Size the canvas in exact pixels, not viewport units: in headless
  // Chrome the layout viewport is shorter than the window, so 100vh
  // would leave a black band at the bottom of the screenshot.
  canvas.style.width = scene.width + "px";
  canvas.style.height = scene.height + "px";
  drawCover(canvas, {
    photos: [sample],
    layout: scene.layout,
    grade: scene.grade,
    title: scene.title,
    subtitle: scene.subtitle,
    width: scene.width,
    height: scene.height,
    crops: spreadCrops(panelCount),
  });
  document.title = "SHOT OK " + sceneName;
}

// Headless self-test: render a cover off-screen and report success.
function bootSelfTest() {
  const off = document.createElement("canvas");
  const sample = makeSamplePortrait();
  drawCover(off, {
    photos: [sample],
    layout: "trio",
    grade: "sunset",
    title: "SELF TEST",
    subtitle: "VICE CITY",
    width: 1080,
    height: 1080,
    crops: defaultCrops(3),
  });
  const ctx = off.getContext("2d");
  const data = ctx.getImageData(0, 0, 1080, 1080).data;
  let sum = 0;
  let distinct = new Set();
  for (let i = 0; i < data.length; i += 400) {
    sum += data[i] + data[i + 1] + data[i + 2];
    distinct.add((data[i] >> 4) + "," + (data[i + 1] >> 4) + "," + (data[i + 2] >> 4));
  }
  const ok = sum > 0 && distinct.size > 50;
  window.__selftest = { ok, distinctColors: distinct.size, pixelSum: sum };
  document.title = ok ? "SELFTEST OK" : "SELFTEST FAIL";
  document.body.dataset.selftest = ok ? "ok" : "fail";
  bootEditor();
}

const params = new URLSearchParams(location.search);
if (params.has("shot")) bootShot(params.get("shot"));
else if (params.has("selftest")) bootSelfTest();
else bootEditor();
