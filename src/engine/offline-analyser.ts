/** PCM → visualizer buffers for offline encode (no live AnalyserNode). */

export function fillAnalyserFromBuffer(
  buffer: AudioBuffer,
  timeSec: number,
  freqOut: Uint8Array,
  waveOut: Uint8Array,
): void {
  const { sampleRate, numberOfChannels, length } = buffer;
  const start = Math.min(Math.max(length - 1, 0), Math.max(0, Math.floor(timeSec * sampleRate)));
  const n = 512;
  const mixed = new Float32Array(n);
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < n; i++) {
      const index = start + i;
      if (index < length) mixed[i] += data[index];
    }
  }
  const inv = 1 / Math.max(1, numberOfChannels);
  for (let i = 0; i < n; i++) mixed[i] *= inv;

  const waveLen = waveOut.length;
  for (let i = 0; i < waveLen; i++) {
    const sample = mixed[Math.floor((i / Math.max(1, waveLen)) * n)] ?? 0;
    waveOut[i] = Math.max(0, Math.min(255, Math.round(128 + sample * 127)));
  }

  const bands = freqOut.length;
  for (let band = 0; band < bands; band++) {
    let re = 0;
    let im = 0;
    const k = 1 + band * 2;
    const omega = (2 * Math.PI * k) / n;
    for (let t = 0; t < n; t++) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * t) / Math.max(1, n - 1)));
      const sample = mixed[t] * window;
      re += sample * Math.cos(omega * t);
      im -= sample * Math.sin(omega * t);
    }
    const mag = Math.sqrt(re * re + im * im) * 6;
    freqOut[band] = Math.max(0, Math.min(255, Math.round(mag * 255)));
  }
}
