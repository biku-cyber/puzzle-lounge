export function PuzzleLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="drop-shadow-[0_0_20px_oklch(0.82_0.16_80/0.45)]">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.92 0.05 85)" />
          <stop offset="100%" stopColor="oklch(0.7 0.18 55)" />
        </linearGradient>
      </defs>
      <g style={{ transformOrigin: "32px 32px", animation: "spin 28s linear infinite" }}>
        <path
          d="M22 6 h12 a4 4 0 0 1 4 4 v8 a4 4 0 0 0 4 4 h8 a4 4 0 0 1 4 4 v12 a4 4 0 0 1 -4 4 h-8 a4 4 0 0 0 -4 4 v8 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4 v-8 a4 4 0 0 0 -4 -4 h-8 a4 4 0 0 1 -4 -4 v-12 a4 4 0 0 1 4 -4 h8 a4 4 0 0 0 4 -4 v-8 a4 4 0 0 1 4 -4 z"
          fill="url(#lg)"
        />
      </g>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
