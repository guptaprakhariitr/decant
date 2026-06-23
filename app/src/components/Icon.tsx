// Inline SVG icon set (Lucide-style, 24×24, stroke = currentColor). Fully offline /
// CSP-safe — no icon font, no CDN. Stroke icons read as "normal app icons", not emoji.

type Props = { name: IconName; size?: number; className?: string; strokeWidth?: number };

const P: Record<string, JSX.Element> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
  sliders: <><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>,
  unlock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 7.5-2" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  alert: <><path d="M12 3.5 22 19.5H2L12 3.5Z" /><path d="M12 10v4.5M12 17.5h.01" /></>,
  dash: <><circle cx="12" cy="12" r="9" /><path d="M8.5 12h7" /></>,
  link: <><path d="M9.5 14.5 14.5 9.5" /><path d="M11 7l1.5-1.5a3.5 3.5 0 0 1 5 5L16 12" /><path d="M13 17l-1.5 1.5a3.5 3.5 0 0 1-5-5L8 12" /></>,
  upload: <><path d="M12 15V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  file: <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M13 3v5h5" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></>,
  chevron: <><path d="m6 9 6 6 6-6" /></>,
  inbox: <><path d="M4 13h4l1.5 3h5L16 13h4" /><path d="M4 13 6.5 5h11L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z" /></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></>,
  box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
  cursor: <><path d="m5 4 14 7-6 1.5L10 19 5 4Z" /></>,
  key: <><circle cx="8" cy="14" r="4" /><path d="m11 11 8-8M16.5 5.5 19 8M14 8l2 2" /></>,
  cpu: <><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3" /></>,
  flask: <><path d="M9 3h6M10 3v6l-5 9a1.5 1.5 0 0 0 1.3 2.3h11.4A1.5 1.5 0 0 0 19 18l-5-9V3" /><path d="M7.5 14h9" /></>,
  refresh: <><path d="M4 11a8 8 0 0 1 13.5-4.5L20 9" /><path d="M20 4v5h-5" /><path d="M20 13a8 8 0 0 1-13.5 4.5L4 15" /><path d="M4 20v-5h5" /></>,
  download: <><path d="M12 4v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4 20h16" /></>,
  arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
  fit: <><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" /></>,
  trash: <><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  back: <><path d="M15 6l-6 6 6 6" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.4 2.4 0 1 1 3.6 2.1c-.8.5-1.2.9-1.2 1.8" /><path d="M12 17h.01" /></>,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 18, className, strokeWidth = 1.75 }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}
