// Sunset Cover Studio — named demo scenes.
// Each scene is a ready-made cover the app can render headlessly, used for
// the screenshots. The sample portrait fills every panel.

export const SCENES = {
  "sunset-square": {
    layout: "trio",
    grade: "sunset",
    title: "SUNSET HEIST",
    subtitle: "VICE CITY",
    width: 1080,
    height: 1080,
  },
  "neon-wide": {
    layout: "duo",
    grade: "neon",
    title: "NEON NIGHTS",
    subtitle: "AFTER DARK",
    width: 1280,
    height: 720,
  },
  "gold-tall": {
    layout: "quad",
    grade: "gold",
    title: "GOLDEN HOUR",
    subtitle: "LAST LIGHT",
    width: 1024,
    height: 1280,
  },
};

export function sceneNames() {
  return Object.keys(SCENES);
}
