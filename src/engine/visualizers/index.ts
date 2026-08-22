import type { VisualizerId } from "../../types";

export function maxValue(data: Uint8Array): number {
  let max = 0;
  for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
  return max;
}

export function drawBars(ctx: CanvasRenderingContext2D, freq: Uint8Array, color: string): void {
  const { width, height } = ctx.canvas;
  const count = Math.min(72, freq.length);
  const gap = 2;
  const barW = Math.max(2, (width - gap * count) / count);
  const maxH = height * 0.38;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const value = freq[Math.floor((i / count) * freq.length * 0.7)] / 255;
    const h = Math.max(2, value * maxH);
    const x = i * (barW + gap);
    const y = height - h - height * 0.04;
    ctx.globalAlpha = 0.35 + value * 0.65;
    ctx.fillRect(x, y, barW, h);
  }
}

export function drawWave(ctx: CanvasRenderingContext2D, time: Uint8Array, color: string): void {
  const { width, height } = ctx.canvas;
  const mid = height / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, height / 240);
  ctx.beginPath();
  for (let i = 0; i < time.length; i++) {
    const x = (i / (time.length - 1)) * width;
    const y = mid + ((time[i] - 128) / 128) * height * 0.22;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < time.length; i++) {
    const x = (i / (time.length - 1)) * width;
    const y = mid - ((time[i] - 128) / 128) * height * 0.22;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function drawRing(ctx: CanvasRenderingContext2D, freq: Uint8Array, color: string): void {
  const { width, height } = ctx.canvas;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.18;
  const bars = Math.min(96, freq.length);
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let i = 0; i < bars; i++) {
    const value = freq[Math.floor((i / bars) * freq.length * 0.6)] / 255;
    const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
    const inner = radius;
    const outer = radius + value * Math.min(width, height) * 0.16;
    ctx.globalAlpha = 0.3 + value * 0.7;
    ctx.lineWidth = Math.max(2, (Math.PI * 2 * radius) / bars - 2);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }
}

export function syntheticAnalyser(now: number): { freq: Uint8Array; time: Uint8Array } {
  const freq = new Uint8Array(64);
  const time = new Uint8Array(256);
  for (let i = 0; i < freq.length; i++) {
    freq[i] = Math.max(8, 48 + Math.sin(now / 420 + i * 0.28) * 36 + (64 - i) * 0.6);
  }
  for (let i = 0; i < time.length; i++) {
    time[i] = 128 + Math.sin(now / 280 + i * 0.09) * 42;
  }
  return { freq, time };
}

export function drawVisualizer(
  ctx: CanvasRenderingContext2D,
  id: VisualizerId,
  freq: Uint8Array,
  time: Uint8Array,
  color: string,
  opacity: number,
): void {
  if (id === "none" || opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  if (id === "bars") drawBars(ctx, freq, color);
  if (id === "wave") drawWave(ctx, time, color);
  if (id === "ring") drawRing(ctx, freq, color);
  ctx.restore();
}

export function drawVisualizerCard(
  ctx: CanvasRenderingContext2D,
  id: VisualizerId,
  freq: Uint8Array,
  time: Uint8Array,
  color: string,
  now: number,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#090A0F";
  ctx.fillRect(0, 0, width, height);
  if (id === "none") {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "500 12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No overlay", width / 2, height / 2);
    return;
  }
  const silent = maxValue(freq) < 10;
  const sample = silent ? syntheticAnalyser(now) : { freq, time };
  drawVisualizer(ctx, id, sample.freq, sample.time, color, 1);
}
