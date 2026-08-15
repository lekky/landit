/**
 * `@landit/core` — the game rules, as pure TypeScript.
 *
 * This package must never import React, Next, `react-native`, or anything DOM.
 * Web hooks, server hooks and (later) the native app all call the same functions
 * from here, so anything platform-specific in this package makes the second
 * platform expensive. The rule is enforced by ESLint, not by good intentions:
 * see `eslint.config.mjs` at the repo root.
 *
 * T1 fills this in — trick graph, stage rules, sticker evaluation, stats,
 * streaks and challenge state. Everything below is scaffolding only.
 */

/** Package identity. Exists so the scaffold has something real to import and test. */
export const CORE_PACKAGE = '@landit/core' as const;
