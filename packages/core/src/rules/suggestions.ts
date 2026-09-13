/**
 * What a suggestion is, and what makes one usable.
 *
 * A rider telling us what to build, what trick is missing, or what is broken —
 * and it is **deliberately not a report** (`reports.ts`). The two look alike
 * from a distance and share almost none of their reasoning:
 *
 *  - A report is a safeguarding route the Online Safety Act requires, works
 *    signed out because it has to, and lands in a queue staff have promised to
 *    answer within one working day. A suggestion is none of those things.
 *  - Filing them into one collection would put "please add the Bri Flip" in
 *    front of the moderator looking for "somebody might hurt themselves", and
 *    would spend the safeguarding rate limit on ideas: a rider who sent five
 *    suggestions in an hour could not then report a child in danger. That is
 *    the whole argument for a second collection, and it is a safety argument
 *    rather than a tidiness one.
 *
 * So they are separate all the way down — collection, hook, rate limit, staff
 * queue — and the only thing they share is the shape of the form, because the
 * report form's shape was already the right one: one screen, no steps, plain
 * radio buttons, written for somebody on a phone.
 *
 * **Defined here, enforced in `pocketbase/hooks/97_suggestions.pb.js`.** Same
 * arrangement as every other rule in this package (plan §3): the form warns
 * before the server refuses, and the server refuses whatever the form did. The
 * numbers below are mirrored in that hook and there is a test that fails if the
 * two drift.
 *
 * Nothing here knows what a form is.
 */

/**
 * What a suggestion can be *about*. Matches the `suggestions.topic` select.
 *
 * **There is no `spot` topic, on purpose.** The spots screen already carries
 * `AddSpotForm`, which writes a real `spots` row into the staff review queue
 * with the coordinates and the sports filled in. A "suggest a spot" option here
 * would be a worse version of a form that already works, and it would land spot
 * suggestions somewhere staff do not look for them. Events get a topic because
 * the calendar has no rider-facing route at all — it is researched from
 * organisers' pages and goes stale by existing.
 */
export const SUGGESTION_TOPICS = [
  {
    id: 'trick',
    label: 'A trick we’re missing',
    blurb: 'A trick that should be in the library, or one that is named or explained wrong.',
  },
  {
    id: 'feature',
    label: 'Something the site should do',
    blurb: 'A screen, a button, or anything you wish Land The Trick did and it does not.',
  },
  {
    id: 'event',
    label: 'An event we should list',
    blurb: 'A comp, jam, class or session that is not on the calendar.',
  },
  {
    id: 'bug',
    label: 'Something is broken',
    blurb: 'A page that will not load, a number that looks wrong, a button that does nothing.',
  },
  {
    id: 'other',
    label: 'Something else',
    blurb: 'Anything that does not fit above. We read all of them.',
  },
] as const;

export type SuggestionTopicId = (typeof SUGGESTION_TOPICS)[number]['id'];

/**
 * Shorter than a report's 2000.
 *
 * An idea is a sentence or two and the box should say so by being the size of
 * one. A report is an account of something that happened and needs the room.
 */
export const SUGGESTION_DETAIL_MAX = 1000;

/**
 * The server's limits, mirrored so the screen can say what will happen before
 * it happens rather than turning a 429 into "something went wrong".
 *
 * Lower than the report route's, and in the other direction from what it looks
 * like: the report limits are high because refusing a safeguarding report is
 * the expensive mistake, and these are lower because refusing an idea is not.
 */
export const SUGGESTION_WINDOW_MINUTES = 60;
export const SUGGESTION_MAX_PER_WINDOW = 3;
export const SUGGESTION_MAX_OPEN = 10;

/**
 * Every sentence `pocketbase/hooks/97_suggestions.pb.js` refuses with, word for
 * word — and so the only server wording the suggestion form may show a rider.
 *
 * **Why a list, and not "whatever the server said"** — the same reason as
 * `SPOT_SUBMISSION_REFUSALS`. A refusal on a suggestion can come from the hook,
 * whose sentences are written for a rider, or from PocketBase itself, whose are
 * written for a developer. The second kind reached the live site on 2026-09-13:
 * the web app was deployed with `/suggest` before PocketBase had the
 * `suggestions` collection, and riders pressing "Send it" were told "Missing or
 * invalid collection context." Anything not on this list gets the form's own
 * apology instead.
 *
 * The hook cannot import this file (it runs in PocketBase's JSVM), so the
 * sentences are copied there; `pocketbase/tests/suggestions.test.ts` provokes
 * each refusal over HTTP and fails if the two drift. "Sign in to send us an
 * idea." is left off because it cannot arrive: the collection's create rule
 * refuses a signed-out request before the hook runs, and the action checks the
 * session before it asks.
 */
export const SUGGESTION_REFUSALS: readonly string[] = Object.freeze([
  'Pick what this is about.',
  'Tell us the idea, in your own words.',
  `Keep it under ${SUGGESTION_DETAIL_MAX} characters.`,
  'You have a few ideas waiting with us already. We read all of them — give us a chance to catch up before the next one.',
  'That is a lot of ideas in one go. Give it an hour — the ones you have sent are already with us.',
]);

export const SUGGESTION_TOPIC_IDS: readonly SuggestionTopicId[] = SUGGESTION_TOPICS.map(
  (t) => t.id,
);

export function isSuggestionTopic(value: string | null | undefined): value is SuggestionTopicId {
  return SUGGESTION_TOPIC_IDS.includes(String(value ?? '') as SuggestionTopicId);
}

export interface SuggestionDraft {
  readonly topic: string | null | undefined;
  readonly detail: string | null | undefined;
}

/**
 * What is wrong with this suggestion, in the order a form should say it.
 *
 * Empty means the server will accept it. **It is not a permission** — the hook
 * checks all of this again, requires a signed-in rider and adds the rate limit,
 * which this cannot know about.
 */
export function suggestionProblems(draft: SuggestionDraft): string[] {
  const problems: string[] = [];

  if (!isSuggestionTopic(draft.topic)) problems.push('Pick what this is about.');

  const detail = String(draft.detail ?? '').trim();
  if (!detail) problems.push('Tell us the idea, in your own words.');
  else if (detail.length > SUGGESTION_DETAIL_MAX) {
    problems.push(`Keep it under ${SUGGESTION_DETAIL_MAX} characters.`);
  }

  return problems;
}

export function suggestionTopicLabel(id: string): string {
  return SUGGESTION_TOPICS.find((t) => t.id === id)?.label ?? 'Something else';
}
