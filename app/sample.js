// Sunset Cover Studio — the sample portrait.
// A synthetic sunset scene drawn entirely with vector shapes, wide enough
// that each poster panel can show a different slice of it: a palm on the
// left, a low sun in the middle, a city skyline across the bottom, and a
// person standing at the right. No real person's photo, no borrowed art.
// Deterministic: the same shapes on every run.

import { mulberry32 } from "./engine.js";

export function makeSamplePortrait(width = 1600, height = 1000) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const rand = mulberry32(77);

  // Sunset sky.
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.78);
  sky.addColorStop(0, "#2b1055");
  sky.addColorStop(0.45, "#b13a7a");
  sky.addColorStop(0.75, "#ff6a3d");
  sky.addColorStop(1, "#ffc46b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Low sun with a warm glow, left of centre.
  const sunX = width * 0.42;
  const sunY = height * 0.42;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, width * 0.3);
  glow.addColorStop(0, "rgba(255,214,120,0.95)");
  glow.addColorStop(0.35, "rgba(255,150,80,0.45)");
  glow.addColorStop(1, "rgba(255,150,80,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffe9a8";
  ctx.beginPath();
  ctx.arc(sunX, sunY, width * 0.055, 0, Math.PI * 2);
  ctx.fill();

  // A few birds high in the sky.
  ctx.strokeStyle = "rgba(30,8,50,0.85)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (let b = 0; b < 5; b++) {
    const bx = width * (0.6 + rand() * 0.3);
    const by = height * (0.12 + rand() * 0.14);
    const span = 14 + rand() * 16;
    ctx.beginPath();
    ctx.moveTo(bx - span, by);
    ctx.quadraticCurveTo(bx - span * 0.4, by - 9, bx, by);
    ctx.quadraticCurveTo(bx + span * 0.4, by - 9, bx + span, by);
    ctx.stroke();
  }

  // City skyline, dark against the sunset, with lit windows.
  const base = height * 0.78;
  let x = 0;
  while (x < width) {
    const bw = width * (0.04 + rand() * 0.06);
    const bh = height * (0.08 + rand() * 0.15);
    ctx.fillStyle = "#1c0b33";
    ctx.fillRect(x, base - bh, bw, bh + height);
    ctx.fillStyle = "#ffd76a";
    for (let w = 0; w < 5; w++) {
      if (rand() > 0.5) {
        ctx.fillRect(x + bw * (0.15 + rand() * 0.6), base - bh + bh * (0.15 + rand() * 0.6), 5, 7);
      }
    }
    x += bw + width * 0.008;
  }

  // Palm tree silhouette on the far left.
  ctx.strokeStyle = "#160826";
  ctx.lineWidth = width * 0.014;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(width * 0.07, height);
  ctx.quadraticCurveTo(width * 0.09, height * 0.62, width * 0.14, height * 0.42);
  ctx.stroke();
  ctx.lineWidth = width * 0.009;
  for (let f = 0; f < 7; f++) {
    const a = (-Math.PI / 7) * f - 0.15;
    const fx = width * 0.14 + Math.cos(a) * width * 0.11;
    const fy = height * 0.42 + Math.sin(a) * height * 0.12 - Math.abs(f - 3) * height * 0.01;
    ctx.beginPath();
    ctx.moveTo(width * 0.14, height * 0.42);
    ctx.quadraticCurveTo(width * 0.14 + (fx - width * 0.14) * 0.6, fy - height * 0.07, fx, fy + height * 0.05);
    ctx.stroke();
  }

  // Person standing at the right: head and shoulders in silhouette,
  // rim-lit on the sun side, small enough that the sky stays the star.
  const px = width * 0.8;
  const py = height * 0.6;
  ctx.fillStyle = "#160826";
  ctx.beginPath();
  ctx.ellipse(px, height * 1.05, width * 0.16, height * 0.34, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px, py, width * 0.055, 0, Math.PI * 2);
  ctx.fill();
  // Hair sweep.
  ctx.beginPath();
  ctx.arc(px - width * 0.008, py - height * 0.012, width * 0.057, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();
  // Warm rim light on the sun side of the head and shoulder.
  ctx.strokeStyle = "rgba(255,190,90,0.9)";
  ctx.lineWidth = width * 0.005;
  ctx.beginPath();
  ctx.arc(px, py, width * 0.055, -Math.PI * 0.5, Math.PI * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(px, height * 1.05, width * 0.16, height * 0.34, 0, Math.PI * 1.1, Math.PI * 1.5);
  ctx.stroke();
  // Gold chain.
  ctx.strokeStyle = "#ffd76a";
  ctx.lineWidth = width * 0.003;
  ctx.beginPath();
  ctx.arc(px, height * 0.82, width * 0.05, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  return canvas;
}
