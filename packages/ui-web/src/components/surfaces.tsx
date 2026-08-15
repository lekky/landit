'use client';

import type { CSSProperties, ReactNode } from 'react';

import { cx } from '../cx';
import { Icon, type IconName } from '../icons';
import { Button } from './buttons';

/**
 * Panels and the furniture that sits on them: the section head with its rule,
 * the empty state, and the hatched photo placeholder.
 */

export type PanelProps = {
  children: ReactNode;
  /** Drops the 5px shadow to 3px. */
  flat?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** Paper, 3px ink keyline, hard offset shadow. The base surface. */
export function Panel({ children, flat = false, className, style }: PanelProps) {
  return (
    <div className={cx('panel', flat && 'flat', className)} style={style}>
      {children}
    </div>
  );
}

export type SectionHeadProps = {
  children: ReactNode;
  /** Label for the optional link on the right. */
  more?: string;
  onMore?: () => void;
};

/** Anton heading, a 3px rule filling the row, and an optional "more" link. */
export function SectionHead({ children, more, onMore }: SectionHeadProps) {
  return (
    <div className="sechead">
      <h2>{children}</h2>
      <span className="rule" />
      {more && (
        <button type="button" className="more" onClick={onMore}>
          {more}
        </button>
      )}
    </div>
  );
}

export type SlotProps = {
  /** Monospaced-feeling caption saying what belongs here. */
  label: ReactNode;
  /** Minimum height in px. */
  minHeight?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Photo placeholder. Every image in the design is one of these until real
 * photography exists — a dashed ink-3 keyline over a 135° hatch.
 */
export function Slot({ label, minHeight = 100, className, style }: SlotProps) {
  return (
    <div className={cx('slot', className)} style={{ minHeight, ...style }}>
      <span>{label}</span>
    </div>
  );
}

export type EmptyProps = {
  icon: IconName;
  title: ReactNode;
  sub: ReactNode;
  cta?: string;
  onCta?: () => void;
};

/** Nothing-here state: a tilted yellow icon block, a title, a line, a button. */
export function Empty({ icon, title, sub, cta, onCta }: EmptyProps) {
  return (
    <Panel
      flat
      style={{
        padding: '38px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          border: '3px solid var(--ink)',
          background: 'var(--yellow)',
          display: 'grid',
          placeItems: 'center',
          transform: 'rotate(-5deg)',
        }}
      >
        <Icon name={icon} size={26} strokeWidth={2.4} />
      </div>
      <div className="d" style={{ fontSize: 22 }}>
        {title}
      </div>
      <p
        style={{ margin: 0, maxWidth: 380, color: 'var(--ink-2)', fontSize: 14.5, lineHeight: 1.5 }}
      >
        {sub}
      </p>
      {cta && (
        <Button onClick={onCta} style={{ marginTop: 4 }}>
          {cta}
        </Button>
      )}
    </Panel>
  );
}
