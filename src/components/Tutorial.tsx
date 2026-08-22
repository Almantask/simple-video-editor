import type { CSSProperties } from "react";
import { FilmIcon, WaveIcon } from "./Icons";

export function Tutorial() {
  return (
    <div className="tutorial" aria-label="How Loop works">
      <p className="sr-only">
        Drop a video clip and a music track. Loop merges them into a music video that plays until the song ends.
      </p>
      <div className="tutorial-stage" aria-hidden="true">
        <article className="tutorial-piece tutorial-video">
          <div className="tutorial-film">
            <span className="tutorial-sky" />
            <span className="tutorial-sun" />
            <span className="tutorial-hill tutorial-hill-a" />
            <span className="tutorial-hill tutorial-hill-b" />
          </div>
          <span className="tutorial-label">
            <FilmIcon className="size-3.5" />
            video
          </span>
        </article>

        <span className="tutorial-plus">+</span>

        <article className="tutorial-piece tutorial-audio">
          <div className="tutorial-wave">
            {Array.from({ length: 11 }, (_, i) => (
              <span key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </div>
          <span className="tutorial-label">
            <WaveIcon className="size-3.5" />
            music
          </span>
        </article>

        <div className="tutorial-burst">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="tutorial-spark" style={{ "--a": `${i * 30}deg` } as CSSProperties} />
          ))}
          <span className="tutorial-poof">poof</span>
        </div>

        <article className="tutorial-result">
          <div className="tutorial-film tutorial-film-loop">
            <span className="tutorial-sky" />
            <span className="tutorial-sun" />
            <span className="tutorial-hill tutorial-hill-a" />
            <span className="tutorial-hill tutorial-hill-b" />
            <span className="tutorial-bars">
              {Array.from({ length: 14 }, (_, i) => (
                <span key={i} style={{ "--i": i } as CSSProperties} />
              ))}
            </span>
            <span className="tutorial-lyric">until the song ends</span>
            <span className="tutorial-playhead" />
          </div>
          <span className="tutorial-label tutorial-label-result">your music video</span>
        </article>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        video <span className="text-accent">+</span> music <span className="text-accent">=</span> a looping clip
      </p>
    </div>
  );
}
