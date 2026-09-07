import { glossaryFor, glossarySegments, type SportId } from '@landit/core';
import Link from 'next/link';
import { Fragment } from 'react';

import { glossaryHref } from '@/lib/routes';

import styles from './glossaryText.module.css';

/**
 * A run of body copy with its glossary words linked (plan §7, T29).
 *
 * Each word the glossary explains is wrapped, at its first mention only, in a
 * link to that term on `/glossary` — drawn as a 2px dotted ink underline and
 * nothing else, so a paragraph reads as a paragraph and not as a wall of
 * orange (handoff, "Decisions to confirm"). Which words, and where, is
 * `glossarySegments` in `@landit/core`: this component adds no rule of its
 * own, so the native app and the unit tests agree with the page about every
 * link.
 *
 * **Server-renderable and stateless.** It takes a string and returns markup,
 * so a trick page stays a server component when it adopts this, and there is
 * nothing to hydrate and nothing a hydration mismatch could throw away
 * (LESSONS §3a). The link is `next/link` so the glossary opens as a
 * client-side navigation, but it is an ordinary `<a href>` in the served HTML.
 *
 * `sport` narrows the glossary to the words that sport uses, and a trick page
 * should pass its trick's sport: "frame" in scooter copy is not the BMX top
 * tube, and "hop" in skate copy is not a bunny hop. `from` is the trick's slug,
 * so the glossary can offer the way back.
 *
 * Not used anywhere yet — the trick page belongs to `t31-trick-page`, and this
 * is wired in once both branches merge.
 */
export function GlossaryText({
  text,
  from,
  sport,
}: {
  /** The copy, exactly as written. Nothing in it is altered. */
  readonly text: string;
  /** The trick the copy belongs to, for "Back to the trick". */
  readonly from?: string;
  /** Link only the words this sport uses. Omit to link the whole glossary. */
  readonly sport?: SportId;
}) {
  const segments = glossarySegments(text, sport ? glossaryFor(sport) : undefined);
  return (
    <>
      {segments.map((segment, index) =>
        segment.slug ? (
          <Link key={index} className={styles.term} href={glossaryHref(segment.slug, from)}>
            {segment.text}
          </Link>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}
