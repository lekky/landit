/**
 * `@landit/core` — the game rules and the canonical data, as pure TypeScript.
 *
 * This package must never import React, Next, `react-native`, or anything DOM.
 * The web client, the PocketBase hooks and (later) the Expo app all call the
 * same functions from here, so anything platform-specific in this package makes
 * the second platform expensive. The rule is enforced by ESLint, not by good
 * intentions: see `eslint.config.mjs` at the repo root.
 *
 * Two halves:
 *
 * - `./data` — the canonical records transcribed from the design pack: 61
 *   tricks and their prerequisite edges, stickers, plans, spots, events,
 *   challenges, stances, goals and the avatar registry. Single source for both
 *   the database seeds and the test fixtures.
 * - `./rules` — the behaviour: landed stages, free and locked tricks,
 *   prerequisite unlocks, stats, sticker evaluation, challenge state, streaks
 *   and log-derived dates.
 *
 * Where a rule is security-relevant — the paywall, sticker awards — it is
 * *defined* here and *enforced* in `pocketbase/hooks` (plan §3). Nothing in
 * this package is a security boundary on its own.
 */

export const CORE_PACKAGE = '@landit/core' as const;

export * from './types';
export * from './data';
export * from './rules';

// Neither data nor a game rule: the pure decision behind the pre-launch holding
// page, shared by the web proxy and `robots.ts` so the two cannot disagree.
export * from './launch';
