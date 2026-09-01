'use client';

import type { CSSProperties } from 'react';

import { foregroundFor } from '../contrast';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons';
import { Tag } from './buttons';
import { Difficulty, StageDot } from './meters';
import { SportChip } from './nav';

/**
 * The trick card, the stage picker and the skill-tree node.
 *
 * These take plain props, never records from `@landit/core`. The design system
 * knows what a colour and a label look like; it does not know the trick graph.
 */

export type CategoryLook = {
  /** e.g. "Street". */
  label: string;
  /** The category colour: the folded corner and the tag. */
  color: string;
};

export type SportLook = {
  /** e.g. "Scooter". */
  label: string;
  color: string;
  icon: IconName;
};

export type StageLook = {
  id: string;
  /** e.g. "Most times". */
  label: string;
  /** Short label used on narrow stage pickers. */
  short?: string;
  color: string;
};

export type TrickCardProps = {
  name: string;
  category: CategoryLook;
  /** 1–5. */
  difficulty: number;
  sport: SportLook;
  /** The rider's current stage, or null when the trick is untracked. */
  stage?: StageLook | null;
  /** Behind the paywall: hatched background, violet flag, violet footer. */
  locked?: boolean;
  /** Tier name on the lock flag, e.g. "Gnarly". */
  lockTier?: string;
  /** Footer text when locked. */
  lockLabel?: string;
  /** Footer text when untracked. */
  emptyLabel?: string;
  /**
   * Show the sport chip. The landing page's four sample cards drop it, because
   * nobody has chosen a sport yet at that point.
   */
  showSport?: boolean;
  /** Card background. The landing page tilts four of these on bright colours. */
  background?: string;
  onOpen?: () => void;
  className?: string;
  style?: CSSProperties;
};

/**
 * A trick, as it appears in the library grid: folded corner in the category
 * colour, name in Anton, category tag, difficulty bars, sport chip, and a
 * footer strip in the current stage's colour.
 */
export function TrickCard({
  name,
  category,
  difficulty,
  sport,
  stage = null,
  locked = false,
  lockTier,
  lockLabel = 'Shredder plan',
  emptyLabel = 'Not tracked',
  showSport = true,
  background,
  onOpen,
  className,
  style,
}: TrickCardProps) {
  const st = locked ? null : stage;
  const filled = Boolean(st) || locked;
  const footFill = st ? st.color : locked ? 'var(--violet)' : 'transparent';
  const footFg = filled ? (foregroundFor(footFill) ?? 'var(--paper)') : 'var(--ink-3)';
  return (
    <button
      type="button"
      className={cx('tcard', locked && 'lockd', className)}
      onClick={onOpen}
      style={{ background: background ?? 'var(--paper)', ...style }}
    >
      <span className="fold" style={{ '--c': category.color } as CSSProperties} />
      {locked && (
        <span className="lockflag">
          <Icon name="lock" size={12} strokeWidth={2.8} />
          {lockTier}
        </span>
      )}
      <div className="body">
        <div className="nm">{name}</div>
        <div className="meta">
          <Tag color={category.color} tilt>
            {category.label}
          </Tag>
          <Difficulty value={difficulty} small />
        </div>
        {showSport && <SportChip sport={sport} small />}
      </div>
      {/*
        The stage strip carried `#fff` on whatever the stage's colour is, and
        three of the five stages are light: Sometimes (2.03:1), Most times
        (2.13:1) and Every time (3.29:1) — the three a rider sees once they are
        actually landing things. `foregroundFor` reads the fill and answers ink
        or paper; the locked fill is a `var()` it cannot read, so that one keeps
        paper, which is right for violet anyway (5.45:1).
      */}
      <div className="foot" style={{ background: footFill, color: footFg }}>
        <StageDot color={filled ? footFg : undefined} ring={filled ? footFg : 'var(--ink-3)'} />
        {locked ? lockLabel : st ? st.label : emptyLabel}
      </div>
    </button>
  );
}

export type StagePickerProps = {
  /** Five stages, in order. Supplied by the caller so staff copy stays in data. */
  stages: readonly StageLook[];
  /** Currently selected stage id, or null. */
  value: string | null;
  /** Picking the selected stage again clears it — that is the untrack path. */
  onPick: (stage: string | null) => void;
  /** Use the short labels. */
  compact?: boolean;
};

/** The five-button "can you do it?" row. */
export function StagePicker({ stages, value, onPick, compact = false }: StagePickerProps) {
  return (
    <div className="stages">
      {stages.map((s) => {
        const on = value === s.id;
        /*
          `.stagebtn.on` carries `color:#fff` in the stylesheet while the fill
          comes from the stage, so the selected button was white on whatever
          that stage is — Most times measured 2.17:1. Four of the five stages
          want ink; only Want to learn (violet) keeps paper. The ring follows the
          label so the dot does not vanish into its own fill.
        */
        const fg = on ? (foregroundFor(s.color) ?? 'var(--paper)') : undefined;
        return (
          <button
            type="button"
            key={s.id}
            aria-pressed={on}
            className={cx('stagebtn', on && 'on')}
            onClick={() => onPick(on ? null : s.id)}
            style={on ? { background: s.color, borderColor: 'var(--ink)', color: fg } : undefined}
          >
            <span className="ring" style={on ? { background: fg } : undefined} />
            {compact ? (s.short ?? s.label) : s.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Skill-tree node states:
 * - `open` — reachable, not landed yet
 * - `done` — landed (lime)
 * - `lock` — prerequisites missing (dashed, hatched)
 * - `paid` — behind the paywall (dashed violet, hatched)
 */
export type SkillNodeState = 'open' | 'done' | 'lock' | 'paid';

export type SkillNodeProps = {
  name: string;
  difficulty: number;
  state: SkillNodeState;
  /** Right-hand label: "Landed", "Shredder", or nothing. */
  note?: string;
  onOpen?: () => void;
};

export function SkillNode({ name, difficulty, state, note, onOpen }: SkillNodeProps) {
  return (
    <button type="button" className={cx('node', state !== 'open' && state)} onClick={onOpen}>
      <span className="nn">{name}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Difficulty value={difficulty} small />
        {state === 'paid' && (
          <span
            className="lab"
            style={{ color: 'var(--violet)', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Icon name="lock" size={12} strokeWidth={2.8} />
            {note ?? 'Shredder'}
          </span>
        )}
        {state === 'done' && (
          <span className="lab" style={{ color: 'var(--green)' }}>
            {note ?? 'Landed'}
          </span>
        )}
        {state === 'lock' && <Icon name="lock" size={13} strokeWidth={2.6} />}
      </span>
    </button>
  );
}
