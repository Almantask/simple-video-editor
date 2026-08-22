import type { FitMode } from "../types";

export function drawFitted(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  fit: FitMode,
): void {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const vw = video.videoWidth || cw;
  const vh = video.videoHeight || ch;
  const scale = fit === "cover" ? Math.max(cw / vw, ch / vh) : Math.min(cw / vw, ch / vh);
  const w = vw * scale;
  const h = vh * scale;
  const x = (cw - w) / 2;
  const y = (ch - h) / 2;
  ctx.drawImage(video, x, y, w, h);
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

export function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  color: string,
): void {
  const { width, height } = ctx.canvas;
  const size = Math.max(16, fontSize);
  ctx.save();
  ctx.font = `600 ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(3, size / 6);
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.fillStyle = color;
  const lines = wrapText(ctx, text, width * 0.86);
  const lineHeight = size * 1.2;
  const baseY = height - size * 0.9;
  lines.forEach((line, i) => {
    const y = baseY - (lines.length - 1 - i) * lineHeight;
    ctx.strokeText(line, width / 2, y);
    ctx.fillText(line, width / 2, y);
  });
  ctx.restore();
}
