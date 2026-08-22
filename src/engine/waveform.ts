export async function computePeaks(source: Blob | ArrayBuffer, buckets = 900): Promise<Float32Array> {
  const ctx = new AudioContext();
  try {
    const bytes = source instanceof ArrayBuffer ? source : await source.arrayBuffer();
    const audio = await ctx.decodeAudioData(bytes);
    const data = audio.getChannelData(0);
    const peaks = new Float32Array(buckets);
    const samplesPerBucket = Math.max(1, Math.floor(data.length / buckets));
    for (let i = 0; i < buckets; i++) {
      let max = 0;
      const start = i * samplesPerBucket;
      const end = Math.min(data.length, start + samplesPerBucket);
      for (let j = start; j < end; j += 8) {
        const v = Math.abs(data[j] ?? 0);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    return peaks;
  } finally {
    await ctx.close();
  }
}

export function drawPeaks(
  ctx: CanvasRenderingContext2D,
  peaks: Float32Array | undefined,
  color = "rgba(255,255,255,0.18)",
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (!peaks || peaks.length === 0) return;
  const mid = height / 2;
  ctx.fillStyle = color;
  for (let x = 0; x < width; x++) {
    const index = Math.min(peaks.length - 1, Math.floor((x / width) * peaks.length));
    const amp = Math.max(1, peaks[index] * (mid - 1));
    ctx.fillRect(x, mid - amp, 1, amp * 2);
  }
}
