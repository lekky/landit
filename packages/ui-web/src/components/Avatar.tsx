'use client';

import type { CSSProperties } from 'react';

import { AVATAR_BASE_PATH, avatarById, avatarSrc } from '../avatars';

/**
 * The rider's picture: one of the 36 built-in avatars, or their initial on a
 * flat colour. Avatars and stage dots are the only round things in the design.
 *
 * A plain `<img>`, not `next/image`: this package must not depend on Next so
 * the same primitives survive a future native shell.
 */

export type AvatarProps = {
  /** Built-in avatar id. Anything unknown falls back to the initial. */
  avatarId?: string | null;
  /** Used for the initial and the alt text. */
  name?: string;
  size?: number;
  /** Ring colour. */
  ring?: string;
  /** Ring width in px. */
  ringWidth?: number;
  /** Background behind the initial, when there is no picture. */
  hue?: string;
  /** Where the avatar PNGs are served from. */
  base?: string;
  onClick?: () => void;
  title?: string;
};

export function Avatar({
  avatarId,
  name,
  size = 38,
  ring = 'var(--ink)',
  ringWidth = 2.5,
  hue = 'var(--pink)',
  base = AVATAR_BASE_PATH,
  onClick,
  title,
}: AvatarProps) {
  const a = avatarById(avatarId);
  const box: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: `${ringWidth}px solid ${ring}`,
    background: a ? a.hue : hue,
    display: 'grid',
    placeItems: 'center',
    flex: 'none',
    overflow: 'hidden',
    padding: 0,
    cursor: onClick ? 'pointer' : 'default',
  };

  const inner = a ? (
    <img
      src={avatarSrc(a.id, base)}
      alt={a.name}
      style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
    />
  ) : (
    <span
      style={{
        fontFamily: 'var(--fd)',
        fontSize: Math.round(size * 0.44),
        color: '#fff',
        lineHeight: 1,
      }}
    >
      {(name || '?').trim()[0]}
    </span>
  );

  return onClick ? (
    <button type="button" onClick={onClick} style={box} title={title}>
      {inner}
    </button>
  ) : (
    <span style={box} title={title}>
      {inner}
    </span>
  );
}
