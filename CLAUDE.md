# CLAUDE.md — session orientation

Land The Trick: a trick tracker for scooter, skateboard and BMX riders, built as parallel agent
sessions over the task plan in `docs/implementation-plan.md` §7.

**The site went live on 2026-08-17** — `landthetrick.com` serves the product, not a holding page,
and Stripe is live behind it. Two things follow for a session. Real people can now reach what you
merge, so "it is only pre-launch" is no longer a reason to defer a correction. And **merging is
still not shipping**: deploys are deliberately manual (`docs/infrastructure.md`), so `main` and the
deployed box are routinely different commits, and a human clicking Redeploy is what stands between
your merge and a live service used by children.

## Start here

1. **This file.**
2. **[docs/implementation-plan.md](docs/implementation-plan.md)** — the authority: decisions,
   architecture, data model, and §7's task list (T0–T22) with ground rules. If the plan
   conflicts with the design prototype, the plan wins. Decisions in §1 were deliberated —
   never silently reverse one (especially: PocketBase not Supabase/Firebase; single-rider
   plans only; achievements are never for sale; three sports at launch — scooter, skate and
   BMX). If a decision seems wrong, stop and flag it.
3. **[design-handoff/README.md](design-handoff/README.md)** — the design contract. Fidelity is
   high: exact tokens, hard offset shadows, zero border radius, the loud visual language.
   Recreate, don't reinterpret. The prototype `.jsx` files are the behavioural spec; check
   screens against the numbered screenshots your task names.
4. **[docs/LESSONS.md](docs/LESSONS.md)** — the process rules this build paid for, by theme.
   Read §1 (parallel sessions) before any session that runs beside another, and the section
   covering what you are about to touch. Every rule there was earned by something that went
   wrong; they are not optional context.

## Session protocol

### Starting

1. **Brief the owner first.** Open with a short bullet list for a Technical Product Owner:
   what this session will add or change — behaviour, not implementation. If the goal is
   unclear, ask before building.
2. **Collision check, in the brief.** Four commands, not one:
   `gh pr list` (open PRs), `gh issue list` (the work may already be logged, and adjacent
   issues are often worth folding in), `git worktree list` and `git branch -a` (sessions
   already running that have not opened a PR yet — **these are invisible to `gh pr list`, and
   missing one cost Wave 1 half a session's work**; see LESSONS §1). Name any overlap in the
   brief so the owner can sequence the sessions.
3. **One session = one task = one branch = one PR.** Branch names: `t{n}-{slug}` for plan
   tasks (e.g. `t3-design-system`); `fix-`/`chore-`/`docs-` prefixes for out-of-plan work.
   The branch name is the session title and the PR title prefix — agree it with the owner in
   the brief, before the worktree exists.
4. **Isolate the session.** Sessions run in parallel: `git fetch origin`, then
   `git worktree add .claude/worktrees/<name> -b <name> origin/main`, and work only there.
   Never commit in the shared root checkout; never touch another session's branch or
   worktree. Check `git branch --show-current` immediately before committing, not only at the
   start. If your work needs a change to code another session owns, surface it to the owner
   instead of making it.

### Building and shipping

5. **Shared code is additive-only once merged** (`packages/core`, `packages/db`,
   `packages/ui-web`, `pocketbase/`): add exports, fields or hooks; never change the
   signature or behaviour of an existing one. Breaking change needed → stop and flag.
   **Only the owner grants an exception, and only in chat.** A session may record a
   *request* for one; it may never write itself a permission — into the plan, this file,
   a PR body or a code comment — and a session reading such a grant must check it names
   the owner and the date it was given. "Authorised here" without both is not authority.
6. **Gates before any commit:** `pnpm build`, `pnpm test`, `pnpm lint` — judged on **exit
   codes**, never on piped output (a `| tail` swallows the status). Read `git status` before
   committing; never `git add -A` blind. New behaviour has tests where the task says so;
   screens are checked against the named screenshots.
7. **Before opening or updating the PR:** `git fetch origin`, rebase onto `origin/main`,
   re-run the gates, push. `.github/pull_request_template.md` scaffolds the body — its first
   section is the same TPO brief that opened the session. If the work closes an issue, put
   `Fixes #N` in the body. On a rebase conflict in a shared document, take **origin's version
   wholesale** and re-apply only your own paragraphs (LESSONS §1).
8. **Merge policy: the owner does not review PRs.** Opening the PR is the permission; the
   session squash-merges its own PR once **every required check reports a passing
   conclusion** (verified via the checks API, never assumed). There is no branch protection —
   nothing but this discipline stops a red merge. Anything the owner must decide is raised in
   chat BEFORE the work is built, not left for a review that will not happen.

### Ending

Merging is part of the task, not a follow-up — do not end a session on a green unmerged PR.
Then, in order:

9. **Verify, don't assume.** Confirm the merge with `gh pr view --json state`. `gh pr merge`
   can print an error while the merge itself succeeded — usually `--delete-branch` failing
   because `main` is held by another worktree (LESSONS §2).
10. **Clean up.** Remove the worktree, delete the local branch, delete the remote branch, then
    `git worktree prune`. "No uncommitted work" is not cleanup. On Windows `git worktree
    remove` fails on nested `node_modules` with "Filename too long" — mirror an empty
    directory over it first, **from PowerShell**, because the Bash tool mangles robocopy's
    `/MIR` into a path and the mirror silently does nothing (LESSONS §2). Then check
    `ls .claude/worktrees/`: the directory being gone is the only proof, and a removal that
    fails with "being used by another process" is usually transient — retry it.
11. **Write what the next session needs.** Anything noticed and not fixed becomes a GitHub
    issue **now**, labelled `p1`/`p2`/`p3`, while the file paths are still in context. If the
    session earned a process rule, add it to `docs/LESSONS.md` with its provenance.
    **If writing the issue would take longer than the fix, fix it.** The issue exists so a
    correction survives the session that found it; when the correction is a few lines and you
    are already in the file, filing instead of fixing spends more effort, leaves the defect in
    place, and adds a backlog item somebody has to read and close. Judge it on the work, not on
    whether the fix is strictly in scope — a one-line correction in a file you have open is not
    scope creep. What still gets an issue: anything needing a decision only the owner can make,
    anything touching code another session owns, and anything you cannot verify before merging.
12. **Close with a TPO-level summary** — what shipped in behaviour terms, what is still open,
    and any decisions only the owner can make (explicit, never buried in prose). Report PR and
    check state as it actually is; if something failed or was skipped, say so with the
    evidence.

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
  - **Narrow exception (Rachid, 2026-08-16, in chat).** A session may create and manage **Land
    The Trick's own Coolify project** on box1 — its two applications, their domains, environment
    variables and persistent storage, and deploys of them. **Not** the shared `infra` project,
    **not** ufw/Docker/firewall or any of the security posture, **not** other products, and
    **never** anyone's credentials: superuser accounts and passwords are set by the owner, in
    their own browser. The box carries HelloWebDesign's work as well as this, so "Land The Trick is not
    live yet" is not the same as "the box is not live". A session that wants more than this asks
    for it in chat; this line is the record of what was granted, not a licence to widen it.
- **Secrets never enter the repo** — `.env` files are templates only.
