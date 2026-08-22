# Loop — in-browser music video maker

[![CI](https://github.com/Almantask/simple-video-editor/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Almantask/simple-video-editor/actions/workflows/ci.yml)
[![CD](https://github.com/Almantask/simple-video-editor/actions/workflows/cd.yml/badge.svg?branch=main)](https://github.com/Almantask/simple-video-editor/actions/workflows/cd.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-22D3EE?logo=github&logoColor=white)](https://almantask.github.io/simple-video-editor/)
[![Release](https://img.shields.io/github/v/release/Almantask/simple-video-editor?display_name=tag)](https://github.com/Almantask/simple-video-editor/releases)

A static website that turns a video clip and a music file into a music video. The picture loops until the song ends. You can speed up or slow down the video on selected intervals, overlay lyrics, and add a sound visualizer. Export records the composition in the browser and downloads an MP4 (Chrome, Edge, Safari) or WebM file.

Files never leave this tab. There is no server.

## Develop

```bash
npm install
npm run dev
```

Open the printed local URL (Vite, usually `http://localhost:5173`).

## Build a static site

```bash
npm run build
```

This writes a self-contained `dist/` folder of HTML, CSS, and JS. Host it on GitHub Pages, Netlify, or any static file server. Paths are relative (`base: './'`), so the site also works from a subfolder.

Preview the production build:

```bash
npm run preview
```

## GitHub Pages

CI runs `npm ci` and `npm run build` on pull requests and on `main`. CD deploys `dist/` to GitHub Pages from `main`.

1. In the GitHub repo, open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` (or run the **CD** workflow). The first deploy may ask you to approve the `github-pages` environment.

The site will be at `https://almantask.github.io/simple-video-editor/`. Vite uses relative asset paths (`base: './'`), so it also works if the Pages URL is a project subpath.

## Release notes

User-facing changes live in [CHANGELOG.md](CHANGELOG.md). Pushing a `v*.*.*` tag (or running the **Release** workflow) publishes that version’s changelog section as a [GitHub Release](https://github.com/Almantask/simple-video-editor/releases).

```bash
git tag v1.0.0
git push origin v1.0.0
```

The tagged version must already have a matching `## [1.0.0]` heading in the changelog.

## How to use

1. Drop a video (MP4, WebM, MOV) and a music file (MP3, WAV, FLAC, M4A).
2. The studio opens when both files are ready.
3. Play with Space. Click-drag the timeline to add a speed change (0.25x–4x). Speed affects the picture only; the music stays at 1x.
4. Optional: upload an LRC or SRT file, or use lyrics embedded in the audio (ID3 SYLT / LRC-style USLT).
5. Optional: pick a visualizer (bars, waveform, ring) and colors.
6. Export at 720p or 1080p. Keep the tab in the foreground — recording is real time (a 3-minute song takes about 3 minutes).

## Notes

- Video speed ramps do not change the music.
- Background tabs throttle `requestAnimationFrame`, which can stall or glitch an export.
- Codec support depends on the browser. If a file will not decode, try MP4 + AAC/MP3.
