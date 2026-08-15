'use client';

import type { CSSProperties } from 'react';

import { cx } from '../cx';

/**
 * Everything that shows a quantity: difficulty bars, progress bars, the
 * onboarding step bar, and the stage dot.
 */

export type DifficultyProps = {
  /** 1–5. Anything outside that clamps. */
  value: number;
  /** The 9×8px version used on trick cards. */
  small?: boolean;
  /** Screen-reader/hover text. Defaults to "Difficulty n / 5". */
  title?: string;
};

/** Five skewed parallelograms; the first `value` of them fill with ink. */
export function Difficulty({ value, small = false, title }: DifficultyProps) {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className={cx('diff', small && 'sm')} title={title ?? `Difficulty ${n} / 5`}>
      {[0, 1, 2, 3, 4].map((k) => (
        <i key={k} className={k < n ? 'on' : ''} />
      ))}
    </div>
  );
}

export type BarProps = {
  /** 0–100. Clamped. */
  pct: number;
  /** Fill colour. Lime is the default "landed" colour. */
  color?: string;
  /** Height in px. */
  height?: number;
  className?: string;
  style?: CSSProperties;
};

/** Progress bar. The fill animates over 0.5s, which is in the CSS. */
export function Bar({ pct, color = 'var(--lime)', height = 16, className, style }: BarProps) {
  return (
    <div className={cx('bar', className)} style={{ height, ...style }}>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

export type SegmentedProgressProps = {
  /** How many segments in total. */
  steps: number;
  /** Zero-based index of the current step. Everything up to it fills yellow. */
  current: number;
  /** Accessible name, e.g. "Onboarding progress". */
  label?: string;
};

/** The onboarding step bar: one ink-keylined segment per step. */
export function SegmentedProgress({ steps, current, label }: SegmentedProgressProps) {
  return (
    <div
      className="segbar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={steps}
      aria-valuenow={Math.min(steps, current + 1)}
    >
      {Array.from({ length: steps }, (_, i) => (
        <i key={i} className={i <= current ? 'on' : ''} />
      ))}
    </div>
  );
}

export type StageDotProps = {
  /** Fill colour. Leave unset for the hollow "not tracked" dot. */
  color?: string;
  /** Keyline colour. Defaults to the fill, or ink-3 when hollow. */
  ring?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * The 11px circle on a trick card's footer strip. One of two places in the
 * whole design with a border radius (the other is avatars).
 */
export function StageDot({ color, ring, className, style }: StageDotProps) {
  return (
    <span
      className={cx('dot', className)}
      style={{
        background: color ?? 'transparent',
        borderColor: ring ?? color ?? 'var(--ink-3)',
        ...style,
      }}
    />
  );
}
