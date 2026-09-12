# TONE-OF-VOICE.md — how Land The Trick sounds

Derived from the copy on `main`, not invented for this document. Every example below is a real
string from the codebase with its file beside it, so a session can go and read the surrounding
copy rather than working from a paraphrase. Like `docs/FEATURES.md`, this is **orientation with
teeth**: where it disagrees with the code, the code wins and this file gets re-audited — but the
rules in §3 are decisions, and reversing one is a change to make deliberately, not in passing.

Written 2026-09-12, after an audit prompted by the owner asking whether all our content is
written the way a BMX rider or a skateboarder would speak. The short answer was no, and mostly
on purpose. This file is what "on purpose" turned out to mean once it was written down.

---

## 1. Two readers, one product

Every piece of copy here is read by one of two people, and that is the whole of the voice
question:

- **A twelve year old deciding what to try next.** They are here for the riding. They already
  know what a manual is, and being taught it in a patronising sentence is how you lose them.
- **A parent, carer or coach deciding whether to trust us with their child.** They are here for
  the money, the privacy and the safety. They are frequently anxious, frequently in a hurry,
  and slang reads to them as evasion.

The plan already fixed this register once, for the legal documents (§7, T5): *"written to be
read by a fourteen year old and their parent."* This file generalises it. The product speaks in
**two registers** and the boundary is not the screen — it is **who the sentence is for**.

---

## 2. The spine both registers share

These hold everywhere, in rider copy and in service copy alike. They are what makes the two
registers sound like one product rather than two.

**Short sentences. Ordinary words.** "Lands it every single time", not "demonstrates consistent
execution". If a sentence needs a comma to survive, it usually needed a full stop instead.

**Say the thing, then stop.** No throat-clearing, no "please note", no "we're excited to". The
landing page's whole pitch for the free tier is `Free tier, no card, keeps everything.`

**Never sell the rider something they have not done.** Achievements are never for sale (plan
§1), and the copy has to hold that line too: nothing congratulates a rider for buying, nothing
implies a paid plan lands a trick faster. The Plans page answers this outright —
`Do stickers come faster on a paid plan?` — and the answer is no.

**No hype vocabulary.** The words this product does not use: *journey, unlock your potential,
empower, seamless, effortless, elevate, game-changing, revolutionary, supercharge*. Checked
against the tree on 2026-09-12: the only hits were physical leverage in a trick tip, a real
event named *Survival of the Sickest*, and `Single whips have to be effortless` — which is a
riding instruction, not a promise. Keep it that way.

**No counts that can drift.** The landing page may not state how many tricks, parks or events
exist, because the number is wrong the week somebody adds one. "Hundreds of tricks", "parks
near you", "jams and comps". The fixed numbers allowed are the five stages, the prices (read
from `PLANS`, never typed), and the free tier's twenty-per-sport, which is pinned by a test in
`@landit/core`. See the header of `apps/web/src/app/page.tsx` for the full rule and its history.

**British English, always.** Tyre (67 uses), kerb (48), colour (105), metre (24), centred (22), programme. Prices in £. This is
not decoration: the events and spots are overwhelmingly UK, and an American spelling next to a
Leicester postcode reads as copy written somewhere else.

---

## 3. The riding voice

**Who it is for:** the rider, about riding.

**Where it lives:** the trick library (`packages/core/src/data/tricks.ts` — `about`, `tips`,
`fact`, `hard`, and the `what`/`fix` pairs), the weekly challenges
(`packages/core/src/data/challenges.ts`), the glossary
(`packages/core/src/data/glossary.ts`), the landing page (`apps/web/src/app/page.tsx`), the
story page (`apps/web/src/content/story.ts`), and the headings and empty states on the riding
screens — library, progress, stickers, crew, challenge, home.

**How it sounds.** Like a slightly older rider who is good at explaining and cannot be bothered
to flatter you.

> `A half-hearted 90 is how pedals catch.` — BMX, Hop 180
> `Melons first — this is the same edge with the other hand.` — Skate, Stalefish
> `You have to over-rotate the 360 for weeks before this clicks.` — Scooter, Double Whip
> `Three tricks you already have, done somewhere you’ve never done them.` — a weekly challenge
> `Your wall is empty. That’s the fun bit.` — the sticker wall, empty

The rules underneath those:

- **Contractions are normal here.** "You’ve", "don’t", "it’s", "you’re". The challenge copy and
  the trick copy already do this throughout and they are the best-written thing in the product.
- **Use the sport's own words, and the right sport's.** Tyre taps and pegs are BMX; bolts and
  trucks are skate; deck and headtube mean different things in each. Every word a twelve year
  old might not know should exist in the glossary — that is what the glossary is for, and
  `glossaryMatches` links the first mention automatically.
- **Be specific about the body, not the feeling.** "Keep your shoulders over the deck as you
  pop" beats "commit and believe in yourself".
- **Honesty about difficulty is the point.** "It feels backwards for weeks." "Only after
  backflips are boring." A tip that pretends a hard trick is easy is the one that gets someone
  hurt, and the five-stage model exists precisely because riders lie to themselves about this.
- **Never dare a rider into anything.** Tips may say a trick is hard and say where to learn it
  safely — foam pit, resi ramp, small drop first. They may not imply that hesitating is
  cowardice.
- **No slang the rider would not use about themselves.** We do not write "shred", "stoked",
  "gnarly" as adjectives in our own voice. *Gnarly* is a difficulty tier name
  (`Rookie · Easy · Spicy · Gnarly · Pro`) and that is the only place it appears.

---

## 4. The service voice

**Who it is for:** the rider and the adult behind them, about money, safety, privacy, consent,
accounts and anything that went wrong.

**Where it lives:** the legal documents (`apps/web/src/content/legal.ts`), the guardian consent
flow, the plans and billing copy, the report and safeguarding screens, the auth forms, every
error message, and the two guardian emails.

**How it sounds.** Calm, exact, and unembarrassed. Nobody is being jollied along.

> `Doing nothing is also an answer — the account stays as it is.` — the guardian decision screen
> `Everything you have logged is still here and still yours. You can ask again, or ask somebody else.`
> `Crews are invite-only — there is no list to browse and nobody can find you.`
> `If it is urgent and about somebody’s safety right now, call 999. We are not an emergency service.`
> `That plan is not set up for payment yet. Nothing has been charged.`

The rules underneath those:

- **Uncontracted, and deliberately so.** "It is", "cannot", "does not", "you are". The flatness
  is the feature: it is the register a parent reads as straight-dealing rather than matey. This
  is the single biggest difference from §3 and the easiest one to get wrong by writing on
  autopilot.
- **Say what happened to the rider's money and the rider's data, always.** "Nothing has been
  charged" is not boilerplate; it is the sentence that stops a child telling a parent they think
  they have been billed. Same for "The request is recorded" and "what they logged against it is
  kept".
- **Name the object.** "We could not load the spots", not "Something went wrong". A message
  whose subject is "that" is only acceptable when the thing acted on is the thing the rider just
  touched, one element away.
- **Promise only what exists.** The plan's §7 T5 record is the precedent: the one-working-day
  reply on `safeguarding@` shipped because it is a commitment the owner makes and nothing had to
  be built; the reporting claim was softened to what actually existed until T18 built the
  buttons. Copy never describes a control that does nothing.
- **Never blame the rider for our failure.** `We could not get it to them just now — that is our
  end, not yours.`
- **Never imply a rider is in trouble.** The report flow tells them `we will not tell anyone you
  did this` before it asks them anything.

### 4a. One recovery sentence, on purpose

`Try again in a moment.` appears 50 times, and that repetition is **correct and documented** —
see the `MESSAGES` table and its comment in `apps/web/src/lib/runAction.ts`, which chose one
wording per condition on the grounds that *"a second wording for the same thing is a second thing
a rider has to work out."* Do not "improve" this by varying it. The four sentences are:

| | Ours | Theirs (no signal) |
| --- | --- | --- |
| **A write** | That did not save. Try again in a moment. | No signal, so that did not save. Try again when you are back online. |
| **A read** | That could not load. Try again in a moment. | No signal, so that could not load. Try again when you are back online. |

A screen with a more specific object says the object and keeps the same tail: *"We could not load
the spots just now. Try again in a moment."* And none of them may promise to catch up later —
nothing is queued (plan §2.3), so every one asks the rider to come back and do it again.

---

## 5. Mechanics

**Apostrophes.** One form, `’` (U+2019), in every string literal. In JSX *text* nodes write
`&rsquo;`, which is what the 62 existing ones do. `&apos;` is not used: it renders as the straight
form, which is how six of them hid from an audit that only looked for `'`. The exception is deliberate: real-world names,
towns, venues and postal addresses keep the straight `'` they are published with — *Paine's
Park*, *Rue d'Accolay*, *St Margaret's Way*. They are 14 strings in
`packages/core/src/data/spots.ts` and `events.ts` and they are data, not our typography.

**Where a copy change actually lands.** The trick library, challenges, spots, events, stickers
and plans are served from PocketBase rows, not from `@landit/core` at request time — core is the
canonical source the seed writes from. So editing `packages/core/src/data/tricks.ts` changes
nothing a rider sees until somebody re-runs `pnpm --filter @landit/db seed`, which is idempotent
and is the documented way to update a database that already has riders on it
(`pocketbase/README.md`). Copy compiled into the app — headings, buttons, errors, the landing
page, the glossary, avatar and privacy labels — ships with the deploy. A copy task that touches
both needs to say which half is waiting on a seed.

**Plan card copy is duplicated into a migration** (`pocketbase/migrations/1789171200_free_tier_twenty.js`)
and a test holds the two in sync. Changing a `PLANS` perk string therefore means changing the
migration too, or adding a new one — which is why `This week's challenge` still carries a straight
apostrophe when nothing else does. Left deliberately: a migration against live plan rows is not a
typography errand.

**Em dashes** are fine in app copy and are used well. They are banned on the story page only
(owner, 2026-09-12, in chat), where none of them were in the rider's own speech.

**Quotes** are `&ldquo;`/`&rdquo;` in JSX text, `“ ”` in literals.

**Middots** separate peers in a label: `Parks near you · no sign-up`, `Landed 17 Aug`,
`Trick page · the stage is the whole score`. Not a hyphen, not a pipe.

**Sentence case for everything a person reads.** Uppercase is a *design* token — eyebrows and
9.5px labels are uppercased in CSS, not in the string.

**Never state a rider's surname or email in copy**, and never let an analytics property carry
anything a rider typed (`apps/web/src/lib/analytics.ts`). Catalogue facts only.

---

## 6. What the product never says

These are the child-safety position expressed as copy, and they are load-bearing (plan §6.1).
A session that finds itself writing one of these stops and flags it:

- Anything implying riders can **find, follow or message each other**. There is no discovery, no
  rider-to-rider messaging and no algorithmic feed. Crews are invite-only and the copy says so
  every time it mentions them.
- Anything implying a clip or a profile is **public by default**. Profiles start private; clips
  are never public.
- Anything that reads as a **leaderboard against strangers**. Riders compare with a crew they
  invited. `Not follower counts.`
- Anything that makes a **paid plan sound like skill**.

---

## 7. Where to look before writing

| You are writing | Read first |
| --- | --- |
| A trick's copy | `packages/core/src/data/tricks.ts`, and three neighbours in the same sport |
| A weekly challenge | `packages/core/src/data/challenges.ts` |
| An error or a refusal | `apps/web/src/lib/runAction.ts`, then §4a above |
| Anything a guardian reads | `apps/web/src/app/consent/`, `apps/web/src/content/legal.ts` |
| Anything about a plan | `apps/web/src/app/(app)/plans/`, and `PLANS` for the prices |
| Marketing | `apps/web/src/app/page.tsx`, including its header comment |

---

## 8. What this file does not settle

**The contraction boundary is a recommendation, not yet a ruling.** §3 and §4 describe the split
the copy already half-observes: on 2026-09-12 the rider-facing strings held roughly 560
uncontracted forms against 98 contractions, and the contractions clustered in exactly the places
§3 names — trick copy, challenges, landing, story — while the flat register clustered in §4's.
Writing it down as the rule is this file's proposal. The alternative the owner may prefer is
uncontracted everywhere outside marketing, which is more consistent and slightly stiffer. Until
that is answered in chat, follow §3 and §4 and do not go back through existing copy changing
contractions either way.

**The riding screens are the grey area.** A library empty state is riding copy by §1's test and
service copy by where it sits. Current copy leans riding — `You are not tracking anything yet`
is the uncontracted odd one out among its neighbours. Left alone deliberately: a sweep of these
is a copy task with an owner's decision in front of it, not a tidy-up.
