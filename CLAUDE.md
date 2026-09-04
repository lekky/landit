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
   architecture, data model, and §7's task list (T0–T23) with ground rules. If the plan
   conflicts with the design prototype, the plan wins. Decisions in §1 were deliberated —
   never silently reverse one (especially: PocketBase not Supabase/Firebase; single-rider
   plans only; achievements are never for sale; three sports at launch — scooter, skate and
   BMX). If a decision seems wrong, stop and flag it.
3. **[design-handoff/README.md](design-handoff/README.md)** — the design contract. Fidelity is
   high: exact tokens, hard offset shadows, zero border radius, the loud visual language.
   Recreate, don't reinterpret. The prototype `.jsx` files are the behavioural spec; check
   screens against the numbered screenshots your task names.
4. **[docs/FEATURES.md](docs/FEATURES.md)** — what the product actually does today, derived from
   the code on `main`: routes, data model, server-side enforcement, plans, mechanics, coverage.
   Orientation, not authority — when it disagrees with the code, the code wins and the file gets
   re-audited.
5. **[docs/LESSONS.md](docs/LESSONS.md)** — the process rules this build paid for, by theme.
   Read §1 (parallel sessions) before any session that runs beside another, and the section
   covering what you are about to touch. Every rule there was earned by something that went
   wrong; they are not optional context.

## Session protocol

### Starting

1. **Open with a TPO brief, and get it agreed before building anything.** It is the bookend
   of the closing summary in step 12, and it has the same five parts every time so that none
   of them quietly goes missing:
   - **What changes** — behaviour a rider would notice, in their words, not implementation.
   - **What gets measured** — which `ANALYTICS_EVENTS` entries this adds or touches
     (`apps/web/src/lib/analytics.ts`), or one line saying why none: a staff-only screen, a
     refactor nobody sees, a fix to something already counted. **Analytics is part of the
     work, not a follow-up task.** A feature that ships uncounted is one nobody can tell you
     anything about six months later, and the session that could have added the event in a
     line is the one that had the file open.
   - **What it costs** — anything that gets slower, larger, newly depended on, or newly
     someone else's to run.
   - **Collisions** — step 2, named so the owner can sequence the sessions.
   - **Decisions only the owner can make** — explicit and up front, because step 8 means
     there is no review in which to raise them later.

   If the goal is unclear, ask in the brief rather than guessing at it. A brief the owner
   corrects in one line has done its job.
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
   screens are checked against the named screenshots. **New rider-facing behaviour ships with
   its analytics event in the same PR** — the brief said which one, and the catalogue in
   `apps/web/src/lib/analytics.ts` says what a property is allowed to carry (catalogue facts,
   never rider facts, and never anything a rider typed). There is no autocapture to fall back
   on, deliberately, so an uninstrumented screen is an invisible one.
7. **Before opening or updating the PR:** `git fetch origin`, rebase onto `origin/main`,
   re-run the gates, push. `.github/pull_request_template.md` scaffolds the body — its first
   section is the same TPO brief that opened the session. If the work closes an issue, put
   `Fixes #N` in the body. On a rebase conflict in a shared document, take **origin's version
   wholesale** and re-apply only your own paragraphs (LESSONS §1).
8. **Merge policy: a session never raises a PR unasked, and "raise it" carries the merge.**
   (Rachid, 2026-09-01, in chat, amending the 2026-08-31 rule that required a second,
   separate approval to merge — which in practice meant the owner approving the same piece of
   work twice.) Build the work, run the gates, push the branch, and **stop there**: report
   what is ready and wait to be asked. Green checks are not permission to raise anything —
   they are the evidence you offer when you ask.
   - **What a session does unprompted:** build → gates → push → report, with the branch name
     and what the checks actually say. Then wait. **Never `gh pr create` on its own
     initiative** — this is the gate the whole policy rests on, and it did not move.
   - **What the owner's "raise a PR" grants:** opening that PR *and* merging it, without
     coming back for a second yes. It is one instruction covering both.
   - **It is per-PR, and it does not carry.** The next piece of work needs its own asking,
     however similar. Neither "the checks are green" nor an approval of the work's *design*
     is an instruction to raise anything.
   - **Merge consent is not consent to merge something broken.** If the checks fail, or CI has
     not finished, stop and report rather than merging — the owner said yes to the work, not
     to a red build. Waiting for a run to finish is the normal case, not an exception.
   - There is no branch protection, so nothing but this discipline stops an unasked PR.
   - Anything the owner must decide about the *work* is still raised BEFORE it is built (step
     1), because a decision reversed after the fact is a rebuild.

### Ending

**A session ends on a pushed branch nobody has been asked about yet, and that is correct.**
Do not raise a PR to "finish". Where the owner *has* asked for one, the session sees it through
to merged and cleans up after itself (step 8). Then, in order:

9. **Verify, don't assume.** Report state as it is, read from the tool rather than assumed:
   `gh pr checks` for the checks and `gh pr view --json state` for the PR. This applies to your
   own merge as much as the owner's — `gh pr merge` can print an error while the merge itself
   succeeded, usually `--delete-branch` failing because `main` is held by another worktree
   (LESSONS §2). Note that CI runs on `pull_request`, so a branch that has never been raised
   has no checks at all; say that plainly rather than implying it passed something.
10. **Clean up, once it is merged.** A branch nobody has asked about keeps its worktree —
    cleaning up before the merge throws away the thing being reviewed. After the
    merge: remove the worktree, delete the local branch, delete the remote branch, then
    `git worktree prune`. "No uncommitted work" is not cleanup. On Windows `git worktree
    remove` fails on nested `node_modules` with "Filename too long", so the sequence is not
    the obvious one — **mirror, `Remove-Item`, prune, and never `git worktree remove` after
    the mirror**, because the mirror deletes `.git` along with everything else and the remove
    then refuses with "validation failed … '.git' does not exist" (LESSONS §2):

    ```powershell
    robocopy <empty-dir> <worktree-path> /MIR   # from PowerShell: the Bash tool mangles
    Remove-Item <worktree-path> -Recurse -Force #   /MIR into a path and mirrors nothing
    ```

    then `git worktree prune`, and `git branch -D` only after it — a branch still registered
    to a worktree refuses to delete. Finally check `ls .claude/worktrees/`: the directory being
    gone is the only proof, and a removal that fails with "being used by another process" is
    usually transient — retry it.
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
