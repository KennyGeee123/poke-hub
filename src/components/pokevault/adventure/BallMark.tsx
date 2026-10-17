import type { BallColors } from "@/lib/ball-catalog";

/** Small painted ball. Colors are the item's own top, bottom, band, and button. */
export function BallMark({ colors, size = 22 }: { colors: BallColors; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      data-ball-top={colors.top}
      data-ball-bottom={colors.bottom}
      className="shrink-0"
    >
      <circle cx="16" cy="16" r="15" fill={colors.bottom} />
      <path d="M1 16a15 15 0 0 1 30 0H1z" fill={colors.top} />
      <rect x="1" y="14.2" width="30" height="3.6" fill={colors.band} />
      <circle cx="16" cy="16" r="4.4" fill="#111" />
      <circle cx="16" cy="16" r="3.1" fill={colors.button} />
      <circle cx="16" cy="16" r="15" fill="none" stroke="#111" strokeWidth="1.6" />
    </svg>
  );
}
