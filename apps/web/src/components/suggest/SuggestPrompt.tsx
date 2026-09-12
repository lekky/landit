import Link from 'next/link';

import { suggestHref } from '@/lib/routes';

import styles from './suggestPrompt.module.css';

/**
 * "Missing a trick? Tell us." — the in-context way into `/suggest`.
 *
 * **This is the half of the feature that is expected to do the work.** The
 * account menu carries a "Tell us an idea" entry and that entry is findable at
 * every width, but a rider does not open their account menu because they
 * noticed a trick was missing: they notice it while looking at the library, and
 * the thought is gone by the time they have found a form. A link at the foot of
 * the thing the idea is about catches it where it happens, and arrives already
 * tagged with what it is about — which is why `topic` is baked into the href
 * rather than left for the rider to pick.
 *
 * `from` is stamped alongside it so `suggestion_filed` can say which entry
 * point earned the suggestion. Both are fixed ids chosen by the caller, never
 * anything a rider typed (`lib/analytics.ts`).
 *
 * Plain, and quiet on purpose. It sits under a screen's real content and must
 * not read as a call to action competing with it — no panel, no hard shadow,
 * no button. A suggestion box that shouted would be the first thing a rider
 * learned to scroll past.
 */
export function SuggestPrompt({
  topic,
  from,
  children,
}: {
  readonly topic: string;
  /** Which screen this is on, for the count. A fixed id. */
  readonly from: string;
  /** The invitation, in the voice of the screen it sits on. */
  readonly children: React.ReactNode;
}) {
  return (
    <p className={`cond ${styles.prompt}`}>
      {children} <Link href={suggestHref(topic, from)}>Tell us.</Link>
    </p>
  );
}
