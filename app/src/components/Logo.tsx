// Decant brand mark — the funnel-pouring-into-rows glyph on the violet→teal squircle, inline SVG
// (matches the app icon). Used in the rail instead of a plain "D".
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-label="Decant" role="img">
      <defs>
        <linearGradient id="decant-lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#4FB6CE" />
        </linearGradient>
      </defs>
      <rect x="48" y="48" width="928" height="928" rx="232" ry="232" fill="url(#decant-lg)" />
      <g fill="#ffffff">
        <polygon points="320,320 704,320 568,484 568,576 456,576 456,484" fillOpacity="0.97" />
        <rect x="486" y="576" width="52" height="44" rx="10" fillOpacity="0.97" />
        <rect x="404" y="648" width="216" height="40" rx="20" fillOpacity="0.92" />
        <rect x="430" y="708" width="164" height="40" rx="20" fillOpacity="0.66" />
      </g>
    </svg>
  );
}
