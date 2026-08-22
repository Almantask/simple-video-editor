import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function icon(props: IconProps) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function FilmIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 8h4M3 16h4M17 8h4M17 16h4" />
    </svg>
  );
}

export function WaveIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M3 12h2l2-6 3 12 3-8 2 4h6" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SkipBackIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M5 12v0" />
      <path d="M19 18V6l-9 6 9 6z" />
      <path d="M5 6v12" />
    </svg>
  );
}

export function SkipForwardIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M5 6l9 6-9 6V6z" />
      <path d="M19 6v12" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M12 4v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

export function MusicIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="16" r="2.5" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M4 5h12v14H4z" />
      <path d="M16 8h4v11H8" />
    </svg>
  );
}

export function SaveIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M5 5h11l3 3v11H5z" />
      <path d="M8 5v5h8V5" />
      <path d="M8 19v-6h8v6" />
    </svg>
  );
}
