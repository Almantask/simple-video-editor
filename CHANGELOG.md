# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-08-22

First public release of **Loop**, an in-browser music video maker. Everything runs in the tab; files never leave the machine.

### Added

- Landing ingest with drag-and-drop video and music cards, duration/metadata, thumbnails, and replace-on-hover
- Studio editor: preview canvas, floating transport, inspector (Speed / Lyrics / Visual / Export), and full-width timeline
- Video loops for the full length of the music track; playback stops when the audio ends
- Non-overlapping speed intervals on the audio timeline (0.25x-4x) with click-drag create, edge resize, move, presets, and delete
- Keyboard transport: Space, arrow seek +/- 5s, Home/End
- Lyrics overlay from LRC/SRT uploads, plus ID3 embedded lyrics (SYLT or LRC-style USLT)
- Sound visualizers: none, frequency bars, mirrored waveform, radial ring, with color and opacity
- Real-time MediaRecorder export at 720p or 1080p (contain or cover), MP4 when the browser supports it, otherwise WebM
- Export progress, cancel, keep-tab-foreground warning, and a download modal with poster frame
- GitHub Actions CI (`npm ci` + production build) on pull requests and `main`
- GitHub Actions CD that publishes `dist/` to GitHub Pages from `main`

### Notes

- Video speed ramps do not change the music
- Export is real time (a 3-minute song takes about 3 minutes) and the tab must stay in the foreground

[Unreleased]: https://github.com/Almantask/simple-video-editor/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Almantask/simple-video-editor/releases/tag/v1.0.0
