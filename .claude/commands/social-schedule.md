---
description: Place the queued Land The Trick social cards into Buffer, then record what landed.
argument-hint: "[optional] 'dry' to print the calls without scheduling"
---

# Schedule the queued social posts

`.github/workflows/social-post.yml` picks the day's post, renders the card,
pushes it to the `social` branch and leaves the post in **`pending.json`** on
that branch. It cannot place it: Buffer's connector signs in as a person and a
runner has no browser session. That last step is this command.

**Prerequisite:** the Buffer connector must be enabled in this session. If
`create_post` is not available, stop and say so — do not post another way.

## 1. Read the queue

```bash
git fetch origin social
git worktree add .social-state social
cat .social-state/pending.json
```

**If `posts` is empty, stop here.** Say "queue empty, nothing to schedule" and
do nothing else. That is the normal outcome when the day is already placed.

The file carries the timezone at the top and the posts under `posts`:

```
date        the calendar day, e.g. "2026-09-14"
publishAt   local datetime, no offset, e.g. "2026-09-14T16:30:00"
angle       which of the seven post types this is
alt         alt text, used on every network
tiktokTitle short title for TikTok (≤90 chars)
image.url   the card, as a commit-pinned raw URL
groups[]    one per network: { networks: ["facebook"], caption: "..." }
```

**Do not rewrite any of it.** The captions are built from the live API and their
figures are verified; hand-editing is how a wrong date reaches a live account.

## 2. Check the account, then the card

Call `get_account` for the organization id, then `list_channels` for that
organization. Land The Trick has three: the Facebook page **Land The Trick**,
Instagram **@landthetrickapp** and TikTok **@landthetrick** — the handles
differ, so match on service, not on name. Use the exact `channelId` returned;
never a remembered one.

Then check `image.url` actually resolves (`curl -sI`). All three networks *pull*
the image from that URL, so a 404 fails at Buffer's end, after the post is in
the calendar. If it is dead, stop and schedule nothing: the workflow's push
failed and the post needs rebuilding, not rescheduling.

## 3. Place each group

For every post, for every group, call **`create_post`**:

- `channelId` — the id for that group's network
- `schedulingType` — `"automatic"` (auto-publish). `"notification"` means a
  human publishes it by hand from the Buffer phone app, which is not set up.
- `mode` — `"customScheduled"`
- `dueAt` — `publishAt` **with the UTC offset for that date appended**
  (`Europe/London` is `+01:00` in BST and `+00:00` in GMT — check which applies)
- `text` — the group's caption, verbatim
- `assets` — `[{ "image": { "url": <image.url>, "metadata": { "altText": <alt> } } }]`
- `metadata`, per network:
  - Facebook: `{ "facebook": { "type": "post" } }`
  - Instagram: `{ "instagram": { "type": "post", "shouldShareToFeed": true, "isAiGenerated": true } }`
  - TikTok: `{ "tiktok": { "title": <tiktokTitle> } }`

**`isAiGenerated` on Instagram is not optional.** The riders on every plate are
AI-generated images of young people, and the label is the honest statement of
that. TikTok's own flag applies to video only, so it is not sent there.

Work in date order. If a call fails, keep going with the rest and collect what
failed — one bad network should not cost the other two.

If `$ARGUMENTS` is `dry`, print the calls you would make and stop.

## 4. Confirm only what landed

```bash
node scripts/confirm-social-post.mjs --dates=2026-09-14
```

Pass **only the dates that succeeded**; anything omitted stays queued. Then
commit both files back to the branch the queue came from:

```bash
cp data/social/pending.json data/social/history.json .social-state/
cd .social-state
git add pending.json history.json
git commit -m "social: placed 2026-09-14"
git push origin social
```

**It has to land on `social`.** That branch is where the workflow reads the
queue from and writes the next one to, so a history log left behind means the
next run re-queues the same day and it goes out twice.

## 5. Report

How many were scheduled, for which dates, on which networks, and anything that
failed with its reason. If posts remain queued, say so and why.

## Notes

- **Buffer's free plan caps the organisation at 10 scheduled posts.** One day is
  three (one per channel). If a call is rejected for hitting the cap, stop,
  report it, and say which dates are still queued — do not delete a scheduled
  post to make room.
- **Never invent a post.** If the queue is empty, say so. Everything here is
  generated from the live API, which is what makes it safe to run unattended.
- **TikTok is slow to publish** — the launch run took about eleven minutes for
  the first post and one to four for the rest. A post that has not appeared
  immediately has not failed.
- **No rider ever appears in a post.** If a caption or a card names a rider, a
  crew or a streak, something upstream is wrong: stop and report it rather than
  editing the text.
