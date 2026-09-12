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

1. **Open with a TPO brief — these six sections, in this order — and get it agreed before
   building anything** (Rachid, 2026-09-12, in chat). It is the bookend of the handover in
   step 12, and nothing starts until section 6 is answered.
   1. **What you asked for** — the owner's request, repeated back in their own words. This
      is the comprehension check and it is first for a reason: a misread ask is cheapest to
      catch in the line that repeats it, before anything is built on top of it.
   2. **Why we're doing it** — the benefit, not the mechanism. If this cannot be written
      without describing the implementation, the value is not understood yet.
   3. **Analytics events** — which `ANALYTICS_EVENTS` entries this should add or touch
      (`apps/web/src/lib/analytics.ts`), or one line saying why none: a staff-only screen, a
      refactor nobody sees, a fix to something already counted. **Analytics is part of the
      work, not a follow-up task.** A feature that ships uncounted is one nobody can tell you
      anything about six months later, and the session that could have added the event in a
      line is the one that had the file open. There is no autocapture, deliberately.
   4. **Risks** — what could go wrong or get worse. Anything slower, larger, newly depended
      on or newly someone else's to run; anything touching the four security guarantees or
      the child-safety position; and **any collision with work already in flight** (step 2's
      check lands here, so the owner can sequence the sessions).
   5. **Explicitly out of scope** — what this session will *not* do, named. Adjacent things
      the ask could be read to include, tempting fixes noticed on the way past, the larger
      version of the same idea. Naming them is what stops a session quietly widening, and
      gives the owner the chance to say "actually, do that too".
   6. **Anything you still need to answer** — the decisions only the owner can make. **Work
      does not start until these are answered**, because step 8 means there is no review in
      which to raise them later. Write each one as a plain question with the options and what
      each would mean in practice — no jargon, no implementation detail, short enough to
      answer in a line. A decision the owner has to decode is one they cannot make, and a
      session that buries a question in a paragraph has not asked it. Say "nothing" when
      there is nothing.

   If the goal is unclear, ask in section 6 rather than guessing at it. A brief the owner
   corrects in one line has done its job.
2. **Collision check, feeding section 4.** Four commands, not one:
   `gh pr list` (open PRs), `gh issue list` (the work may already be logged, and adjacent
   issues are often worth folding in), `git worktree list` and `git branch -a` (sessions
   already running that have not opened a PR yet — **these are invisible to `gh pr list`, and
   missing one cost Wave 1 half a session's work**; see LESSONS §1). Name any overlap under
   **Risks** so the owner can sequence the sessions.
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
12. **Close with a TPO handover — these five sections, in this order** (Rachid, 2026-09-12,
    in chat). Prose is where a handover goes to die: the owner should be able to read the last
    thing a session says and know what happened and what is waiting on them, without mining a
    paragraph for it.
    1. **What we changed or fixed** — concise bullets, behaviour a rider would notice rather
       than implementation.
    2. **Why we did it** — concise bullets, the benefit rather than the mechanism. A bullet
       here that only restates section 1 in other words means the work needs a better reason
       or the bullet needs deleting.
    3. **GitHub issues raised** — each as a link with a succinct why (step 11 wrote them while
       the file paths were still in context; this is where they surface). Say "none" rather
       than leaving the section out.
    4. **Next step** — *optional, and only when there is one.* Anything manual now waiting on
       a person: **a redeploy — merging is not shipping**, a new environment variable, a
       dashboard setting, a decision only the owner can make. Omit the heading when there is
       nothing, so its presence always means something.
    5. **Always finish by asking whether the PR should be raised and merged.** One line,
       always last, always a question — step 8 means a session never raises or merges one
       unasked, and green checks are the evidence offered when asking, not permission. It is
       per-PR: a yes does not carry to the next piece of work.

    Detail and sub-bullets under any section are fine. Report the branch and the checks as
    they actually are, **read from the tool rather than assumed** (step 9); anything that
    failed or was skipped is said plainly, with the evidence. What is not fine is dropping
    section 5 because the checks are green, or folding section 4 into section 1 so a redeploy
    reads as something already done.

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
