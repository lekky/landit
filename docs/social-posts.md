# Daily social posts

One card a day to Facebook, Instagram and TikTok, built from the same live API
the website reads and scheduled through Buffer.

- **What it posts** — a painted card plus a caption, filled from
  `api.landthetrick.com`. Every figure comes from the API and every sentence
  from a template; nothing is written fresh, which is what makes unattended
  posting safe.
- **When** — daily at **16:30 London**, after school and before the evening.
- **Settings** — [`scripts/social/config.mjs`](../scripts/social/config.mjs) is
  the one file to edit: time, timezone, networks, how far ahead to build, link
  tagging, and the band of clear paper each plate leaves.

---

## The week

| Day | Post | Source |
| --- | --- | --- |
| Monday | **New challenge**, on the Mondays a fortnight opens; **last week to log it** on the Mondays between | `challenges` |
| Tuesday | **Trick of the week**, rotating scooter → skate → BMX | `tricks` |
| Wednesday | **Spot of the week** | `spots`, researched ones only |
| Thursday | **This weekend**, up to four events spread across countries | `events` |
| Friday | **Sticker drop**, the real sticker art for a trick | `tricks` + `packages/ui-web/assets/stickers` |
| Saturday, Sunday | **Feature posts** — Rookie is free, the five stages, the map | `FEATURES` in `angles.mjs`, counts from the API |

An angle with nothing behind it falls back to a feature post rather than
printing an empty card.

## Choosing is deterministic

The weekday picks the angle; the candidate within it comes from a draw seeded by
the date. Same date and same history always give the same post, so a dry run
shows exactly what will go out, and a workflow that retries cannot produce a
different card. Repetition is held off by three cooldowns in `config.mjs`:

- the same **key** (this trick, this spot) is blocked for 400 days
- the same **subject** (the town, the trick behind a sticker) is damped for 30
- if everything is blocked, the raw weights come back — a quiet pool still posts

## The cards

Each card is a **plate** — painted artwork with the riders, the paint splashes,
the skatepark and the headline that repeats every week ("TRICK OF THE WEEK") —
with the part that changes rendered over it in Knewave.

The plates leave **less room than they look like they do**: the palms begin
around y=900, so the clear band is roughly 250px tall on a 1350px card. Every
band is measured and recorded in `PLATES` (`config.mjs`), and a layout is a flex
column centred inside it, so a long trick name shrinks to fit rather than
landing in a tree. Change a plate and the band has to be re-measured.

Cards are rendered in a real Chromium (`scripts/social/render.mjs`) because the
brand is SVG filters, blend modes and web fonts — a lighter renderer drops
exactly those. Output is **1080×1350 JPEG**: Instagram's 4:5 exactly, and TikTok
rejects `image/png` on a photo post.

## Two halves, because CI cannot sign in to Buffer

| | **the workflow** | **the command** |
| --- | --- | --- |
| What | picks, renders, pushes the card, queues the post | places the queue into Buffer |
| Where | `.github/workflows/social-post.yml`, daily at 14:00 UTC | `/social-schedule` in a Claude session |
| Why | a runner has a browser for rendering | Buffer's connector signs in as a person |

Buffer's connector is OAuth: it acts as the account holder, and a cron job has
no session to act with. So CI does everything up to the last step and leaves the
finished post in `pending.json`; placing it takes a session with the Buffer
connector enabled. That session is a scheduled routine, so in practice this is
unattended — but the split is why a failed routine leaves a queue behind rather
than a gap.

## State lives on the `social` branch

An orphan branch holds the rendered cards (`images/`), the queue
(`pending.json`) and the history log (`history.json`). Keeping them off `main`
means the daily commit never looks like the site moved.

`history.json` is **state, not a log**: the cooldowns read it, so it has to
survive a runner being recycled, and a post that went out but was never recorded
comes round again tomorrow.

Image URLs are pinned to a **commit SHA**
(`raw.githubusercontent.com/<owner>/<repo>/<sha>/images/2026-09-14.jpg`) rather
than to the branch name. A branch-name raw URL is CDN-cached for about five
minutes, and on the launch run that meant a stale image being served to
Instagram after a re-render.

## Links, and what can be measured

**Only Facebook makes a URL in a post clickable.** On Instagram and TikTok a
tagged link is unclickable clutter that also reads as spam. So Facebook captions
carry `?utm_source=facebook&utm_medium=social&utm_campaign=daily-post` and the
other two get the clean address; their performance is read in Buffer's own
per-post analytics rather than in PostHog.

The app strips query strings from URL properties before they reach PostHog
(`scrubProperties` in `apps/web/src/lib/analytics.ts`), but campaign parameters
arrive as their own properties and are not in the denylist, so `utm_source`
should survive. **Confirm that on the first tagged post**; if it does not, the
fix is an allowlist in that file, not a change here.

## What never appears in a post

No rider, ever. No names, no handles, no streaks, no leaderboards, no crews, no
clips, nothing a rider typed. The pipeline does not read a single rider-owned
collection, which is the simplest way to keep it that way — and it is the same
line the product holds everywhere else (plan §6.1).

Instagram posts are sent with `isAiGenerated: true`. The riders on the plates
are AI-generated images of young people and the label is the honest statement of
that.

## Running it by hand

```bash
node scripts/build-social-post.mjs --dry-run        # choose and print, render nothing
node scripts/build-social-post.mjs --date=2026-09-14
node scripts/build-social-post.mjs --days=3
```

Cards land in `.social-out/` (gitignored). Then `/social-schedule` places
whatever is in the queue, and `node scripts/confirm-social-post.mjs
--dates=…` records only what actually landed.

## Adding a post type

1. Add the angle to `ANGLES` in `angles.mjs`, and to the weekday map if it has a
   day of its own.
2. Add a builder branch to `candidatesFor` in `candidates.mjs`.
3. Add a composer to `COMPOSERS` in `caption.mjs` and a layout to `LAYOUTS` in
   `card.mjs`.
4. Register its plate in `PLATES` with a **measured** band.
5. Add a fixture to `FIXTURES` in `social.test.js` — a test asserts that every
   angle has a caption, a layout and a fixture, so this is enforced.
