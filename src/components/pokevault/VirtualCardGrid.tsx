import { type ReactNode } from "react";

type Props<T> = {
  items: T[];
  /** Stable key per item */
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Approx row height for scroll windowing (card + gap). */
  estimateHeight?: number;
  /** Columns hint for window math; CSS grid still decides layout. */
  minColWidth?: number;
  className?: string;
  /** Below this count, render everything (no window). */
  windowAbove?: number;
};

/** Card grid. Renders every item — windowing hid cards below the fold. */
export function VirtualCardGrid<T>({
  items,
  getKey,
  renderItem,
  className = "pv-card-grid",
}: Props<T>) {
  return (
    <div className={className}>
      {items.map((item) => (
        <div key={getKey(item)} className="pv-virt-cell">
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}
