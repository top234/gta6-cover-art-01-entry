// Fixed scenes for screenshots: ?shot=cover shows the cover alone (the canvas fills the
// viewport), ?shot=editor shows the editor with the sample photos loaded.
// Query knobs: layout, grade, caption, subcaption, size (WxH), photos (comma list of
// portrait,pier,boulevard). window.__shotReady is set once the scene has painted.

const SAMPLE_FILES = {
  portrait: 'samples/portrait.svg',
  pier: 'samples/pier.jpg',
  boulevard: 'samples/boulevard.jpg',
};

function parseSize(raw, fallback) {
  const match = /^(\d{3,4})x(\d{3,4})$/.exec(raw ?? '');
  if (!match) return fallback;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (w < 200 || h < 200 || w > 4000 || h > 4000) return fallback;
  return { w, h };
}

/** Apply a shot scene through the studio API the page exposes as window.__studio. */
export async function runShot(shot, query) {
  const studio = window.__studio;
  if (!studio) return;
  const photos = (query.get('photos') ?? 'portrait,pier,boulevard')
    .split(',')
    .map((name) => SAMPLE_FILES[name.trim()] ?? SAMPLE_FILES.portrait);
  const size = parseSize(query.get('size'), { w: 1080, h: 1080 });
  const scene = {
    layout: query.get('layout') ?? 'three',
    grade: query.get('grade') ?? 'sunset',
    caption: query.get('caption') ?? 'Sunset Heist',
    subcaption: query.get('subcaption') ?? 'Vice City • 2026',
    size,
    photos,
  };
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await studio.setScene(scene);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
