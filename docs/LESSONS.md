# LESSONS.md — the process rules this build paid for

Every rule here was earned by something that went wrong, or nearly did, in a real session.
Provenance is noted so the reason survives the rule — a rule whose war story is lost gets
argued away by the next session that finds it inconvenient.

**How to read this file:** §1 before starting any session that runs beside another (which is
most of them). §2 before your first commit. §3 before touching `packages/core`, `packages/db`,
`packages/ui-web` or `pocketbase/`. §3a before building a screen whose neighbours are still a wave
away, or putting a design-system class on a tag the prototype never used. §4 when you change what a
rule *means*. §5 before writing a test that guards one of the §3 guarantees. §5a before putting
anything you did not type yourself into a shell argument. §6 before adding a dependency.

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
any ordinary JSON create — it **throws** rather than returning an empty list. `50_clips.pb.js` had
called it unguarded since T2, so every JSON-bodied create on `clips` came back as the same nameless
400 the entry above describes, and the message named neither the field nor the cause. Nothing had
noticed because the only client was a multipart upload; T14 was the first caller to try anything
else, and spent twenty minutes reading the *collection rules* because a 400 on a create is what a
failed `createRule` looks like too. Two things. When a hook's 400 carries no field errors, suspect
the hook before the rule — the generic message is the tell, whatever produced it. And a helper that
reads part of a request is worth a `try` the first time you call it on a path the request may not
have.

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
reading `title: 'Staff portal · Land It'`. A rider who guessed `/admin` got the ordinary 404 page,
correctly, **with "Staff portal · Land It" in the browser tab**. The gate had answered 404
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
parallel against it. `guarantee-2-clips.test.ts` proves the clip cap by shrinking the **`legend`**
plan's `clip_cap_bytes` to 2KB, with a comment saying legend is used by no other test — true when it
was written, and exactly the kind of claim the next file quietly breaks. T14 needed a nearly-full
vault too, and taking the same lever would have made both files depend on which one ran first, in a
way that fails intermittently and reads as a product bug.

What it did instead is the move worth repeating: **change the rider, not the shared row.** A
superuser can create a `clips` record that declares a `size` and carries no file, so the vault fills
in one request against that rider alone, and no `plans` record moves. It is also the sharper test —
the planted row still goes through the model-layer cap, which is the "including with a superuser
token" property §5 opens with. When a fixture is global and mutable, look for the per-rider lever
before you reach for it; and if there genuinely isn't one, say in the *other* file's comment that
you have taken the lever, because "used by no other test" is a claim that decays.

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
