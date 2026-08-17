import { CONTACT, SPORT_IDS } from '@landit/core';

import { countWord, sportsList } from '@/lib/sports';

/**
 * The five legal documents.
 *
 * **Not a transcription.** `design-handoff/design/landit-legal.jsx` describes a
 * consent mechanism that no longer exists: it routes under-13s to "a parent's
 * Crew Pass" and lets one adult hold five rider accounts. The Crew Pass was
 * dropped in plan §2.4 and consent moved into the sign-up flow (§6.2), so the
 * age, consent and safeguarding sections here are written against §6.1–§6.4
 * rather than copied. Everything else keeps the pack's wording and its
 * register: written to be read by a fourteen year old and their parent.
 *
 * Three things that look like small wording choices and are not:
 *
 * - **No minimum age is stated anywhere** (§6.2). A service that claims one has
 *   to enforce it with highly effective age assurance, and a tick-box is
 *   explicitly not that. Do not add "13+" to these documents.
 * - **Profiles are described as starting private** (§6.4 standard 7, §3
 *   guarantee 1). `DEFAULT_PRIVACY` in `@landit/core` currently says `members`;
 *   that disagreement is filed as an issue, and the plan is the authority.
 * - **The reporting paragraph named email only until T18 built the buttons.**
 *   T5 softened it on the owner's decision (Rachid, 2026-08-16) because the
 *   controls it described did not exist; T18 is what made them exist, so the
 *   softening is gone and the paragraph now names the profile and spot controls,
 *   the signed-out form at `/report`, and the appeal route against our own
 *   decisions — the OSA complaints procedure in §6.1. It says nothing about
 *   clips, because after the reversal below there is no video surface to report;
 *   when `t15b-video-links` lands, whoever builds it adds the control and the
 *   sentence together, not one without the other. The one-working-day response
 *   on `safeguarding@` ships as written, same decision as before.
 * - **"We do not host video" is a statement of fact, not a promise about
 *   storage** — decided by the owner (Rachid, 2026-08-17). Until then this file
 *   said "Clips you upload are yours, and only you can watch them… the storage
 *   they sit in is private", which described a clip vault that has been removed
 *   (plan §1, §6.6, §3 guarantee 2). It was replaced rather than softened:
 *   there is no upload, so a sentence about how carefully the uploads are kept
 *   would be true only because it is vacuous. When `t15b-video-links` lands,
 *   riders will paste **YouTube links** and these documents will need a
 *   paragraph about what a link means — the video is on YouTube, under
 *   YouTube's terms, and its Land It visibility is capped by profile privacy.
 *   Do not pre-write that here; it is not built yet.
 *
 * Anything the owner has not decided is absent rather than invented: there is
 * no data-controller section and no named accountable individual here, because
 * §6.5 has not settled either.
 */

export type LegalDocId = 'privacy' | 'terms' | 'safeguarding' | 'cookies' | 'about';

export interface LegalSection {
  readonly h: string;
  readonly p: readonly string[];
}

export interface LegalDoc {
  readonly id: LegalDocId;
  readonly title: string;
  readonly updated: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
}

/** Still true: §6.3 leaves the EEA table and the US posture for counsel. */
export const LEGAL_DRAFT_NOTICE = 'Draft copy, pending legal review before launch';

/** "Two" today, "Three" the day T21 lands BMX. Never a literal. */
const libraryCount = (() => {
  const word = countWord(SPORT_IDS.length);
  return word.charAt(0).toUpperCase() + word.slice(1);
})();

export const LEGAL_DOCS: readonly LegalDoc[] = [
  {
    id: 'privacy',
    title: 'Privacy policy',
    updated: 'August 2026',
    intro:
      'What we collect, why we collect it, and how to get rid of it. Written to be read by a fourteen year old and their parent.',
    sections: [
      {
        h: 'What we collect',
        p: [
          'An email address and a display name so you can sign in. Nothing else is required.',
          'Your country, and an age band: under 13, 13 to 15, 16 to 17, or adult. Signing up asks for your date of birth, works the band out on your own device, and then throws the date away. It is never sent to us, so there is no birth date here to lose.',
          'The tricks you track, the stages you set, your streak, your stickers and any notes you add. This is the point of the app.',
          'Optional details you choose to add: your picture, stance, riding level, goal and the events you mark yourself down for.',
          'Basic technical data every website gets: device type, browser and rough region, used to keep the service running and secure.',
          'If you are young enough to need a parent or guardian to approve the account, their email address, so we can ask them. See Younger riders below.',
        ],
      },
      {
        h: 'What we never do',
        p: [
          'We do not sell your data, and we do not share it with advertisers. There are no ads in Land It.',
          'We do not show your surname or email address on any public profile.',
          'We do not host video. There is nowhere in Land It to upload a clip, and no video of yours sits on our servers.',
          'We do not track you across other websites.',
          'Nothing you see in Land It is chosen for you by an algorithm. There is no feed, and no guessing at what would keep you here longer.',
        ],
      },
      {
        h: 'Who can see your profile',
        p: [
          'You choose. Public means anyone with the link sees your tricks, stickers and streak. Riders only means people signed in to Land It. Private means nobody but you.',
          'New accounts start private. Being visible is a choice you make, not the setting you are handed.',
          'Your crew sees your name and score on the crew board whichever setting you pick, and nothing else of yours goes on the board.',
        ],
      },
      {
        h: 'Video',
        p: [
          'Land It does not host video. There is no upload, and no clip of yours is stored on our servers.',
          'Delete your account and everything we hold about you goes with it.',
        ],
      },
      {
        h: 'Younger riders, and their parents',
        p: [
          'There is no minimum age on Land It. Younger riders are welcome, with a parent or guardian who says yes.',
          'Whether that permission is needed depends on where you are: the United Kingdom sets the line at 13, most of the EEA sets it at 16, and elsewhere we use 13. Your country picks the line and we apply it when you sign up.',
          'If you are below the line we ask for a parent or guardian email address and send them a link to approve the account. Until they do, you can browse the library, track your tricks, write notes and build a streak. You are not visible to any other rider, and you cannot join a crew, submit a spot, mark yourself down for an event or pay for anything.',
          'The same email carries a link that withdraws permission. It works forever, it needs no Land It account, and using it puts the rider back to tracking on their own. It does not delete a single trick they have logged.',
          'Permission stops being needed on the birthday your country says it stops being needed. That happens on its own — nobody has to remember to do it.',
          'If you are in the United States and under 13, we will not sign you up. The rules there ask for a much heavier kind of parental consent than an approval email, and we would rather turn you away honestly than pretend we have built it.',
        ],
      },
      {
        h: 'Getting your data or deleting it',
        p: [
          'Ask us and we will send you everything we hold on you, or delete all of it. Both are free and we aim to do it within 30 days.',
          `Email ${CONTACT.privacy}.`,
        ],
      },
    ],
  },
  {
    id: 'terms',
    title: 'Terms of use',
    updated: 'August 2026',
    intro:
      'The deal between you and us. Short version: ride safely, be decent to other riders, and we will keep the app running.',
    sections: [
      {
        h: 'Your account',
        p: [
          'One account per rider. Keep your password to yourself.',
          'There is no minimum age. If you are young enough that your country wants a parent or guardian to approve the account, we ask for that when you sign up, and until it is given the account can only track your own riding. The privacy policy sets out exactly what that leaves you able to do.',
          'One exception: if you are in the United States and under 13, we cannot give you an account at all.',
        ],
      },
      {
        h: 'Riding is the risky part, not the app',
        p: [
          'Land It describes tricks. It does not teach you to do them safely and it cannot judge whether you are ready for one.',
          'Wear a helmet. Learn the difficulty 4 and 5 tricks into foam or resi, with someone watching.',
          'You ride at your own risk. Skate parks and street spots have their own rules and you have to follow those.',
        ],
      },
      {
        h: 'What you post',
        p: [
          'You own your notes and everything you track. You give us permission to store them and show them back to you inside the app.',
          'Nothing illegal, nothing abusive, nothing that puts other riders at risk. We will remove content and close accounts that break this.',
        ],
      },
      {
        h: 'Paying',
        p: [
          'Paid plans renew monthly or yearly until you cancel. Cancel any time and you keep access until the period ends.',
          'Whoever pays has to be 18 or over. Riders under 16 cannot buy a plan inside the app — the upgrade goes to a parent or guardian by email instead.',
          'Your tracked tricks and stickers stay yours if you drop back to the free plan. Tricks above the free tier become read only rather than being deleted.',
          'Stickers and stages are earned, never sold. No plan will ever buy you an achievement.',
        ],
      },
      {
        h: 'Changing the app',
        p: [
          'The trick library, challenges and stickers change over time. We will tell you in the app when something meaningful changes.',
          'If we ever shut the service down we will give you notice and a way to export what you have tracked.',
        ],
      },
    ],
  },
  {
    id: 'safeguarding',
    title: 'Safeguarding',
    updated: 'August 2026',
    intro: 'Most riders here are young. This is how we try to keep the app a safe place for them.',
    sections: [
      {
        h: 'Defaults are private',
        p: [
          'New profiles are private. Being visible to other riders is a choice a rider makes, not the setting they are given.',
          'Surnames and email addresses never appear on a public profile.',
          'Land It does not host video. There is no upload anywhere in the app, so there is no rider footage here to be seen by anybody.',
        ],
      },
      {
        h: 'There is nowhere for a stranger to reach a rider',
        p: [
          'Crews are invite only. You get in because someone already in one invites you. There is no directory of riders to browse and no way to search for a rider you are not already crewed with.',
          'There is no private messaging in Land It, between riders or otherwise. That is not a feature we have left for later. It is a thing this app does not do.',
          'There is no feed of strangers. A crew board is a leaderboard, a crew activity list is in the order things happened, and neither is picked for you by an algorithm.',
          'Spots that riders submit reach nobody until a person here has read them and approved them.',
        ],
      },
      {
        h: 'Reporting',
        p: [
          'Every rider profile and every spot has a report control on it, and there is a form at /report you can open from anywhere. You do not need an account to use it, and you do not need to be the person it happened to.',
          `Or email ${CONTACT.safeguarding} with a link, a rider name or a description. It reaches the same person — a human, not a queue nobody reads.`,
          'We will respond within one working day.',
          'If you think we got a decision wrong, ask us to look again: every report we take gives you a reference, and the same form takes an appeal against what we did with it. Somebody who has not already decided reads it.',
        ],
      },
      {
        h: 'Parents and guardians',
        p: [
          'Where a rider needed permission to be here, the parent or guardian who gave it keeps a link that withdraws it. That link never expires and needs no account of their own.',
          'Withdrawing permission puts the account back to tracking alone: the rider keeps everything they have logged and stops being visible to anybody else.',
          'If you want to know what a rider is doing here, ask them to show you. Everything Land It holds about a rider is on the rider’s own screens. There is nothing kept back from them, and nothing a parent can see that they cannot.',
        ],
      },
      {
        h: 'Difficulty and risk',
        p: [
          'Every trick carries a difficulty from 1 to 5. Anything at 4 or 5 involves drops, inverts or both, and the app says so on the trick page.',
          'We will not gate tricks by age, because riders progress at different rates. We will keep flagging the ones that need a foam pit and a spotter.',
        ],
      },
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies',
    updated: 'August 2026',
    intro: 'We use as few as we can get away with.',
    sections: [
      {
        h: 'Strictly necessary',
        p: [
          'One cookie to keep you signed in, and storage on your own device to hold your tracked tricks so the app works without a connection at the park.',
          'These cannot be switched off without breaking the app.',
        ],
      },
      {
        h: 'Counting who uses what',
        p: [
          'We count how many people open each page, so we know which parts of the app to improve.',
          'It is set up without cookies and without advertising identifiers, and the counts are not attached to you. There is no per-rider analytics profile here — not one to look at, not one to switch off, and not one to ask us for.',
        ],
      },
      {
        h: 'No advertising cookies',
        p: ['There are none, because there are no ads.'],
      },
    ],
  },
  {
    id: 'about',
    title: 'About Land It',
    updated: 'August 2026',
    intro: `A trick tracker for ${sportsList()} riders, built because a paper checklist on a fridge worked better than any app we could find.`,
    sections: [
      {
        h: 'What it is',
        p: [
          `${libraryCount} full trick libraries, tracked through five honest stages: want it, learning it, sometimes, most times, every time.`,
          'No fake progress bars, no streak guilt, no feed of strangers doing tricks you cannot do yet.',
        ],
      },
      {
        h: 'How we make money',
        p: [
          'Subscriptions, and eventually posted sticker packs. Not advertising, and not by selling data about children.',
          'The free tier is a real one. It covers every library up to the Easy tier and it does not expire.',
        ],
      },
      {
        h: 'Get in touch',
        p: [
          `${CONTACT.hello} for anything, ${CONTACT.safeguarding} for anything urgent about a rider’s safety.`,
          `If you run a park, a shop or a comp and want your events on the calendar, email ${CONTACT.events}.`,
        ],
      },
    ],
  },
];

export const LEGAL_DOC_IDS = LEGAL_DOCS.map((d) => d.id);

export function legalDoc(id: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.id === id);
}
