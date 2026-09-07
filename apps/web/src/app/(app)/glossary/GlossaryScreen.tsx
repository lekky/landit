'use client';

import {
  GLOSSARY,
  GLOSSARY_LETTERS,
  SPORTS,
  SPORT_IDS,
  glossaryFor,
  glossaryTerm,
  groupGlossaryByLetter,
  type SportId,
} from '@landit/core';
import { Icon, Panel, Tabs, type TabItem } from '@landit/ui-web';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ROUTES, glossarySportHref, trickHref } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';

import styles from './glossary.module.css';

/** The anchor a letter group gets: `letter-a`, and `letter-num` for `#`. */
const letterId = (letter: string) => `letter-${letter === '#' ? 'num' : letter.toLowerCase()}`;

/**
 * The glossary screen: back link, heading, sport filter, the A–Z strip and
 * the entries grouped by letter (handoff `Glossary.dc.html`).
 *
 * A client component for two small reasons and no large one. The sport
 * filter rewrites the address as it narrows the list — `replace`, not `push`,
 * for the reason the library's "My tricks" switch gives: four filters are one
 * screen in four modes, not four places for Back to walk through. And the
 * deep-link counter has to read `location.hash`, which only a browser has.
 * Everything the screen *shows* it was handed by the server, already filtered,
 * so there is no flash of the wrong list.
 *
 * **The highlight is `:target`, not state.** A term reached by `#kerb` is drawn
 * in paper-2 with a yellow rule down its left, entirely in CSS, so a deep link
 * lands looking right before a byte of JavaScript has run and there is nothing
 * for hydration to disagree with.
 */
export function GlossaryScreen({
  sport: initialSport,
  from,
  tricks,
}: {
  /** `?sport=`, validated on the server. `null` is all sports. */
  readonly sport: SportId | null;
  /** `?from=`, a trick slug the server has checked exists, or `null`. */
  readonly from: string | null;
  /** Live tricks by slug — a hidden trick is absent and gets no pill. */
  readonly tricks: Readonly<Record<string, { name: string; sport: SportId }>>;
}) {
  const router = useRouter();
  const [sport, setSport] = useState<SportId | null>(initialSport);

  const shown = useMemo(() => glossaryFor(sport), [sport]);
  const groups = useMemo(() => groupGlossaryByLetter(shown), [shown]);
  const present = useMemo(() => new Set(groups.map((group) => group.letter)), [groups]);

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: 'all', label: 'All', color: 'var(--ink)', note: GLOSSARY.length },
      ...SPORT_IDS.map((id) => ({
        id,
        label: SPORTS[id].short,
        icon: SPORT_LOOKS[id].icon,
        color: SPORTS[id].color,
        note: glossaryFor(id).length,
      })),
    ],
    [],
  );

  /*
   * A deep link counts once, on arrival. The hash names the term and `from`
   * says whether a trick's copy sent the reader here (`inline`) or a link on
   * the glossary's own page did (`page`). Read after mount because the server
   * never sees a fragment; the ref keeps a re-render from counting twice.
   */
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    const slug = decodeURIComponent(window.location.hash.slice(1));
    if (!slug || !glossaryTerm(slug)) return;
    capture(ANALYTICS_EVENTS.glossaryOpened, {
      term: slug,
      source: from ? 'inline' : 'page',
      sport: initialSport,
    });
  }, [from, initialSport]);

  const pick = (id: string) => {
    const next = SPORT_IDS.find((candidate) => candidate === id) ?? null;
    setSport(next);
    router.replace(glossarySportHref(next, from), { scroll: false });
  };

  return (
    <div>
      <Link className={`cond ${styles.back}`} href={from ? trickHref(from) : ROUTES.library}>
        <Icon name="back" size={16} /> {from ? 'Back to the trick' : 'All tricks'}
      </Link>

      <div className={styles.head}>
        <div>
          <span className="eyebrow">The words riders use</span>
          <h1 className={`d ${styles.title}`}>Glossary</h1>
        </div>
        <Tabs
          className={styles.filter}
          items={tabs}
          value={sport ?? 'all'}
          onChange={pick}
          label="Sport"
        />
      </div>

      <Panel className={styles.panel}>
        {/*
          The jump strip. A letter with nothing under it is a `span`, not a link
          that goes nowhere: the design greys it and switches its pointer events
          off, and a `span` is what that means to a keyboard and a screen reader.
        */}
        <nav aria-label="Jump to letter" className={styles.strip}>
          {GLOSSARY_LETTERS.map((letter) =>
            present.has(letter) ? (
              <a key={letter} href={`#${letterId(letter)}`} className={styles.letter}>
                {letter}
              </a>
            ) : (
              <span key={letter} className={styles.letterOff} aria-hidden="true">
                {letter}
              </span>
            ),
          )}
        </nav>

        {groups.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Icon name="search" size={26} strokeWidth={2.4} />
            </div>
            <div className={`d ${styles.emptyTitle}`}>Nothing for that sport yet</div>
            <p className={styles.emptyBody}>
              Every word here has a sport. Pick another one, or All.
            </p>
          </div>
        ) : (
          <div className={styles.list}>
            {groups.map((group) => (
              <section
                key={group.letter}
                id={letterId(group.letter)}
                className={styles.group}
                aria-label={group.letter === '#' ? 'Numbers' : group.letter}
              >
                <div className={`d ${styles.groupLetter}`} aria-hidden="true">
                  {group.letter}
                </div>
                <div className={styles.entries}>
                  {group.terms.map((term) => {
                    const seen = term.seeIn.filter((id) => tricks[id]);
                    /*
                     * Three sports share trick names — Bail sees it in the
                     * scooter Nose Manual and the BMX one — and two pills that
                     * read the same are one pill to a rider. Where a name
                     * repeats, the sport is appended; where it does not, the
                     * pill is the name alone, as the handoff draws it.
                     */
                    const label = (id: string) => {
                      const trick = tricks[id]!;
                      const twins = seen.filter((other) => tricks[other]!.name === trick.name);
                      return twins.length > 1
                        ? `${trick.name} · ${SPORTS[trick.sport].short}`
                        : trick.name;
                    };
                    const only = term.sports.length === 1 ? term.sports[0]! : null;
                    return (
                      <article key={term.slug} id={term.slug} className={styles.entry}>
                        <div className={styles.termRow}>
                          <h2 className={`d ${styles.term}`}>{term.term}</h2>
                          {only && (
                            <span
                              className={styles.sportTag}
                              style={{ borderColor: SPORTS[only].color }}
                            >
                              {SPORTS[only].short}
                            </span>
                          )}
                        </div>
                        <p className={styles.definition}>{term.definition}</p>
                        {seen.length > 0 && (
                          <div className={styles.seen}>
                            <span className={`lab ${styles.seenLabel}`}>See it in</span>
                            {seen.map((id) => (
                              <Link
                                key={id}
                                className={styles.seenLink}
                                href={trickHref(id)}
                                onClick={() =>
                                  // The term and the sport are catalogue facts;
                                  // the trick's slug is not sent, because the
                                  // page it opens counts itself.
                                  capture(ANALYTICS_EVENTS.glossaryOpened, {
                                    term: term.slug,
                                    source: 'page',
                                    sport,
                                  })
                                }
                              >
                                {label(id)}
                                <span className={styles.seenArrow} aria-hidden="true">
                                  <Icon name="back" size={12} strokeWidth={2.6} />
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
