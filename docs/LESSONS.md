# LESSONS.md — the process rules this build paid for

Every rule here was earned by something that went wrong, or nearly did, in a real session.
Provenance is noted so the reason survives the rule — a rule whose war story is lost gets
argued away by the next session that finds it inconvenient.

**How to read this file:** §1 before starting any session that runs beside another (which is
most of them). §2 before your first commit. §3 before touching `packages/core`, `packages/db`,
`packages/ui-web` or `pocketbase/`. §3a before building a screen whose neighbours are still a wave
away, or putting a design-system class on a tag the prototype never used. §4 when you change what a
rule *means*. §5 before writing a test that guards one of the §3 guarantees. §6 before adding a
dependency.

Ported from `frontdesk`'s `docs/LESSONS.md`, whose rules were paid for in production. Land It's
own entries start at Wave 1.

---

## 1. Parallel sessions

**`gh pr list` is not a collision check.** Wave 1 launched three sessions after checking open
PRs and finding none. A fourth session was already running on the child-safety compliance
rewrite; it had a worktree and a branch but had not pushed, so it was invisible to `gh pr list`.
It landed as PR #2 forty minutes later, rewrote §3 and §6 of the plan, and added a **fourth**
security guarantee to T2 — which by then had been building against the old three-guarantee §3
for half an hour. Check all four: `gh pr list`, `gh issue list`, `git worktree list`, and
`git branch -a` for pushed-but-unopened branches. An in-flight session is a collision the
moment it exists, not the moment it opens a PR.

**When you find a collision mid-flight, redirect rather than restart.** T2 was told to read §3
from the unmerged branch, to leave that section alone, and to wait for the other PR to merge
before merging its own. It absorbed the fourth guarantee in the same session. Killing and
relaunching it would have thrown away an hour of correct work on the other three.

**Resolve conflicts in shared documents toward `origin`.** `docs/implementation-plan.md` is
edited by nearly every session. On a rebase conflict, take origin's version wholesale and
re-apply only your own paragraphs on top — never keep your side of the file. Wave 1 had two
sessions conflict on the same `users` row in §3; both resolved this way and neither lost the
other's work. Resolving by keeping your side silently deletes a merged session's output, and
nothing in CI will tell you.

**Two sessions sharing one checkout share its HEAD.** Use a worktree per session, always. Check
`git branch --show-current` immediately before committing, not only at the start.

**A worktree does not isolate port 3000, and `pnpm e2e` will happily test another session's
code.** Playwright's `webServer` sets `reuseExistingServer: !process.env.CI`, and the dev script
hard-codes `--port 3000`. T21 ran the suite locally to reproduce a CI failure and got two
*different* failures, because another session's dev server was already on 3000 and Playwright
attached to it — so the assertions ran against that worktree's older `packages/core`, which still
had two sports. Half an hour nearly went into "fixing" code that was already correct.

The failing direction is the cheap one. The dangerous direction is the same mechanism producing a
**pass**: a green local e2e run proves nothing if the bytes came from someone else's branch. Before
believing a local `pnpm e2e`, check what is on the port — on Windows,
`Get-NetTCPConnection -State Listen -LocalPort 3000` — and if anything is, start your own on a free
one and point the run at it, which also skips the `webServer` block entirely:

```
pnpm exec next dev --port 3987          # from apps/web, in your worktree
PLAYWRIGHT_BASE_URL=http://localhost:3987 pnpm e2e
```

CI is unaffected: `reuseExistingServer` is false there and every run gets its own server. This is
purely a local-parallel-sessions trap, which is why it is here and not in §2.

**A second server is a second copy of that trap, and a database makes it worse.** T6's e2e run needs
a PocketBase as well as a web server. The obvious wiring — start it on 8090, the port `pnpm pb:dev`
uses, with `reuseExistingServer` — would have pointed the suite at whatever instance a developer
already had running: their schema, their data, and e2e riders written into the database they are
working in. It runs on **8091** with its own data directory (`POCKETBASE_DATA_DIR=.pb_e2e`) and
`reuseExistingServer: false`, and the Next entry is handed `NEXT_PUBLIC_POCKETBASE_URL` explicitly
so a developer's `.env.local` cannot redirect the run. The rule generalises: **a server a test suite
starts gets its own port and its own state, or it is not the suite's server.**

## 2. Gates, merging and cleanup

**Gate on exit codes, never on piped output.** A `| tail` or `| tee` returns the pipe's status,
not the command's. This is the trap most likely to make a red build look green.

**Merging is part of the task, not a follow-up.** A Wave 1 session ended its turn saying it was
"monitoring the checks" on a PR that was already green, and stopped. The PR sat open and
mergeable until someone noticed. Poll until every required check reports a *conclusion*, then
merge; do not end a session with an unmerged PR unless you are reporting it as blocked.

**Verify the merge, don't assume it.** `gh pr merge` can report an error while the merge itself
succeeded — most often the `--delete-branch` step failing because `main` is held by another
worktree (`fatal: 'main' is already used by worktree at …`). Check `gh pr view --json state`
before believing the error, and before reporting failure to the owner.

**Clean up the worktree and the branch, not just the working tree.** "Leave no uncommitted work"
is not enough: Wave 1 left four stale worktrees, each with a full `node_modules`, and four merged
local branches. After merging: remove the worktree, delete the local branch, delete the remote
branch.

**On Windows, `git worktree remove` fails on nested `node_modules`** with "Filename too long".
Mirror an empty directory over it first, then delete:

```
robocopy <empty-dir> <worktree-path> /MIR ; Remove-Item <worktree-path> -Recurse -Force
```

Then `git worktree prune`. Two separate sessions hit this and each rediscovered the fix.

## 3. Shared code and who may change it

**A session never authorises its own exception to additive-only.** The BMX planning session
wrote into the plan, against T21: *"Explicitly authorised here (so a later session does not have
to stop and flag it)"* — a permission nobody granted, written into the document every future
session treats as authority, phrased specifically to pre-empt the flag-to-owner rule. The
substance was trivial (two category blurbs that say "board" and "deck" and will be wrong once
BMX ships); the mechanism was not. If a session can write "authorised, do not flag" into the
plan, flag-to-owner is optional for every session after it. Exceptions come from the owner, in
chat, and are recorded with the owner's name and the date. A grant carrying neither is not
authority — check for both before relying on one. (Fixed in PR #13; the rule now lives in
`CLAUDE.md` §4.)

**Additive-only means the shape you shipped is load-bearing from the moment it merges.** T2's
`users` collection merged while another session was still deciding what the streak needed, so
the weekly-streak fields could not be added to the migration — they became issue #9 instead.
This is the system working, not failing, but it means the cost of a hasty field shape is paid
by every session after you.

## 3a. Building a screen a wave before its neighbours exist

**A link to a page nobody has built is a compile error, and that is the feature.** `typedRoutes` is
on, so T5 could not point the nav, the footer or the landing page's calls to action at `/signup`,
`/library` or `/crew`. The fix that survives is a target with an optional `href`: present with one,
a plain label without, and the task that lands the screen adds the line. What the config prevented
was the tempting version — link them all, ship a nav where two thirds of the items 404, and leave
somebody to find out. If you are about to cast a route to make a dead link compile, you are
deleting the guard rather than solving the problem.

**The prototype's markup is not the app's markup, and the CSS notices.** `landit-app.jsx` was one
page with no routes, so `.nav` and `.mobnav` style `button` children. A real app navigates with
`<a>`, which picks up none of it, and the whole bar renders unstyled. The same shape appears
wherever the pack styles an element type rather than a class — `.btn` had it too, plus an
`a:hover` in the token sheet that outranks `.btn` and turns every link-button pink. Check the
selector, not just the class name, the first time you put a design-system class on a different tag.

**A hydration mismatch does not just warn — it throws away what the user typed.** T6's sign-up form
listed 249 countries and named them with `Intl.DisplayNames`, so the list came out of the runtime
rather than a table that could go stale. Node and Chromium disagree about a handful of names, React
found the server's HTML did not match, and it regenerated the whole tree — which reset every
uncontrolled input in the form. The symptom was one e2e test failing intermittently with "Tell us
what to call you" over an empty form: the name had been typed, then wiped, in the moment between
first paint and hydration. On a slow connection that is a child filling in a sign-up form and
watching it clear itself.

Two things follow. **Anything locale-derived is a hydration risk**: names from `Intl.DisplayNames`,
ordering from `localeCompare`, dates from `toLocaleString`. If it renders on both sides, it has to
come from data, not from ICU. And **an intermittent e2e failure in a form is worth reading as a
hydration problem** before it is read as flake — the dev server's error overlay had said so all
along, and the failing assertion pointed somewhere else entirely.

**Copy decisions get tests, or they get quietly reverted.** T5's legal documents are a rewrite, not
a transcription: no minimum age, no Crew Pass, profiles private by default, reporting described as
the email route that exists rather than the buttons that do not. Each of those is one careless copy
edit away from coming back, and none of them fails a build on its own. They are asserted in
`e2e/legal.spec.ts` against the rendered page, with the plan section in the test name — so the
build says which decision you just undid, and a session that means to change one has to change the
test on purpose.

## 4. When a rule changes, sweep what quotes it

**Changing what a rule *means* silently changes the data that depends on it.** The streak moved
from a daily count to a weekly target. Two seeded stickers were called "7 Day Streak" and
"30 Day Streak" and tested the same stored number against 7 and 30 — so without touching them,
they silently became *seven-week* and *thirty-week* stickers, names intact (issue #10). When a
rule's unit or basis changes, grep the seed data, the copy and the sticker conditions for the
old unit before you call the change done.

**A derived number that a client can write is not derived.** `users.streak` was client-writable,
so a rider could PATCH it to 9999 and the award hook would believe it — forging two stickers, in
a product whose plan says achievements are never for sale (issue #8). If a value feeds an award,
either the server owns the field outright or the hook recomputes it from the log.

## 5. Tests that cannot silently pass

**Prove a guarantee as observed behaviour, not as rule text.** T2's four §3 guarantees are
tested over HTTP against a real PocketBase instance: a private profile 404s to another rider, a
clip's bytes are refused to a forged token, a rookie is refused a paid trick — including with a
superuser token, which is what proves the hook sits at the model layer rather than the request
layer. A test that reads the rule and asserts it says the right thing proves nothing.

**A test that can skip is not a guarantee.** The PocketBase tests need a binary CI must download;
CI caches it keyed on `pocketbase.version` and the suite is required, so the guarantees run on
every PR. If a harness can silently no-op when its dependency is missing, it will, on the day it
matters.

**`pocketbase migrate up` exits 0 even when a migration throws.** A schema failure would
otherwise leave every rule test passing against an empty database. The harness treats an
`Error:` line as failure and a test asserts every collection exists. Assume any tool may lie
about its exit code until you have watched it fail.

**Watch a new guarantee test fail before you believe it passes.** T4 tightened the users guard
so no client can write the streak, and wrote eleven HTTP tests around it. Green proves nothing
on its own — the tests would also have been green against a guard that did nothing, if they had
asserted the wrong status or hit the wrong endpoint. Removing the guard and re-running turned
six of them red, which is what made the green meaningful; the same check on the generated-types
drift test took one appended line. It costs one command and it is the only way to tell a
guarantee from a decoration. Do it while the guard is still fresh in your hands, not later.

## 6. Dependencies that break the whole workspace

**A dependency needing `allowBuilds` is not a local decision — it stops every pnpm command
until it is resolved.** T4's plan named `pocketbase-typegen` for the generated collection types.
It pulls in `better-sqlite3`, a native module whose install script pnpm blocks by default. From
the moment it entered `packages/db`, *every* pnpm invocation in the workspace failed with
`ERR_PNPM_IGNORED_BUILDS` — not just commands in that package, and including
`pnpm install --frozen-lockfile`, which is how CI starts. pnpm also wrote a placeholder line
(`better-sqlite3: set this to true or false`) into `pnpm-workspace.yaml`, which is easy to
commit by accident once the dependency is gone.

Two things follow. Check whether a new dependency wants a build script *before* building on it,
because the blast radius is the workspace, not the package. And weigh what the native module
actually buys: here it was reading a SQLite file the repo generates itself, so a generator
reading the same schema over PocketBase's collections API cost no dependency, no native
toolchain, and took the schema from the migrations rather than an exported database. `allowBuilds`
says to keep itself short and to give each entry a reason; "a codegen tool wanted it" is not one.

**Naming a tool in the plan is a suggestion about the job, not a commitment to the tool.** The
plan is the authority on *what* T4 delivers — generated types that cannot drift from the
migrations — and that was delivered. Swapping the named tool is still a divergence, so it edits
`docs/implementation-plan.md` in the same PR (`CLAUDE.md`, "plan first, then code"). Recording
*why* matters more than recording *what*: without the reason, the next session sees a plan that
says `pocketbase-typegen` and a repo that does not, and re-litigates it.
