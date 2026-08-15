# CLAUDE.md — session orientation

Land It: a trick tracker for scooter and skateboard riders. Pre-launch build, executed as
parallel agent sessions over the task plan in `docs/implementation-plan.md` §7.

## Start here

1. **This file.**
2. **[docs/implementation-plan.md](docs/implementation-plan.md)** — the authority: decisions,
   architecture, data model, and §7's task list (T0–T20) with ground rules. If the plan
   conflicts with the design prototype, the plan wins. Decisions in §1 were deliberated —
   never silently reverse one (especially: PocketBase not Supabase/Firebase; single-rider
   plans only; achievements are never for sale). If a decision seems wrong, stop and flag it.
3. **[design-handoff/README.md](design-handoff/README.md)** — the design contract. Fidelity is
   high: exact tokens, hard offset shadows, zero border radius, the loud visual language.
   Recreate, don't reinterpret. The prototype `.jsx` files are the behavioural spec; check
   screens against the numbered screenshots your task names.

## Session protocol

1. **Brief the owner first.** Open with a short bullet list for a Technical Product Owner:
   what this session will add or change — behaviour, not implementation. If the goal is
   unclear, ask before building. Include a **collision check**: run `gh pr list`, and if open
   PRs touch the same area, say so in the brief.
2. **One session = one task = one branch = one PR.** Branch names: `t{n}-{slug}` for plan
   tasks (e.g. `t3-design-system`); `fix-`/`chore-`/`docs-` prefixes for out-of-plan work.
   The branch name is the session title and the PR title prefix.
3. **Isolate the session.** Sessions run in parallel: `git fetch origin`, then
   `git worktree add .claude/worktrees/<name> -b <name> origin/main`, and work only there.
   Never commit in the shared root checkout; never touch another session's branch or
   worktree. If your work needs a change to code another session owns, surface it to the
   owner instead of making it.
4. **Shared code is additive-only once merged** (`packages/core`, `packages/db`,
   `packages/ui-web`, `pocketbase/`): add exports, fields or hooks; never change the
   signature or behaviour of an existing one. Breaking change needed → stop and flag.
5. **Gates before any commit:** `pnpm build`, `pnpm test`, `pnpm lint` — judged on **exit
   codes**, never on piped output (a `| tail` swallows the status). New behaviour has tests
   where the task says so; screens are checked against the named screenshots.
6. **Before opening or updating the PR:** `git fetch origin`, rebase onto `origin/main`,
   re-run the gates, push. If the work closes an issue, put `Fixes #N` in the body.
7. **Merge policy: the owner does not review PRs.** Opening the PR is the permission; the
   session squash-merges its own PR once **every required check reports a passing
   conclusion** (verified via the checks API, never assumed). There is no branch protection —
   nothing but this discipline stops a red merge. Anything the owner must decide is raised in
   chat BEFORE the work is built, not left for a review that will not happen.

**At session end:** leave no uncommitted work in the worktree; close with a TPO-level summary —
what shipped, what is still open, and any decisions only the owner can make (explicit, never
buried in prose). Report PR and check state as it actually is.

## Rules the plan depends on

- **The four security guarantees are non-negotiable** (plan §3): profile privacy enforced by
  API rules; clips never public; paywall enforced server-side in hooks, never only in the
  client; the guardian-consent gate enforced the same way.
- **No stranger-contact surface** (plan §6.1). Crews are invite-only with no discovery, there is
  no rider-to-rider messaging, and there is no algorithmic feed. These are the load-bearing facts
  of the child-safety position, not preferences — a session that wants to add one stops and flags
  it.
- **`packages/core` never imports React, Next, or anything DOM.** Every game rule is a pure,
  unit-tested function there; hooks and UI both call it.
- **Change control: plan first, then code.** A deliberate divergence from the plan or the
  design edits `docs/implementation-plan.md` and the code in the same PR — never code alone.
- **One fact, one place.** Build status lives in the PR list and the plan; don't create
  parallel status files. GitHub issues are the unscheduled backlog (labels `p1`/`p2`/`p3`) —
  write them the moment something out-of-scope is noticed, while the file paths are still in
  context.
- **Never touch the production box.** `docs/infrastructure.md` is reference only — deployment
  is handled outside build sessions. No SSH, server credentials, or deploy scripts.
- **Secrets never enter the repo** — `.env` files are templates only.
