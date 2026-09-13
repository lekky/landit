# Social posts, made by hand

The playbook for a post a person asks for and a person makes: the owner asks a session for
"a social post", the session writes the words, ChatGPT renders the image against past posts,
and Buffer places it.

> **This is the manual half, and it is deliberately not the whole story.** A separate,
> finished-but-unmerged branch — `feat-social-daily` — builds an **automated** daily card from
> the live API and documents itself in `docs/social-posts.md`. That doc is the authority on
> anything automated: the daily rotation, the plate artwork, the cooldowns, the Buffer split.
> **If that branch merges, fold this file into it rather than keeping two.** What is below is
> the part a pipeline cannot do — the posts that need a person's judgement, a person's footage,
> or a same-day reaction.

## The slot structure

Every poster is five slots. Derived from the posts actually on the accounts, not from the
design pack.

| Slot | What it is |
| --- | --- |
| **Headline** | Brush script, mixed case, 2–4 words. Often a phrase or a question. |
| **Sub-line** | One short sentence. The promise. |
| **Content block** | One of: stat trio · big number · icon row · dated event cards · comparison columns · numbered steps. |
| **Kicker** | Optional. One line under the block. |
| **URL bar** | `landthetrick.com`, or a deeper path where one fits. |

A session writes those five slots and a caption. It writes **no styling**: the style is carried
by attaching past posts to ChatGPT as references.

## The types

Ten. Each has a source that refills on its own, so a type never runs dry.

| # | Type | Source | Automated? |
| --- | --- | --- | --- |
| 1 | **What's On** — dated events, today or this weekend | `packages/core/src/data/events.ts` | Partly — the pipeline does "this weekend"; **same-day** is manual |
| 2 | **Challenge** — the new fortnight going live | `packages/core/src/data/challenges.ts` | Yes |
| 3 | **Trick of the Week** — one trick, its tips | `packages/core/src/data/tricks.ts`, 259 tricks | Yes |
| 4 | **Spot of the Week** — one real park, its features | `spots`, researched ones only | Yes |
| 5 | **Sticker drop** — the real award art for a trick | `packages/ui-web/assets/stickers` | Yes |
| 6 | **Mistakes & fixes** — "why your X won't Y" | T28 `mistakes` on every trick | **No — manual** |
| 7 | **Word of the Week** — one glossary term | 84 glossary words | **No — manual** |
| 8 | **Streak & habit** — two rides a week | `packages/core/src/rules/streak.ts` | **No — manual** |
| 9 | **Founder / behind the scenes** — Miles, the ramp, real riding | `/story`, the owner's own footage | **Never — needs a person** |
| 10 | **For parents** — no messaging, no feed, private by default | plan §6.1 | **No — manual** |

Type 9 is the one no pipeline will ever reach, and on the evidence so far it is the one that
earns the most goodwill. It needs real footage and a real sentence, so it stays a person's job.

## Rotation rules

- **No type twice in seven days.** No type more than twice in a fortnight.
- **Rest a type that has just been spent.** Six feature-explainer posts went out inside one
  hour on 11 September 2026; that type was benched until October as a result. A burst buys a
  drought.
- **Alternate product content with human content.** Types 3–8 and 10 are the product;
  type 9 is the people. A run of either alone reads as a brochure or as a diary.
- **Timely beats evergreen, by a lot.** The same-day events post ("On Today", 12 September)
  took roughly six times the plays of any evergreen post made the day before. Date a post
  wherever a date is honest.

## Figures come from the code, never from a doc

`docs/FEATURES.md` is a snapshot and drifts. A number that goes on a poster is read from
`packages/core/src/data/` or from the live admin, and a number that cannot be verified before
posting does not go on the poster — the headline is rewritten without it instead.

This has already bitten once: a session derived "35,000 parks" by adding raw import rows in
`FEATURES.md`, when the real per-sport counts were 3,435 scooter / 3,462 skate / 210 BMX.

## What never appears in a post

No rider, ever. No names, no handles, no streaks belonging to a person, no leaderboards, no
crews, no clips, nothing a rider typed. Type 8 is the *rule* — "two rides a week" — never a
rider's actual streak. This is the same line the product holds everywhere else (plan §6.1).

Instagram posts carrying the AI-painted plates are sent with `isAiGenerated: true`. The riders
in that artwork are AI-generated images of young people and the label is the honest statement
of that.

## Where things live

- `marketing/social/` — finished posters, named `YYYY-MM-DD-<slug>-<n>-<part>.png`.
- Buffer holds the queue. Its free plan caps the **whole organisation at 10 scheduled posts**,
  and one day costs three (one per channel), so roughly three days can sit queued at once.
- `marketing/` is outside every package and is referenced by no tsconfig or turbo pipeline, so
  nothing here enters a build.
