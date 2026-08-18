# PocketBase email templates

The two auth emails PocketBase sends itself, in the design language
(`design-handoff/`, "Land It — email set", Version 2). Table markup, inline styles and a
`display:none` preheader, because a `<style>` block and a Google font do not survive Gmail or
Outlook. The font stacks fall back to Impact and Arial Narrow, which is what the design specifies.

**These files are reference copies, not the live thing.** PocketBase keeps its templates in the
settings database, not on disk — paste them into Collections → users → Edit collection → Options in the admin UI. They are in the
repository so the design is version-controlled and reviewable, and so a rebuilt instance has
something to paste. The live copies ride in `/pb_data`, which Litestream replicates
(`docs/infrastructure.md`).

| File | PocketBase template | Status |
| --- | --- | --- |
| `password-reset.html` | Default password reset | **Ready to install.** |
| `verify-email.html` | Default verification | **Do not install yet** — see below. |

## Placeholders

PocketBase substitutes `{APP_URL}`, `{TOKEN}` and `{APP_NAME}`. Both files use the first two.

**The link matters more than the markup.** PocketBase's stock templates point at its own admin UI
(`{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}`), which with `APP_URL` set to the web app
gives a rider a 404 instead of a password reset — observed on the live instance 2026-08-18.
`password-reset.html` points at `{APP_URL}/reset-password?token={TOKEN}`, which is the route
`apps/web/src/app/(auth)/reset-password/page.tsx` actually serves.

## Two things to set before pasting

1. **The reset copy claims the link "expires in 60 minutes"**, in the body and the preheader,
   because the design says so. PocketBase's own token duration sits beside the template
   on that same Options tab. Either set it to 3600 seconds or change both numbers. **A promise about
   expiry that the server does not keep is worse than no promise**, because the rider who waits
   fifty minutes is the one who finds out.
2. **`verify-email.html` has nowhere to land.** Its button points at `{APP_URL}/verify-email`, a
   route the web app does not have — nothing in the app gates on `verified`, so sign-up never
   requests verification and the path has never existed. Installing it would swap one broken link
   for another. It waits on two things that are the owner's: whether email verification is turned
   on at all, and the route to serve it.

## Not implemented from the design set

Seven of the nine designed emails are not here, and not by oversight:

- **Crew invite** sends mail to an address one rider types about another. That is the
  rider-to-rider contact surface plan §6.1 rules out, and it is not a session's call to add.
- **Sticker pack posted** is physical fulfilment to riders — postal addresses for children — and
  is scoped to Crew Pass, a tier dropped for Legend.
- **Plan receipt** sells "unlimited clips"; clip hosting was reversed 2026-08-17 (§6.6).
- **Streak at risk is not an open question — the plan already answered it, no.** Plan §6.4,
  Standard 13 of the Children's code, names loss-framed notifications as a thing this product does
  not build, and `packages/core/src/rules/nudges.ts` exists so that the rule has an enforcer rather
  than a sentence in a document. The designed email is that pattern exactly: subject *"Your 11-day
  streak ends tonight"*, preheader *"Log a session before midnight and it carries"*, sent at 6pm.
  Marking it "off by default for under-16 accounts" does not rescue it — the commitment is not
  age-scoped. Building it would reverse a published child-safety position.
- **Welcome, sticker earned and weekly recap** are open questions rather than closed ones; none of
  the three is loss-framed. Each needs a scheduler, a per-rider preference and an unsubscribe link,
  and each must route through `nudges.ts`: nothing sends between 21:00 and 07:00 in the *rider's*
  timezone, and that window is not a knob a caller may widen. The guard is written and has no
  callers yet.

The guardian-consent email is not in the design set either. It is built in
`pocketbase/hooks/lib/consent_mail.js`, composes its own links, and its copy was written for a
parent who has never heard of us — restyling it is a deliberate job, not a side effect of this one.

## Where these live in the admin (PocketBase 0.39)

**Not** under Settings → Mail, which by this version holds only SMTP and the sender pair. Both
templates and both token durations are properties of the **auth collection**:

> Collections → `users` → ⚙ Edit collection → **Options**

That is where the verification, password-reset and email-change templates are edited, and where the
password-reset token duration sits. Two people looked for them under Settings first; the mail
settings page is the obvious place and the wrong one.
