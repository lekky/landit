# LESSONS.md — the process rules this build paid for

Every rule here was earned by something that went wrong, or nearly did, in a real session.
Provenance is noted so the reason survives the rule — a rule whose war story is lost gets
argued away by the next session that finds it inconvenient.

**How to read this file:** §1 before starting any session that runs beside another (which is
most of them). §2 before your first commit. §3 before touching `packages/core`, `packages/db`,
`packages/ui-web` or `pocketbase/`. §3a before building a screen whose neighbours are still a wave
away, or putting a design-system class on a tag the prototype never used. §4 when you change what a
rule *means*. §5 before writing a test that guards one of the §3 guarantees. §5a before putting
anything you did not type yourself into a shell argument. §6 before adding a dependency. §7 before
anything that runs in the browser rather than in Node — service workers, caching, offline states.

Ported from `frontdesk`'s `docs/LESSONS.md`, whose rules were paid for in production. Land The Trick's
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

**3987 is not a free port any more, and neither is any number this file names.** T17 followed the
two lines above exactly — checked port 3000, found it clear, started `next dev --port 3987` — and
got `EADDRINUSE`. A sibling session had read the same paragraph and taken the same port, and the
*next* command still returned `200` from `http://localhost:3987`, because their server was
answering. Had the bind not failed first, every screenshot taken that afternoon would have been of
somebody else's branch. A port written into shared instructions becomes the *most* contended port
in the repo, not the least. Check the port you are about to take rather than the one the last
session took — `Get-NetTCPConnection -State Listen -LocalPort <n>` — and pick something nobody
would guess. And read the dev server's own startup output before believing a `200`: it prints the
port it bound, and a failure to bind is the only difference between "my worktree" and "theirs".

**A spec that sets `NEXT_PUBLIC_POCKETBASE_URL` itself outranks the shell that started it, and
reaches into a sibling's database.** The same session drove its screens from a throwaway
Playwright spec, ran it with `NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8097` (its own
PocketBase, its own data directory), and inside the spec wrote
`process.env.NEXT_PUBLIC_POCKETBASE_URL = 'http://127.0.0.1:8091'` — a leftover from copying the
default out of `playwright.config.ts`. The assignment wins: `createSuperuserClient()` is called
after it, so every write went to **8091, which belonged to another session**. It promoted one of
their riders to staff and created a challenge, an event, an announcement and a report in their
`.pb_e2e`.

What makes it worth a rule is how it presented. The browser talked to the right server, so the app
behaved normally; the writes returned `200`; and the symptoms were "the role did not apply" and
"the records are not on the screen" — which read as product bugs in the code under test, not as a
misdirected client. Twenty minutes went into the gate and the hooks. Two things follow. **A test
process should read its target from the environment and never write it**, because a config default
copied into a spec is a default that outranks the run. And when a write says it succeeded and the
read cannot find it, **ask which server answered before asking what the code did** — query the
instance you believe you are using and count the rows, which settles it in one command.

**A second server is a second copy of that trap, and a database makes it worse.** T6's e2e run needs
a PocketBase as well as a web server. The obvious wiring — start it on 8090, the port `pnpm pb:dev`
uses, with `reuseExistingServer` — would have pointed the suite at whatever instance a developer
already had running: their schema, their data, and e2e riders written into the database they are
working in. It runs on **8091** with its own data directory (`POCKETBASE_DATA_DIR=.pb_e2e`) and
`reuseExistingServer: false`, and the Next entry is handed `NEXT_PUBLIC_POCKETBASE_URL` explicitly
so a developer's `.env.local` cannot redirect the run. The rule generalises: **a server a test suite
starts gets its own port and its own state, or it is not the suite's server.**

The same session found the mirror image: a dev server you started *yourself* goes stale. After a
rebase, the long-lived `next dev` on the manual port kept serving 404 for a route whose files were on
disk and which `pnpm build` listed — its watcher had lost a directory the rebase rewrote (the
bracketed `[action]/[token]` pair, on Windows). Twenty minutes went into the page before the server.
If a route 404s in dev but builds, restart the dev server before reading the code.

**A dev server the harness starts for you runs in the session's working directory — which is the
shared root checkout, not your worktree.** `chore-holding-page` added a `proxy.ts`, a `/coming-soon`
route and an `.env.local`, started a preview, and got: the old landing page, a 404 on the new route,
and an environment variable that appeared not to load. Every one of those is what you would see if
the feature were broken, and none of them was: the preview tool read `.claude/launch.json` from the
**root checkout** — where a previous session had left one — and ran `next dev` there, against a
checkout with none of the new files in it. Twenty minutes went into "why is Next ignoring my env
file" before the question became "which copy of the repo is this server serving?".

Two tells name it in seconds, and both are absences, which is why they are easy to miss. Next prints
`- Environments: .env.local` on startup when it loads one; no such line means it never saw the file.
And a running `next dev` creates `.next/` within seconds — if your worktree does not have one, the
server is not in your worktree. Check the second one directly, because it cannot be argued with.

The fix is to pin the directory rather than hope: give the launch entry `pnpm -C <absolute worktree
path> --filter @landit/web dev` under a name of its own, so it cannot collide with an entry another
session left behind, and delete it when the worktree goes. The general rule: **before you trust
anything a browser tells you about your change, prove the server is serving your worktree.** It
generalises past dev servers — any tool the harness runs on your behalf inherits the session's
directory, not the one you have been editing in.

**Your shell's working directory persists between calls, so one `cd` to the root checkout redirects
every command after it — including the gates.** T16 ran `cd <root> && git check-ignore …` to settle
one question about a gitignored file, and never came back. Twenty minutes later `pnpm build`,
`pnpm test` and `pnpm lint` all ran **on `main` in the shared root checkout**. They reported
`BUILD: 0`, `TEST: 0` — a clean pass of somebody else's code — and a `LINT: 1` with **2,875 errors**
from the orphaned sibling worktrees the root still had lying about (issue #47). Every one of those
numbers is wrong about the branch, and two of them are wrong in the reassuring direction.

The tell was the test count. The run said `43 files, 661 tests`, which was exactly what it had said
before the session added two test files and seventeen tests. **A gate that does not move when you
have just given it more to do is not testing what you think.** Watch that number the way you would
watch a diff; it is the cheapest cross-check available and it costs nothing to read.

Two habits follow, and the second is the one that scales. Put `pwd && git branch --show-current`
in front of any command whose answer you intend to act on — gates especially, since `git commit`
already has that check in the protocol and the gates do not. And treat `cd` to anywhere outside
your worktree as something you undo in the same command (`(cd <elsewhere> && …)` in a subshell),
rather than a place you leave the shell standing. The same fact underlies the preview-server rule
above: the directory a tool inherits is the session's, not the one you have been editing in, and
that is true of the shell you type into as much as of the server the harness starts for you.

**Writing that entry into your worktree does not help, and there is a way round it.** T15 created
`.claude/launch.json` in its own worktree and `preview_start` refused the name outright, listing
two entries it had never heard of (`landit-web`, `t16-admin-web`) — the root checkout's file, which
is the only one that tool reads, and which two sibling sessions were also using. Editing a shared
machine-local file mid-wave to look at your own screen is a poor trade. Start the server yourself
instead, backgrounded and pinned, and hand the browser a URL rather than a name:

```
pnpm exec next dev --port 3988          # backgrounded, from apps/web in your worktree
preview_start({ url: 'http://localhost:3988/<route>' })
```

Two checks make that trustworthy, and both are one line. Next prints `- Environments: .env.local`
only when it actually loaded one, so its **absence** after you write an env file means the server
is older than the file and needs restarting — which is also the shape of Next 16's refusal to run
a second dev server per *directory*, so kill the first by port before starting the second. And the
stack trace of any server error names absolute paths: read them, and you know which checkout
answered.

**Stop your preview server before running Playwright, and do not read the error it gives you
literally.** `chore-prewave5-fixes` had a pinned preview on **3007** and ran `playwright test`,
whose `webServer` starts its own `next dev` on **3000**. The whole run died before a single test
with `Another next dev server is already running` — Next 16 refuses a second dev server per
*directory*, not per port. The message then helpfully prints the other server's port and PID, so it
reads exactly like a port clash on a port nothing was clashing over. Two different ports is not
enough; the preview has to be stopped.

**A viewport resize in the embedded browser does not reliably re-run the media queries — navigate
again before you measure.** The same session, fixing a responsive bug, resized to 1041px and read a
computed `font-size` from a `max-width: 1040px` block that `matchMedia` said in the same breath did
not match. Half the rules had recomputed and half had not. It is a convincing thing to see: the
obvious reading is a specificity or import-order problem in the stylesheet, and several minutes went
into checking one that did not exist. A fresh `navigate` to the same URL settled every reading
instantly and the numbers were consistent from then on. **Resize, navigate, then measure** — and if
a computed style and `matchMedia` disagree about the same query, believe neither until you have
reloaded.

**A scratch directory a session invents is not a directory the tooling ignores.** T12 needed its own
PocketBase beside three siblings, so it took a free port and a data directory of its own —
`.pb_t12`, on the pattern of `.pb_data` and `.pb_e2e`. PocketBase writes a 24,000-line generated
`types.d.ts` into every data directory, and the ignore lists named the two known ones literally, so
`pnpm lint` came back with **693 errors in a directory nobody had written**. The output is
convincing in the wrong direction: it is all real ESLint rules against real syntax, and the first
instinct is to go looking at the config. The tell is the path, which is the one part of that output
nobody reads.

Two things follow. Widen an ignore to a glob rather than adding your directory to a list —
`pocketbase/.pb_*/` now covers whatever the next session picks, in `.gitignore`, `.prettierignore`
and `eslint.config.mjs`. And **when a gate fails in a file you did not write, read the path before
the error**; a session that starts its own servers has by definition put new paths in the tree.

**`/tmp` is shared between concurrent sessions, so a log file with an obvious name is somebody
else's.** The gates must be judged on exit codes (§2), so T11 ran them as
`pnpm test > /tmp/test.log 2>&1; echo "EXIT=$?"` — exit code from the command, output to a file to
be read after. The exit codes were real. The *file* was not: a sibling session, running the same
minute with the same obvious filename, had overwritten it, and the summary read back said
`RUN v4.1.10 …/worktrees/t10-stickers` — 38 files and 560 tests where this branch has 39 and 589.
Spotted only because the counts had gone *down* after adding a test file.

Two things follow. Write scratch output to the **session's own scratchpad directory**, never to a
bare `/tmp/<verb>.log`; the session prompt names one and it is unique per session. And read the
first line of any test log you are about to believe: vitest prints its root directory there, which
is the cheapest possible check that the numbers under it are yours. The same applies to any file
two sessions might both reach for — `/tmp/out.json`, `~/.cache`, a fixture written beside the repo.

**Your local database is richer than CI's, and that makes a local pass a lie too.** The rule above is
about a local run reading somebody else's *code*; T9 found the same trap one layer down, in the
*data*. Its e2e spec asserted on a paywalled node in the skill tree. It passed locally, because the
session had seeded its own PocketBase to look at the screen in a browser — and failed in CI, where
`playwright.config.ts` starts an instance from the migrations with nothing in it, so the tree
rendered as an empty `<div class="tree">`. A test written against a screen you have just been looking
at inherits whatever you put in the database to look at it.

Two things follow. **Ask what the suite's database contains before asserting on content**, and if the
answer is "nothing", either seed it in the spec or assert only what holds when it is empty — never
both by accident. And **an empty collection makes assertions pass as readily as it makes them fail**:
a "no locked tricks are hidden" check over zero tricks is green and worthless, which is §5's rule
arriving through the data rather than through the harness. (T7 has since added
`e2e/support/seed-library.ts`, which is what a content screen should call.)

**Waiting for optimistic copy is waiting for nothing.** T10's e2e helper clicked a stage button and
then waited for "Logged as sometimes" before navigating to the sticker wall — and the wall was
empty, intermittently. The text it waited for is the *optimistic* stage note, which `StagePanel`
renders the instant the button is pressed; the server action, the sticker award inside it and the
`rider_stickers` row were all still in flight. Half an hour went into the page and the hook before
the question became "what exactly is that assertion waiting for?". A screen that updates before the
server answers has, by construction, two states that look the same, and only one of them means the
write landed. **Wait on something only the server could have produced** — here the toast, which is
rendered from the action's result. The optimistic path is the feature; it is also the thing that
makes a test lie.

The same line was already costing CI money elsewhere. T7's "a rookie can open a free trick and log a
stage that sticks" waited on that same optimistic note and then reloaded, which **aborted the write
in flight** — the stage genuinely did not save, so the failure was real and the test was the cause of
it. It had been filed twice as flake (issues #64, #72) and re-run past. An intermittent failure in a
screen with an optimistic update is worth reading as a race with the write before it is read as
flake, exactly as an intermittent failure in a form is worth reading as hydration (§3a).

**A sibling that merges mid-flight may have already fixed what you are about to file.** The same
session filed an issue asking for exactly that seeding helper, twenty minutes before its rebase
brought the merged helper onto the branch. Cheap to close, but an issue nobody re-checks is a
backlog item that sends the next session to build a thing twice. After a rebase that pulls in a
sibling's work, re-read the issues you filed against the state of `main` you no longer have.

**The one file that decides whether a screen is reachable is not a file N concurrent sessions
should each edit.** Wave 5 ran four sessions that each landed a screen, and every one of them
wanted a line in `apps/web/src/components/shell/nav.ts`. Four sessions appending to one array is
four rebase conflicts in the file where "resolve toward origin" (above) does its most damage:
taking origin wholesale there silently drops your own line, and the failure is invisible — a
merged, tested, working screen that simply has no way in. Nothing in CI notices, because the
screen still passes every test it has.

The answer used in Wave 5, and the one to repeat: each session adds its path to `ROUTES` — where
the entries are independent and a lost line is a compile error, not a silent gap — and **stops
there**. The nav and footer are wired once, afterwards, by a `chore-wire-wave{n}-links` session
that runs when every screen in the wave exists. It is a five-minute follow-up and it converts four
conflicts into none. `chore-wire-wave4-links` (PR #65) established it; Wave 5 planned for it from
the brief.

Two conditions make the deferral safe rather than a way to lose a screen for good. The wiring
session is scheduled **before** the wave starts, not remembered afterwards — an unwired screen is
exactly the kind of thing everyone assumes somebody else did. And the wiring is **pinned by a
test** (`e2e/landing.spec.ts` and `e2e/shell.spec.ts` both assert that a built screen is a real
link), because `typedRoutes` catches a link to a route that does not exist and nothing at all
catches a route that exists with no link to it. That asymmetry is the whole trap: the compiler
guards the direction that fails loudly and ignores the direction that fails silently.

**A screen can also be reachable and still blank the nav.** The same wiring session found that a
rider profile at `/riders/{handle}` matched no nav item, so the bar emptied on it — the prefix rule
folds `/library/{slug}` into Tricks for free, and there is no equivalent for a screen that does not
live under its own entry. It had been promised in that file's own doc comment since T5 and was
never true. When you land a screen whose path does not start with its nav item's path, say so
explicitly (`alsoActiveFor`); the bar going empty reads to a rider as having left the app, and it
does it on the screens most often reached from somebody else's link.

**Two sessions can collide in a filename neither of them shares, and git will not notice.** T18 and
`t15b-video-links` each added a PocketBase migration on the same afternoon, and each derived its
timestamp from the date the way every session before them had: `1787356800_account_erasure.js` and
`1787356800_video_links.js`. Different filenames, disjoint collections, so git merges both cleanly,
every gate is green on both branches and green again on `main`. What is left is two migrations
sharing one **ordering key**, resolved by whatever order the filesystem hands them back — which
differs between a developer's Windows box and the Linux container that runs the deploy. Nothing in
this repo would have said so; it was caught because the orchestrator was reading both branches.

The general shape is worth more than the instance: **a merge conflict is a collision git can see,
and the dangerous collisions are the ones it cannot.** Anything where two sessions independently
choose a value out of the same small space — a migration timestamp, a port, a fixture handle, a
cache key, a CSS custom property name — collides silently and lands green. Before picking one, look
at what is already on `origin/main` *and* at what the other live worktrees have added; `git worktree
list` is as much a part of that check as it is of the branch check above. T18 renumbered to
`1787443200` on a day's spacing, which is the cheap fix once you know.

**A sibling session's *correct* decision can be false by the time you merge, and it will be written
down as a comment arguing for itself.** T18 shipped the report form on the morning the clip vault was
reverted, and did the careful thing: it kept the `clip` report subject rather than hiding it, disabled
the radio, and wrote a blurb reading "There is no video on Land The Trick yet" plus a comment explaining that
hiding the option would "quietly decide video is unreportable". Every word of that was right when it
was written. T15b landed video links **hours later**, and all of it became false — leaving a live
video surface whose report route was switched off, which is the one combination §6.1's OSA duty
cannot have.

Nothing failed. No test asserted the disabled state, the copy read as deliberate, and the comment
beside it argued persuasively for the wrong thing. It was found by grepping the merged siblings for
`clips` before trusting a clean rebase — which also turned up the GDPR export naming two `clips`
fields that had stopped existing and unable to name the two that now did.

So: **after rebasing onto a session that merged while you were building, grep its work for the thing
you just made true.** Search for your collection, your route, your feature's noun — not for
conflicts, which git already showed you. What you are looking for is code and copy that *assumed your
feature absent*, and the tell is prose: a comment that explains why something is switched off is a
dated assertion about the product, and the date may have passed. A clean rebase means the two
branches did not touch the same lines; it says nothing about whether they still agree.

The reverse duty holds too, and it is cheaper: **when you ship a feature in a disabled state because
its surface does not exist yet, say in the comment which task will make it live** — T18's did, which
is exactly why the search for it took a minute rather than an afternoon.

## 2. Gates, merging and cleanup

**Gate on exit codes, never on piped output.** A `| tail` or `| tee` returns the pipe's status,
not the command's. This is the trap most likely to make a red build look green.

**Once a PR is asked for, seeing it merged is part of the task, not a follow-up.** A Wave 1
session ended its turn saying it was "monitoring the checks" on a PR that was already green, and
stopped. The PR sat open and mergeable until someone noticed. Poll until every required check
reports a *conclusion*, then merge.

**This paragraph was wrong for the whole of the 2026-08-31 policy and nobody noticed**, which is
§4 happening to §4's own author. It read "do not end a session with an unmerged PR" at a time when
ending on an unmerged PR was the rule, because the rule changed in `CLAUDE.md` and the sentence
quoting it here did not. Restored to true on 2026-09-01, when "raise a PR" started carrying the
merge with it (CLAUDE.md step 8). The lesson underneath is not about merging at all: **a rule
written in two places will be changed in one.** `CLAUDE.md` is the authority on session policy;
anything here that restates it is a copy that can rot, so quote it by reference and keep the
reasoning, not the instruction.

**Verify the merge, don't assume it.** `gh pr merge` can report an error while the merge itself
succeeded — most often the `--delete-branch` step failing because `main` is held by another
worktree (`fatal: 'main' is already used by worktree at …`). Check `gh pr view --json state`
before believing the error, and before reporting failure to the owner.

**Clean up the worktree and the branch, not just the working tree.** "Leave no uncommitted work"
is not enough: Wave 1 left four stale worktrees, each with a full `node_modules`, and four merged
local branches. After merging: remove the worktree, delete the local branch, delete the remote
branch.

**On Windows, `git worktree remove` fails on nested `node_modules`** with "Filename too long".
Mirror an empty directory over it first, then delete. **Run it from PowerShell, not the Bash
tool:**

```powershell
robocopy <empty-dir> <worktree-path> /MIR ; Remove-Item <worktree-path> -Recurse -Force
```

Then `git worktree prune`. Two separate sessions hit this and each rediscovered the fix.

**The shell matters, and getting it wrong looks like the fix working.** Run through the Bash
tool, MSYS path conversion rewrites `/MIR` as a path and robocopy refuses the whole command:

```
ERROR : Invalid Parameter #3 : "C:/Program Files/Git/MIR"
```

The mirror then does nothing, `git worktree remove` fails on `node_modules` exactly as it would
have anyway, and a session that followed this rule to the letter still leaves a full directory
behind. That is one of the ways issue #172's pile grew while the workaround was documented. From
Bash the flag has to be doubled (`//MIR`); from PowerShell it is as written above. Robocopy also
**exits 1–7 on success** — 2 means "extra files removed", which is what a successful mirror does —
so a `$LASTEXITCODE` check that treats non-zero as failure will report the opposite of the truth.

**A worktree directory can also refuse to delete while empty.** After a clean mirror, `Remove-Item`
can still return *"being used by another process"* with no `node.exe` running and no shell inside
it. It is transient: the same command a few minutes later succeeded on both worktrees this session
had stranded (2026-08-18). Retry before concluding the directory is stuck, and prefer retrying to
leaving it — the pile in issue #172 is what "I will get it later" looks like after eighteen
sessions.

**And `git worktree remove` exits 0 when that delete fails.** It prints `error: failed to delete
... Filename too long`, deregisters the worktree, returns success, and leaves the directory and its
`node_modules` on disk. A session that trusts the exit code — or that only checks `git worktree
list`, which is now clean — reports cleanup done and is wrong. Eighteen dead worktree directories
accumulated this way before anyone counted them (issue #172, 2026-08-17).

**Verify the directory is gone, not the command's status.** `ls .claude/worktrees/` after removing
costs nothing and is the only check that distinguishes "removed" from "deregistered and abandoned".

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
`CLAUDE.md`, Building and shipping, rule 5.)

**A `const` at the top of a `pb_hooks` file does not exist inside the hook.** Each hook callback
is serialised and run in its own isolated VM — the same rule the initial migration writes down
about `migrate(...)`, which is easy to read as being about migrations. It is not. T11 put five
constants at the top of `85_crews.pb.js`, and every crew creation came back **400 with
"Something went wrong while processing your request"** — no reference error, no name, and three
neighbouring test files red for the same reason. The generic message is the trap: it looks like a
validation failure, so the first twenty minutes go into the rule and the schema. Declare every
constant inside the handler that uses it, and read a nameless 400 out of a hook as a scoping
problem before reading it as a rules problem. T13 hit the identical wall the same afternoon in
`62_spots.pb.js`, from the other direction: `lib/landit.js` states the rule for `require()` and it
reads as being about imports. It is about everything the handler names.

**A JSVM helper that "returns nothing" may throw instead, and the hook takes the blame.**
`e.findUploadedFiles('file')` reads the request's multipart form; on a request that has no form —
any ordinary JSON create — it **throws** rather than returning an empty list. The clips hook had
called it unguarded since T2, so every JSON-bodied create on that collection came back as the same
nameless 400 the entry above describes, and the message named neither the field nor the cause.
Nothing had noticed because the only client was a multipart upload; T14 was the first caller to try
anything else, and spent twenty minutes reading the *collection rules* because a 400 on a create is
what a failed `createRule` looks like too. Two things. When a hook's 400 carries no field errors,
suspect the hook before the rule — the generic message is the tell, whatever produced it. And a
helper that reads part of a request is worth a `try` the first time you call it on a path the
request may not have. (The hook itself is gone — clip hosting was reversed on 2026-08-17 — but the
JSVM behaviour is PocketBase's, not ours, and the next session to call a request-reading helper
will meet it again. Kept for that reason, not for the file.)

**A hook that guards "when the client left it empty" is unguarded the day a client exists.**
`60_ownership.pb.js` minted an invite code `if (!e.record.getString('code'))` under a comment
saying "with a server-set code". Both were true while nothing created invites; T11 was the first
client, and from that moment a rider could choose their own crew's invite code — which is a
guessable code, which is a stranger-contact path in a product whose whole child-safety position is
that it has none (plan §6.1). Nothing had regressed: the branch had simply never been reachable.
When you become the first caller of merged shared code, read its guards as if you were an attacker
with the new capability, because you have just handed one out.

**A hook that tightens an existing collection breaks the tests that predate it, and that is the
sweep, not a failure.** T13 added validation to `spots` create and turned four untouched test files
red — `bmx-third-sport`, `consent-flow`, `guarantee-4-consent`, `schema-and-hooks` — each of which
submitted a spot with only the fields *its own* subject needed. Two things came out of it. The fix
for a test whose subject is something else is one line plus a comment saying which rule moved (§4's
sweep, arriving through a hook rather than through seed data). And the failures are a map of how
strict the new rule really is: three of the four wanted only a coordinate pair, and the fourth was
insisting on a `type` that nothing else in the product required — which is how that hook's floor
ended up deliberately lower than the submission form's.

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

**A layout's `metadata` is resolved before the layout runs, so it survives the gate the layout
contains.** T16 put `requireStaff()` in `app/(app)/admin/layout.tsx` — the right place, since it
covers every screen T17 adds without anyone remembering to — and a `metadata` export beside it
reading `title: 'Staff portal · Land The Trick'`. A rider who guessed `/admin` got the ordinary 404 page,
correctly, **with "Staff portal · Land The Trick" in the browser tab**. The gate had answered 404
specifically so that a probing rider learns nothing about whether a portal exists, and the tab
title handed it over.

Nothing about the rendered page was wrong, which is why this survives a code review and dies the
first time somebody looks at the screen while signed in as the wrong person. The fix is to put
`metadata` on the pages rather than the layout, so it is never resolved for a request the gate
refuses. The general form: **`notFound()` and `redirect()` control what renders, not what has
already been computed around it** — anything a layout exports statically is outside the guard, so
a gate and a title should not live in the same file.

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

**A fallback that swaps a class on the same element keeps the library's DOM.** T13's map falls back
to a placeholder when Mapbox refuses the token. Both branches returned a `<div>` in the same
position, so React reconciled them as one element and only changed its class — and mapbox-gl's
injected children came through the switch untouched. The result, with a bad token, was a hatched
"the map would not load" panel with markers, zoom buttons and a Mapbox logo floating on top of it: a
broken map that was still unmistakably a map, which is exactly what a graceful degradation is
supposed not to look like. It was found by running the screen with a deliberately invalid token,
because a *missing* token takes a different path and never showed it. Two rules: **a degraded state
is worth looking at with the failure actually happening**, not only with the dependency absent; and
when the two branches wrap an element a third-party library has written into, tear the library down
in an effect *and* give the branches different `key`s, so React removes the node rather than
reusing it.

**A default that falls back to a real value makes a signed-out screen lie.** T15's plans page is
the one screen in the app group that renders without a rider, and its view took
`currentPlanSlug` with a fallback of `'rookie'` — which is correct for a signed-in rider whose
record has no plan yet, and wrong for a visitor, because `rookie` is also the name of a card. The
free card greeted a stranger with **"Your plan"**. Nothing failed: the build was green, 715 unit
tests were green, and eight new Playwright assertions about that page were green, because every one
of them had been written against what the code did rather than against what a visitor should see.
It was found by opening the page.

The fix is one clause (`signedIn && slug === current`), and the rule is the general shape of it:
**a screen that renders in two authentication states takes "is anybody signed in" as its own input,
never as a fallback that happens to name something real.** The dangerous fallbacks are the
plausible ones — `'rookie'`, `0`, `'guest'` — because they render, and a fallback that rendered is
a fallback nobody looks at twice.

Two things follow for the checking, not just the code. **Look at a screen in every state it has**,
which for anything signed-out-capable is at least two and was here four (visitor, adult, under-16,
consent-pending); each of the other three was right, so three-quarters correct is what this class
of bug looks like from the inside. And **write the assertion as a count, not as a `.first()`**: the
spec asked whether *a* sign-up link existed and found two of three, where `toHaveCount(3)` would
have failed on the same page that was already in front of it.

**A selector that grabs the wrong control has found a screen two people can misread.** T17's
moderation queue had a filter row reading Open / Reviewing / Actioned / Dismissed, and each report
card carried buttons with the same four words. `getByRole('button', { name: 'Dismissed' })` matched
both, took the filter, and navigated instead of writing — which looked exactly like a broken server
action, and the assertion after it passed anyway because the word was still on the page. The fix was
not a better locator: the triage buttons now read **"Mark dismissed"**, which is what they do. A
Playwright name is the accessible name, so a locator that cannot tell two controls apart is a
statement that a screen reader cannot either, and that a moderator scanning a long queue at speed
will eventually get wrong. Rename the control before you narrow the selector.

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

**A rule that re-bases on data somebody else can edit takes achievements away.** Two stickers
tested `catDone` — "every live trick in this category is landed" — so a staff member adding one
trick to the library would have un-earned them for every rider who already had them, with nothing in
the product saying why (issue #78). The same trap lives in any percentage of a growing library. T10
switched both to counts, and the rule that came out of it now sits on `STICKER_RULES`: **an
achievement rule must be monotonic in the rider's own riding.** `landed >= n`, `catCount >= n` and
`landedCount(list) >= n` only ever go up; `catDone` and `pct` move when the catalogue moves. This is
the §4 problem arriving from the other direction — not a rule changing under fixed data, but data
changing under a fixed rule.

**A name that quotes a number is a name that goes stale.** The fix for the day/week streak stickers
(issue #10) could have been "4 Week Streak" and "12 Week Streak", and it would have been wrong for
the same reason the originals were: the threshold lives on the record so staff can retune it without
a deploy, so any name repeating it is one admin edit from lying. T10's names carry neither a number
nor a unit and the condition line carries both, which is the only arrangement where the editable
thing and the fixed thing cannot disagree. Generalises past stickers: **copy that quotes a value the
product lets somebody change belongs beside that value, not in a different field.**

**A vendor's name in a code comment is a thing you will have to sweep.** The transactional-email
provider changed from Resend to MailerSend the day after T6 shipped — a decision that cost *nothing*
in code, because PocketBase sends over plain SMTP and no file imports a provider SDK. It still
touched thirteen files, because the old name was written into hook comments, a test's reasoning, a
`.env.example` heading and a JSDoc block: "Resend is not provisioned yet" in four places that meant
"no SMTP is configured yet". Comments naming a vendor go stale exactly like data quoting a rule
does, and they are worse, because nothing fails when they do.

The rule that came out of it: **the vendor belongs in the plan and in `infrastructure.md`, where the
decision lives and where it is dated; code says what the code depends on.** `consent_mail.js` needs
to say that sending is best-effort when the mailer is unavailable — which is true of every provider
and was true before one was picked.

**A derived number that a client can write is not derived.** `users.streak` was client-writable,
so a rider could PATCH it to 9999 and the award hook would believe it — forging two stickers, in
a product whose plan says achievements are never for sale (issue #8). If a value feeds an award,
either the server owns the field outright or the hook recomputes it from the log.

**Reverting a feature is not `git revert`: the code comes out in one command and the promises do
not.** T14 built clip hosting; the owner reversed the decision the next day
(`chore-revert-clips`, 2026-08-17). The revert itself was twenty minutes of conflict resolution.
Everything that took longer was a *claim* the feature had left somewhere it could outlive the code:
two published legal documents promising that "the storage they sit in is private", a privacy blurb
in `@landit/core`, a plan card's headline perk, a guardian-consent capability list, the guardian
upgrade **email**, an "Upload your first clip" sticker nobody could earn any more, and an e2e test
asserting the upsell was visible. None of them import anything from the deleted code, so none of
them appear in a compiler error, a failing test, or the revert's diff.

The rule: **when a feature dies, grep for what it promised, not for what it imported.** Search the
nouns a rider would recognise — the feature's name, its units, its numbers ("vault", "clip", "GB")
— across copy, legal text, seed data, email templates, achievement conditions and test assertions,
and do it *before* claiming the revert is done. Then leave a test behind that asserts the **absence**
(`e2e/legal.spec.ts` now fails if any document says "vault" or "upload"), because the next session
to touch that copy will not know the feature ever existed. A promise made to a parent about how
carefully their child's video is stored is worse than useless once no video is stored: it is still
telling them we hold it.

**A field nobody enforces can still be load-bearing.** `plans.clip_cap_bytes` looked like pure dead
weight after the reversal — the only hook that read it was deleted in the same PR. It could not be
removed: `listPlans` sorts the plan cards by it, because it was the collection's only numeric column
and happened to rise with price, so deleting it would have silently scrambled the card order on the
plans page and in two staff screens. **Before deleting a "dead" column, grep for it in `sort`, index
and filter strings, not just in the code that reads its value** — an ordering dependency has no call
site and no type error. It survives as documented dormant data, with a test pinning the three values
ascending, and the real fix (an explicit rank column) is filed rather than improvised inside a
reversal.

## 5. Tests that cannot silently pass

**Prove a guarantee as observed behaviour, not as rule text.** T2's four §3 guarantees are
tested over HTTP against a real PocketBase instance: a private profile 404s to another rider, a
clip's bytes are refused to a forged token, a rookie is refused a paid trick — including with a
superuser token, which is what proves the hook sits at the model layer rather than the request
layer. A test that reads the rule and asserts it says the right thing proves nothing.

**A test written to tolerate either outcome cannot fail.** The MapLibre swap (2026-08-17) shipped
with an e2e test asserting the spots screen showed *"a canvas **or** the failure line"*, on the
reasoning that CI might have no route to the tile service. Both branches were true of a map that
was completely broken: a blank basemap still has a canvas. The screen went out drawing pins over
nothing, the suite was green, and the owner found it in a screenshot.

The tell is writing `or` into an assertion to accommodate an environment. When the environment
genuinely makes an outcome uncertain, **assert the deterministic thing that actually breaks** — here,
that the worker asset is served as JavaScript rather than as a 404 page — and let the uncertain part
be a separate, weaker test that is honest about being weak.

**Then try to make the new test fail, before believing it.** Three attempts at covering this bug
each passed against deliberately broken code: deleting the copied worker (Playwright's web server
rebuilt it), asserting no module 404s (worker fetches are not page responses), and asserting on the
browser's console error (it never happens headless). The reason is worth knowing generally:
**headless Chromium has no GPU, so MapLibre fails at WebGL and falls back before a worker is ever
created** — the entire failure path this bug lives on does not exist in e2e. The test that shipped
covers what it can, and says in its own comment what it cannot, so the next person does not read
green as proof the map draws. A blank basemap has to be caught by eye.

**A test that can skip is not a guarantee.** The PocketBase tests need a binary CI must download;
CI caches it keyed on `pocketbase.version` and the suite is required, so the guarantees run on
every PR. If a harness can silently no-op when its dependency is missing, it will, on the day it
matters.

**`pocketbase migrate up` exits 0 even when a migration throws.** A schema failure would
otherwise leave every rule test passing against an empty database. The harness treats an
`Error:` line as failure and a test asserts every collection exists. Assume any tool may lie
about its exit code until you have watched it fail.

**Probe a runtime's capability with a value it must reject, not one it should accept.** T8 was
about to put the weekly-streak rule in a PocketBase hook, where plan §3 puts rule enforcement. The
rule is timezone arithmetic, so the first question was whether the JSVM could do it. `Intl` is
simply absent there, which is the honest failure — but `Date.prototype.toLocaleString` accepts a
`timeZone` option, returns a plausible timestamp, and **ignores the zone entirely**. Asking one
instant for its wall clock in Europe/London and in Pacific/Auckland returns the same string, so a
probe that checked either against a hand-worked expectation could pass by luck. What settled it was
asking for `Not/AZone`: a runtime that answers a nonsense timezone is not applying timezones at all.
The consequence had it shipped: every rider's streak scored in the box's timezone, correct in
Coventry and silently wrong everywhere else, with no error anywhere. Include an input the feature
must reject in any capability probe — an accepted-and-ignored option looks exactly like a working
one. (The rule now runs in Node, in `packages/core`; plan §7, T8 records why.)

**Watch a new guarantee test fail before you believe it passes.** T4 tightened the users guard
so no client can write the streak, and wrote eleven HTTP tests around it. Green proves nothing
on its own — the tests would also have been green against a guard that did nothing, if they had
asserted the wrong status or hit the wrong endpoint. Removing the guard and re-running turned
six of them red, which is what made the green meaningful; the same check on the generated-types
drift test took one appended line. It costs one command and it is the only way to tell a
guarantee from a decoration. Do it while the guard is still fresh in your hands, not later.

**And read *which* tests went red, because that is the part that tells you what is actually
protecting you.** T16 wrote four tests that a staff role buys no write power, disabled
`guardUserWrite`, and expected four failures. **One** moved: the staff member editing their own
row. The other three — staff changing another rider's plan, suspending them, promoting them — were
never the guard's to refuse at all. `users.updateRule` is `id = @request.auth.id`, so another
rider's record 404s before a hook runs, and those three would have passed against a guard that had
been deleted entirely.

They were not wrong, they were **green through a different door**, and the comment above them
claiming otherwise was the actual defect: a future session tightening or loosening the guard would
have read three tests as covering it. They now assert the 404 as well as the unchanged field, so
each one breaks if either mechanism is widened, and the file says which door each test is standing
in. The generalisation: a passing test tells you an outcome held, never why. Breaking the thing you
think is responsible is how you find out whether it is — and when fewer tests go red than you
expected, the surplus green is information, not luck.

**A red that names the wrong thing is barely better than a green. Order the assertions so the one
that names the defect runs first.** T15b's video panel embeds YouTube behind a click-to-play gate,
because §6.8 keeps Land The Trick free of a consent banner and an iframe rendered on load would contact
Google before a child had chosen anything. The e2e test for it counted requests to Google hosts on a
cold page load and asserted zero — then the gate was removed to watch it fail, per the rule above.

It failed. It failed on `expect(Play button).toBeVisible()`, thirty seconds of timeout, in the
*setup* — because with the gate gone there is no Play button to wait for. The request counter never
ran. Anybody reading that failure would go looking for a CSS or hydration problem, and the assertion
that actually protects the guarantee had not executed. Reordered so the two network assertions come
first and the setup waits on the tile instead of the poster, the same probe fails with the real
thing: **26 requests to youtube-nocookie, googlevideo, ytimg and gstatic**, listed in the message.

Two habits. **Wait on something that exists in both the guarded and unguarded worlds** — here the
page's `<h1>`, not the control the guard creates. And **put the assertion that is the point of the
test above any convenience assertion**, because a test that cannot reach its own subject when the
subject is broken is testing its own scaffolding. The same trap is why the earlier entry above says
to read *which* tests went red: this is the version where the count is right and the reason is not.

**A probe is also a chance to check the message a stranger will read.** Include the offending values
in the failure (`expect(reached, \`page load contacted Google: ${reached.join(', ')}\`)`), and the
next person to break it is told what leaked rather than that a number was not zero.

**A bug that only exists after bundling needs a build-and-grep control, not a unit test.**
Issue #44: `createBrowserClient` read its URL as `process.env[name]`, and Next substitutes
`process.env.NEXT_PUBLIC_*` only where it appears *verbatim*, so the value never reached the
browser bundle. Under Node the dynamic and literal reads agree, so every runtime test passed
before and after the fix — the browser is the only place they differ. What actually proved it
was a throwaway client component built twice against the same env, grepping `.next/static` for
the value: absent on `origin/main`, present with the fix. Then the probe was deleted. If a
defect lives in the compiler's output, the control has to read the compiler's output; and run
the *unfixed* side too, or you have only shown that your probe compiles. (Two false starts
worth skipping: `apps/web`'s routes are under `src/app`, not `app`, and a directory starting
with `_` is a private folder Next does not route — a probe in either place builds cleanly and
proves nothing.)

**Test files share one server, so a fixture row one file edits is a fixture row every file edits.**
The PocketBase suite starts a single instance for the whole run and vitest runs the files in
parallel against it. One guarantee test proved the clip cap by shrinking the **`legend`** plan's
`clip_cap_bytes` to 2KB, with a comment saying legend was used by no other test — true when it was
written, and exactly the kind of claim the next file quietly breaks. T14 needed a nearly-full vault
too, and taking the same lever would have made both files depend on which one ran first, in a way
that fails intermittently and reads as a product bug.

What it did instead is the move worth repeating: **change the rider, not the shared row.** Fill the
per-rider thing being measured, in one request, against a rider that file created — and leave every
shared catalogue record alone. It is also the sharper test, because the planted row still goes
through the model-layer rule, which is the "including with a superuser token" property this section
opens with. When a fixture is global and mutable, look for the per-rider lever before you reach for
it; and if there genuinely isn't one, say in the *other* file's comment that you have taken the
lever, because "used by no other test" is a claim that decays. (Both clip test files are gone —
hosting was reversed on 2026-08-17 — but the suite still shares one instance and `plans`,
`stickers`, `tricks` and `challenges` are still global mutable fixtures.)

**`pnpm build` before `pnpm e2e` makes dynamic routes 404, and it looks exactly like a data bug.**
Found in `chore-revert-clips`, 2026-08-17. The gates were run, then e2e: **every `/library/[slug]`
page rendered "That page isn't here"** — ten specs across `library`, `progress`, `stickers`, `home`
and `auth`, all of them a trick-detail navigation. The library *grid* passed in the same run, so
`tricks` was plainly seeded and readable; the obvious reading is that the seed half-finished, and
the next twenty minutes go into `seed-library.ts` and the `.pb_e2e` database. Both are innocent.
`pnpm build` writes a production build into `apps/web/.next`, and the `next dev` server Playwright
then starts reuses that directory — the mismatched cache resolves the static routes and drops the
dynamic ones. Deleting `pocketbase/.pb_e2e` alone changes nothing and confirms the wrong theory;
deleting `apps/web/.next` fixes it completely.

Two rules. **`rm -rf apps/web/.next` between a build gate and an e2e run** — the gates and the e2e
suite do not share a working directory safely, and the same run order happens on every session that
follows the protocol in order. And **when a whole *route* fails while its sibling routes pass,
suspect the build cache before the database**: a data problem takes out everything that reads the
collection, not one route shape.

**A suite that reads a collection only staff can write has to seed it, or it proves nothing.**
Every e2e test before T7 wrote its own data *through the app* — a sign-up makes its rider — so the
e2e PocketBase had never needed content in it. The library is the first screen that reads `tricks`,
which has `createRule: null`, and against the empty database the whole file passed while asserting
almost nothing: no locked cards to find, so no locked cards missing. Worse, `plans` was empty too,
and the paywall hook fails *closed* on a missing plan — so every trick was refused to everyone and
"a rookie cannot track this" would have been true for entirely the wrong reason.

The seed runs in the spec's `beforeAll` (`e2e/support/seed-library.ts`), which has two consequences
worth keeping. It needs a **superuser**, and PocketBase only mints the first one from the CLI, so
the helper runs `pocketbase superuser upsert` against the same data directory the running server is
using — that works on a live instance, and it is also what stops PocketBase treating the next start
as a first run and **opening its installer page in whoever's browser is to hand**, which is what a
sibling session's instance did to the owner mid-wave. And the file sets
`test.describe.configure({ mode: 'default' })`, because `fullyParallel` splits a file across workers
and would race the seed against itself.

**In the PocketBase JSVM every field reads truthy, so `if (record.get(x))` is not the question you
think you are asking.** T18's account-deletion route began with what looked like an idempotency
guard: `if (rider.get('anonymised_at')) return { deleted: true }` — already erased, nothing to do.
An unset `date` field does not hand back `null` or `''`; it hands back a `DateTime` holding the zero
time, and a `DateTime` is an object, and every object is truthy. So the branch fired on **every**
account, the route wiped nothing, and it answered `200 {deleted: true}`. The client then cleared the
session cookie and redirected, exactly as a successful deletion does.

That is the worst shape a bug can take: a right-to-erasure request that reports success and does
nothing, on a path nobody looks at twice because the screen said it worked. It cost nothing to find
only because the tests asserted the *state afterwards* — the handle, the wiped name, the deleted
notes — rather than the response body. A test that had checked `deleted === true` would have passed
for the entire life of the defect.

Two rules. **Read a PocketBase field with the accessor that matches its type** and compare a value:
`getDateTime(f).isZero()`, `getString(f) === ''`, `getInt(f) === 0`. And when a route can succeed by
doing nothing, **assert the world changed, never the response** — `{ok: true}` is the one thing
every version of the code agrees on.

## 5a. The shell is not a text box

**Backticks inside a double-quoted shell argument execute.** Filing issue #48 — whose subject
was a flaky `pnpm --filter @landit/db test` — meant putting that command in the title. Written
as `--title "First \`pnpm --filter @landit/db test\` in a fresh worktree fails…"`, the shell ran
the command substitution: it executed the test suite **in the shared root checkout**, which the
protocol forbids, and pasted vitest's output into the issue title. The heredoc body was safely
quoted (`<<'EOF'`); the title, one argument away, was not.

Two rules. Anything containing backticks, `$` or `!` goes in single quotes or a `--body-file -`
heredoc quoted as `<<'EOF'` — never a double-quoted argument. And after creating an issue or PR,
read back what was actually written (`gh issue view N --json title`), because a mangled title is
invisible from the command that produced it: `gh` printed a normal-looking URL and exit 0.

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

## 7. The browser as a runtime you cannot see into

T19 put a service worker in front of every page. Three things it paid for, none of which any gate
would have caught.

**A library that resolves its own asset URLs at runtime will not survive a bundler, and may not
tell you.** maplibre-gl finds its web worker by reading `import.meta.url` and appending
`maplibre-gl-worker.mjs`, expecting the file to sit beside the library. Under Next it does not:
`import.meta.url` is a hashed chunk in `/_next/static/chunks/`, so the browser asked for a worker
that was never emitted, got the 404 page, and rejected the module for its MIME type.

**What made it expensive is that nothing failed.** Every tile is fetched and parsed inside that
worker, but the markers, the zoom controls and the attribution are ordinary main-thread DOM — so
they all rendered perfectly over a blank basemap. No `error` event reaches the map for a dead
worker, so the component's own failure path never ran and the screen never fell back. It looked
like a CSS problem and it was a missing file. Both `pnpm build` and CI were green throughout,
because a 404 for an asset nobody statically references is not a build error.

The fix pattern is the one the repo already uses for fonts and avatars: a sync script copies the
asset into `public/` on every `dev` and `build`, and the code hands the library an absolute path
(`setWorkerUrl`). Copy **everything the asset imports** — the worker pulls in
`maplibre-gl-shared.mjs` by relative path and fails a second way without it. When adding any
library that spawns a worker, loads a WASM blob or fetches its own chunk, check the network panel
for a 404 before believing the screen.

**The Cache API stores a body decoded and the headers that described it encoded, and only a
*navigation* notices.** `next start` gzips HTML, so a page cached by the worker kept
`content-encoding: gzip` over a body the browser had already inflated. Every way of inspecting that
entry said it was perfect — `caches.match()` found it, `response.text()` returned 27KB of real HTML,
the status was 200. Handing the same response to a navigation gave the rider Chromium's **"This page
couldn't load"** behind a 200 that came from our own worker: the network stack believed the header
and tried to gunzip plain text. The fix is four lines (`storable`, in `service-worker.ts`) —
rebuild the response without `content-encoding` or `content-length` before putting it in a cache.
The rule is the shape of it: **anything you replay to the browser has to be checked by replaying it,
because a response can read perfectly from JavaScript and still be undeliverable.** It also only
appeared in one order — read a cached page first, *then* ask for an uncached one — so the e2e test
now walks that order deliberately.

**The Browser pane cannot register a service worker at all**, and neither can a `next dev` server
prove one. `navigator.serviceWorker.register()` fails there for every script, including an existing
Next chunk, with `An unknown error occurred when fetching the script` — which reads exactly like a
bug in your worker. The environment that answers the question is `next build && next start` driven
by Playwright, which is also what Next's own offline guide says. **Before spending time on why a
browser feature does not work, check that the browser you are looking at supports it**: registering a
file you did not write is a ten-second control.

**Playwright's `setOffline` does not touch `navigator.onLine`.** It stops requests and leaves the
flag saying `true`, so the `online`/`offline` events never fire. Half a component built on that flag
looked broken when it was correct, and — more usefully — this is the *same* blind spot a park's
captive wifi has. It is why the offline banner asks the service worker whether the page came off
disk rather than trusting the browser's own flag, and why the test that stages a disconnection sets
`navigator.onLine` as well as dispatching the event. **An emulation that is wrong in the same
direction as reality is worth building for, not working around.**

**A local e2e database accumulates, so the second run of a suite is not the first.** The full suite
was 99/99 green, then failed on `events.spec.ts` — two "I'm going" buttons where the spec's comment
says there is one — because an extra `events` row had appeared in `pocketbase/.pb_e2e` between runs.
CI never sees this: it provisions the data directory fresh. Deleting the directory and re-running
returned 99/99 and settled it in three minutes. **A local suite failure that a re-run does not
reproduce is a question about the database, not about the change** — reset it before reading the
failure as yours.

**A screen can be correct, fully tested, and still take five seconds to paint — and no gate says
so.** The sticker wall rendered 65 award badges as plain `<img>` tags pointed at the committed
512px masters, ~83 KB each, into a grid whose columns are 118px wide. That is ~5 MB fetched to
draw 65 thumbnails. Every test passed, every screenshot matched, `pnpm build` was green, and the
defect was only ever visible to somebody actually loading the page on a phone (owner, 2026-09-01,
in chat). The rule that falls out of it: **when a screen repeats an asset, check what it weighs
against the size it is drawn at, because nothing else will.** The repo's sync scripts are the
place to fix it — they already run on every `dev` and `build`, so a resize step there costs the
browser nothing and cannot drift from what shipped.

Two traps inside that fix, both worth knowing before you make it:

- **A `srcset` candidate that 404s does not fall back to the `src` — it renders a broken image.**
  So the resized copies must be *offered*, never *assumed*: the master stays the `src`, the
  `srcset` is omitted entirely for anything the resize step does not handle, and the widths the
  script writes are checked against the widths the component asks for by a test that can see both
  (`apps/web/src/lib/award-art.test.ts` — `@landit/ui-web` may not import the app, so the guard
  lives beside the script, the same placement `offline.test.ts` uses and for the same reason).
- **Judge the replacement by eye, not by PSNR.** These badges score ~31 dB against their own
  masters, which reads as a bad encode; they are visually identical at the size they are drawn.
  The art carries a deliberate grain texture, and a lossy encoder smooths noise first — so the
  metric measured the one thing nobody can see. Raising quality bought 1 dB for 50% more bytes.
  Render the candidate beside the original at the true display size and look at it.
- **React writes the attribute as `srcSet` in server-rendered markup.** HTML attribute names are
  case-insensitive so browsers do not care, but a test asserting lowercase `srcset` fails against
  markup that is entirely correct. Match case-insensitively.

**Next serves everything in `public/` as `Cache-Control: public, max-age=0`.** Not "no cache" —
worse to diagnose than that, because it works: the browser keeps the file and asks every time
whether it changed. A wall of 65 badges is 65 conditional requests on every return visit, all of
them answered "no". Static assets that are not content-addressed need an explicit header and an
explicit freshness window; the window is an owner decision, because it is exactly how long a
re-drawn asset can be stale for.

**The preview pane caches dev chunks by URL, so a green audit can be measuring the previous
build.** `next dev` names its chunks by module path, not content — `_1j7xebs._.css` is the same
URL before and after an edit — and the in-app browser pane has a cache in front of the server
that keys on that URL and ignores `cache: 'no-store'`. On `fix-redesign-second-pass` (2026-09-01)
a token file gained a dark-theme block; `curl` of the chunk returned 26,843 bytes with the block,
the tab's own `fetch` of the same URL returned 25,404 without it, and the ETag was that stale
length in hex. Before that was understood, the symptom got two server restarts and a 490 MB
`.next` wipe, none of which could have helped, and a hydration warning was misread as a code bug
when it was the server rendering new code against a client still running the old bundle. Three
things follow. When a stylesheet or component change does not show, **`curl` the chunk from the
shell before touching the server** — if the bytes are right, the server is not the problem.
Any URL the pane has ever loaded is suspect for the rest of the session, so **an audit that
must be trusted runs on a port the pane has never seen**, which makes every chunk URL new. And
server-rendered HTML from `curl` is proof enough for a component change — it is the same code
the browser hydrates with. None of this affects a rider: their browser talks to the server
directly. The service-worker version of the same non-content-addressed-URL problem is #268.

## 8. Configuration that is copied between systems

Turning live email on (2026-08-18) was six DNS records and no code. It took several rounds anyway,
and every wrong turn was the same shape: a value that was correct where it was written and wrong
where it was pasted.

**A record means what it means in the zone that generated it.** cPanel's Zone Editor showed
`MX 0 landthetrick.com`, which is right inside cPanel's zone, where the apex A record is the cPanel
server. Namecheap's zone is the authoritative one and there the apex is the **web VPS**, which runs
no mail server — so copying that row across, exactly as the runbook said to, would have aimed every
incoming message at a machine that will never answer. Same trap in the SPF record's `+a`, which
means "the cPanel server" in one zone and "the web server" in the other. **When carrying a record
between two systems, resolve every name in it against the zone you are pasting into, not the one
you copied from.**

**A wildcard answers for names you never created, so "it resolves" proves nothing.** `*` → the VPS
exists for PR previews, and it was cheerfully answering for `mail` and `webmail` — with the wrong
address — before either record existed. A lookup that returns an answer is not evidence the record
is there. **Check the authoritative nameserver for the record you expect, not a resolver for an
address you hope for.**

**A form that saves silently is not a record.** Namecheap does not commit a row until its own tick
is clicked and says nothing when it is not; three of six records were simply absent afterwards,
with the page still showing them. A DKIM host typed as `default_domainkey` — underscore where the
dot belongs — saved happily and answered on a name no mail server will ever query, which is
indistinguishable from "DKIM is broken". **Reload the page and then ask DNS. The form is a claim;
the authoritative server is the fact.**

**Structure validation is not correctness.** The DKIM key decoded to a well-formed 2048-bit RSA
public key at exactly the right length, which proved only that nothing was truncated. The key
contains runs where capital `I` and lowercase `l` are identical on screen and both valid base64, so
a mis-read character yields a key that parses perfectly and verifies nothing. There is no way to
settle it by inspection — only `dkim=pass` on a real signed message does. **Copy secrets and keys
from the field, never off the screen, and prove them end to end.**

**A template that names environment variables is a claim that something reads them.**
`pocketbase/.env.example` listed five `SMTP_*` values; nothing in the repository reads one of them,
because PocketBase takes mail configuration from its settings database via the admin UI. Following
the template would have produced a tidy variable list in Coolify and an instance that still could
not send — the worst kind of wrong, because everything looks configured. The file now says so.
**A config template must say what consumes it, or it will be followed into a dead end.**

**A launch does not sweep the copy that assumed it had not happened.** `landthetrick.com` went
live on 2026-08-17. On 2026-08-18 the account screen still told a rider whose guardian email failed
that "our email is not switched on until launch" — on a launched product, with email working, which
tells a child to wait for a thing that already happened. A code comment said "there is no Stripe
account yet" a day after Stripe went live. Neither breaks a test, because both are prose: the copy
is a string with no assertion on its *meaning*, and the comment is a comment.

This is §4's rule arriving from a third direction. There, a rule changed and the data quoting it
went stale; here, **the world changed and the copy describing it went stale**. The sweep to run on
the day a launch flag flips is `grep -rn "until launch\|before launch\|not yet\|pre-launch"` across
`apps/web/src` — every hit is a sentence written by somebody who assumed today would not arrive.

The related trap for an agent, which cost the same afternoon twice: **`CLAUDE.md` is read into the
prompt at session start, so a long session can be reasoning from a copy another session has since
corrected.** Both "the site is not live" and "Stripe is not set up" were repeated to the owner from
context that was hours out of date while the file on disk said otherwise. Before telling the owner
what state their product is in, re-read the file rather than trusting the copy in context.


## 9. A third party that refuses your test browser

Wiring PostHog (§6.8) built and typechecked and unit-tested clean, and sent **nothing**. Three
things about that are worth keeping.

**The SDK classifies your test browser as a bot and drops everything, silently.** PostHog's bot
check ends `return !!navigator.webdriver`, which Playwright sets on every context it opens. With
`opt_out_useragent_filter` at its default of `false`, every event is discarded *before any network
request is made* — no error, no console warning, no failed request to notice. A headless run and a
completely broken configuration look identical. Overriding the user agent is not enough either;
`headlesschrome` is on the blocklist as well, but `navigator.webdriver` is the one that bites a
non-headless UA. Masking it with `addInitScript` for a verification run is fine, because it
changes the *browser*, not the config being tested. Setting `opt_out_useragent_filter: true` in the
app to make a test pass would not be: it would make real crawler traffic count as riders forever,
to fix a problem that only exists in the test.

The general rule: **when a third-party client sends nothing, ask what it thinks of your browser
before you re-read your own config.** Roughly an hour went into bisecting our options — every one
of which was correct — because the failure looked like ours.

**Diagnostics against a minified bundle lie in the confident direction.** The probe that said
`_requestQueue: false`, which looked like a smoking gun, was reading a field name that does not
survive minification; the real queue was there under `Io` the whole time. A property that is
`undefined` on a minified object is evidence of nothing at all. Probe by shape — "which key holds
something with an `enqueue` method" — or read the debug log the library already writes.

**`pkill` inside the same Bash call kills the caller.** Three attempts to restart a dev server
died with exit 144 before this was obvious: the `pkill -f "next dev"` matched, and took down the
process group running the command that issued it. Kill in one call, start in the next, or use the
tool's own background mode.
