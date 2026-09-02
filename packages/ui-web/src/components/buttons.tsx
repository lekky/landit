'use client';

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

import { foregroundFor } from '../contrast';
import { cx } from '../cx';

/**
 * The three loud controls: `.btn`, `.pill`, `.tag`.
 *
 * The press behaviour is the design's signature and lives in CSS, not here:
 * hover lifts the button `-1px,-1px` and grows the shadow to `5px 5px`, and
 * `:active` pushes it to `2px,2px` with the shadow dropping to `1px 1px`.
 */

export type ButtonVariant = 'primary' | 'ghost' | 'ink';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Orange (default), paper, or ink. */
  variant?: ButtonVariant;
  /** `sm` is the 13px button used inside panels and rows. */
  size?: 'md' | 'sm';
  /** Full width, centred label. */
  wide?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  wide = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'btn',
        variant === 'ghost' && 'ghost',
        variant === 'ink' && 'ink',
        size === 'sm' && 'sm',
        wide && 'wide',
        className,
      )}
      {...rest}
    />
  );
}

export type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Selected: inverts to ink. */
  on?: boolean;
};

/** Filter chip. Used for categories, difficulty tiers, status and sorts. */
export function Pill({ on = false, className, type = 'button', ...rest }: PillProps) {
  return (
    <button type={type} aria-pressed={on} className={cx('pill', on && 'on', className)} {...rest} />
  );
}

export type TagProps = {
  children: ReactNode;
  /** Background colour. Category colours, stage colours, plan hues. */
  color?: string;
  /** The 2.5° rotation used on trick cards. */
  tilt?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * Small uppercase label on a solid colour, with a 1.5px hard shadow.
 *
 * When `color` is a hex fill the tag picks its own foreground, because the
 * stylesheet's `#fff` clears 4.5:1 on only two of the ten accents and these
 * labels are 11px. A `var(--x)` fill cannot be measured here, so it keeps the
 * stylesheet's default and nothing an existing caller renders changes; an
 * explicit `style.color` still wins over both.
 */
/*
 * A fill named by a surface token flips with the theme - `var(--ink)` is black
 * in the light and cream in the dark - so its foreground must flip the other
 * way, and `foregroundFor` (hex only) cannot see that. This is the map for the
 * surface fills a Tag is given; a fixed accent such as `var(--violet)` is not
 * here and keeps the stylesheet's `--on-dark`.
 */
const SURFACE_FILL_FG: Readonly<Record<string, string>> = {
  'var(--ink)': 'var(--paper)',
  'var(--ink-2)': 'var(--paper)',
  'var(--ink-3)': 'var(--paper)',
  'var(--paper)': 'var(--ink)',
  'var(--paper-2)': 'var(--ink)',
  'var(--wash)': 'var(--ink)',
};

export function Tag({ children, color, tilt = false, className, style }: TagProps) {
  const fg =
    foregroundFor(color) ?? (color ? SURFACE_FILL_FG[color.replace(/\s+/g, '')] : undefined);
  return (
    <span
      className={cx('tag', tilt && 'tilt', className)}
      style={{
        ...(color ? { background: color } : null),
        ...(fg ? { color: fg } : null),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
