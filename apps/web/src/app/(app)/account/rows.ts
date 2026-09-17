import {
  LEVELS,
  PLAN,
  PRIVACY,
  SESSION_VISIBILITIES,
  SPORTS,
  STANCES,
  isConsentLimited,
  sessionVisibilityDefault,
  type ConsentState,
  type PlanId,
  type PrivacyId,
  type SportId,
} from '@landit/core';
import type { IconName } from '@landit/ui-web';
import type { UsersRecord } from '@landit/db';
import type { Route } from 'next';

import { ROUTES } from '@/lib/routes';

/**
 * The eight rows `/account` is (app shell rethink §3.9, T51).
 *
 * `/account` was one scroll holding every control the product has about a
 * rider — the profile editor, the sports picker, two privacy settings, the
 * guardian gate, the data export — one under the other, in the order the tasks
 * that built them happened to land. On a phone that is a screen a rider swipes
 * through hunting for the one thing they came for, and the thing they came for
 * is nearly always one control.
 *
 * So the screen is a list of rows and each row is a screen. Nothing about the
 * panels themselves changed: every server action, the privacy rule, the
 * guardian flow and the data export do exactly what they did, at addresses of
 * their own.
 *
 * **The sub-line is the current value, and it is a catalogue fact every time.**
 * A privacy setting's label, a sport's name, a plan's name, the word for a
 * consent state — all of them are rows in `@landit/core`, written by this
 * repository. Nothing a rider typed is ever on this screen's rows: not their
 * written goal, not their handle, not a crew name. That is the same rule the
 * analytics catalogue works to, applied here because a settings list is read
 * over a rider's shoulder more often than any other screen in the product.
 */
export interface SettingsRowSpec {
  readonly id: string;
  /** What the row is called. The sub-screen's `h1` says the same words. */
  readonly title: string;
  /** The current value, in the catalogue's own words. */
  readonly value: string;
  readonly href: Route;
  readonly icon: IconName;
  /**
   * The icon square's fixed fill, as `OptionRow`'s is. Light fills only: ink
   * sits on them (`--on-light`), which is what the shared mark class sets.
   */
  readonly fill: string;
}

/** The sport names a rider tracks, in the catalogue's words. */
function sportsValue(sports: readonly SportId[]): string {
  if (!sports.length) return 'No sports picked yet';
  return sports.map((sport) => SPORTS[sport].label).join(' · ');
}

/**
 * Where a rider says they are at, and which foot leads.
 *
 * The goal is deliberately not here. "Something else" stores sixty characters
 * a rider wrote, and a sub-line that showed it would put free text on the one
 * screen this file's opening note says must not carry any.
 */
function profileValue(level: string, stance: string): string {
  const levelLabel = LEVELS.find((option) => option.id === level)?.label;
  const stanceLabel = STANCES.find((option) => option.id === stance)?.label;
  if (levelLabel && stanceLabel) return `${levelLabel} · ${stanceLabel}`;
  return levelLabel ?? 'Your picture, goal, stance and level';
}

/**
 * The rows for this rider.
 *
 * Two of the eight are drawn only for the riders they are about, and both are
 * decisions the product already makes elsewhere rather than new ones:
 *
 * - **Who sees new sessions** follows `sessionsEnabledFor`, exactly as the
 *   panel did on the old screen.
 * - **Your guardian** follows `isConsentLimited` — `pending` or `revoked`. The
 *   panel behind it is written to a rider waiting on a grown-up or told no, and
 *   it has nothing to say to a rider whose account was never gated or whose
 *   guardian has already said yes. This is the eighth row, and it is the
 *   owner's addition to §3.9's seven (Rachid, 2026-09-16, in chat): without it
 *   the gate's one control would have had no way in from the list.
 */
export function settingsRowsFor(
  rider: UsersRecord,
  options: { readonly sessionsEnabled: boolean },
): readonly SettingsRowSpec[] {
  const sports = (rider.sports ?? []) as SportId[];
  const consent = rider.consent_state as ConsentState;
  const plan = PLAN[(rider.plan || 'rookie') as PlanId];

  const rows: SettingsRowSpec[] = [
    {
      id: 'profile',
      title: 'Your profile',
      value: profileValue(rider.level || '', rider.stance || ''),
      href: ROUTES.accountProfile,
      icon: 'user',
      fill: 'var(--yellow)',
    },
    {
      id: 'sports',
      title: 'What you ride',
      value: sportsValue(sports),
      href: ROUTES.accountSports,
      icon: 'board',
      fill: 'var(--lime)',
    },
    {
      id: 'privacy',
      title: 'Who can see your profile',
      value:
        PRIVACY.find((option) => option.id === ((rider.privacy || 'private') as PrivacyId))
          ?.label ?? 'Private',
      href: ROUTES.accountPrivacy,
      icon: 'eye',
      fill: 'var(--sky)',
    },
  ];

  if (options.sessionsEnabled) {
    const visibility = sessionVisibilityDefault(rider.session_visibility_default);
    rows.push({
      id: 'sessions',
      title: 'Who sees new sessions',
      value: SESSION_VISIBILITIES.find((option) => option.id === visibility)?.label ?? 'Only me',
      href: ROUTES.accountSessions,
      icon: 'clock',
      fill: 'var(--pink-soft)',
    });
  }

  if (isConsentLimited(consent)) {
    rows.push({
      id: 'guardian',
      title: 'Your guardian',
      value: consent === 'revoked' ? 'Approval withdrawn' : 'Waiting on a grown-up',
      href: ROUTES.accountGuardian,
      icon: 'lock',
      fill: 'var(--orange)',
    });
  }

  rows.push(
    {
      id: 'plans',
      title: 'Plans and billing',
      value: plan ? `${plan.name}${plan.id === 'rookie' ? ' · free' : ''}` : 'Rookie · free',
      href: ROUTES.plans,
      icon: 'crown',
      fill: 'var(--pink)',
    },
    {
      id: 'coach',
      title: 'Coach / parent view',
      value: 'A read-only week, for showing a grown-up',
      href: ROUTES.coach,
      icon: 'users',
      fill: 'var(--sky)',
    },
    {
      id: 'data',
      title: 'Your data',
      value: 'Download everything, or close your account',
      href: ROUTES.accountData,
      icon: 'print',
      fill: 'var(--wash)',
    },
  );

  return rows;
}
