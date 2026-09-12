'use client';

import {
  CATEGORY_IDS,
  CATS,
  SPORTS,
  STAGE,
  TIERS_LABEL,
  TRICK_SORTS,
  TRICK_STATUS_FILTERS,
  activeFilterCount,
  categoryLabel,
  filterTricks,
  groupTricksByStage,
  isTrickLocked,
  tricksFor,
  type CategoryId,
  type PlanId,
  type StageId,
  type Trick,
  type TrickSort,
  type TrickStatusFilter,
} from '@landit/core';
import { Empty, foregroundFor, Icon, Panel, Pill, TrickCard } from '@landit/ui-web';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { SportSwitch } from '@/components/shell/SportSwitch';
import { SuggestPrompt } from '@/components/suggest/SuggestPrompt';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { libraryArrival, rememberLibraryPlace } from '@/lib/libraryPlace';
import { ROUTES, libraryHref, trickHref } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';
import { useSport } from '@/providers/sport';

import styles from './library.module.css';

/**
 * The trick library: search, the sticky filter column, the rookie banner and
 * the grid (screenshot 08).
 *
 * Everything the rider narrows with is client state and every trick is already
 * here, which is the prototype's behaviour and the right one for a list of this
 * size: filtering ninety-odd records is instant, and a round trip per keystroke
 * would not be. The *rules* behind the narrowing are not here — they are
 * `filterTricks` in `@landit/core`, so the native app and this screen agree
 * about what "landed" means in a filter.
 *
 * The lock is drawn, never applied. A trick behind the paywall is listed like
 * any other and opens a page that explains it; the refusal that matters happens
 * in the `trick_progress` hook (plan §3 guarantee 3), and nothing on this screen
 * is load-bearing for it.
 *
 * **The grid keeps the rider's place for the hop into a trick page** (2026-09-12,
 * `lib/libraryPlace.ts`). Client state is the right answer for narrowing a list
 * of this size and it has one cost: the state goes when the screen does, so
 * opening a trick and coming back used to mean re-searching, re-filtering and
 * re-scrolling a 259-card grid. The offset and the narrowing are now written
 * down on the way out and reinstated on the way back — for that one hop only,
 * and in memory only.
 */
export function LibraryBrowser({
  tricks,
  byId,
  plan,
  signedIn,
  initialMine = false,
  initialCategory = null,
}: {
  /** Every live trick, from the database, so a staff edit shows up here. */
  tricks: readonly Trick[];
  /** The rider's stages, keyed by slug. Empty for a signed-out visitor. */
  byId: Readonly<Record<string, StageId>>;
  plan: PlanId;
  signedIn: boolean;
  /** `?mine=1` on the way in, resolved on the server. Never true signed out. */
  initialMine?: boolean;
  /**
   * `?cat=` on the way in, resolved and validated on the server.
   *
   * A spot page's "What's here" grid links each feature to the tricks you
   * would do on it, and this is what lets that link *land* on the narrowed
   * grid. Read on the server for the reason `mine` is: filtering after
   * hydration would paint the whole library and then take most of it away, on
   * the one arrival that came asking for a subset.
   */
  initialCategory?: CategoryId | null;
}) {
  const router = useRouter();
  const { sport } = useSport();

  /*
   * Where this rider was the last time they were on this screen, if they have
   * just come back from a trick page (`lib/libraryPlace.ts`). Null on any other
   * arrival, and null on the server, so a page load renders exactly what it did
   * before this existed and there is nothing for hydration to disagree about.
   *
   * Read in a `useState` initialiser rather than an effect, because the
   * narrowing has to be in place for the **first** render: setting it afterwards
   * would paint the whole library and then take most of it away, which is the
   * flash `initialMine` and `initialCategory` are resolved on the server to
   * avoid. It is a plain read, not a take, so React rendering this twice in
   * development lands the rider in the same place both times.
   */
  const [arrival] = useState(() => libraryArrival(sport));
  const wasNarrowedTo = arrival?.narrowing ?? null;

  const [search, setSearch] = useState(wasNarrowedTo?.search ?? '');
  const [category, setCategory] = useState<CategoryId | null>(initialCategory);
  const [difficulty, setDifficulty] = useState<number | null>(wasNarrowedTo?.difficulty ?? null);
  const [status, setStatus] = useState<TrickStatusFilter>(wasNarrowedTo?.status ?? 'all');
  const [sort, setSort] = useState<TrickSort>(wasNarrowedTo?.sort ?? 'easiest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mine, setMineState] = useState(initialMine);

  /*
   * Put them back at the offset they left, once the grid above is laid out.
   *
   * Twice, because two other things move this page in the same beat: Next
   * scrolls a forward navigation to the top of the new page, and the browser
   * makes its own attempt on a Back — against a document that is usually still
   * a fraction of its final height, which is why Back landed near the top
   * rather than where it was. The arrow out of a trick page turns Next's scroll
   * off when there is a place to restore (`BackToLibrary`), and the frame after
   * this settles whatever is left. One frame is enough: a trick card is text
   * and a border, so the grid's height is final as soon as it is rendered.
   */
  useEffect(() => {
    if (!arrival) return;
    const { scrollY } = arrival;
    window.scrollTo(0, scrollY);
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, scrollY));
    return () => window.cancelAnimationFrame(frame);
  }, [arrival]);

  /*
   * And write it down, on every press anywhere on this screen.
   *
   * The press that matters is the one that opens a trick, but this does not
   * need to know which press that was: the last one before the screen goes is
   * the one that took the rider off it, and recording a few presses that went
   * nowhere costs an object.
   *
   * **Not in an unmount cleanup**, which is where this started and is wrong in
   * a way worth writing down. A cleanup looks like the perfect moment — the
   * screen is going, so `window.scrollY` must still be its own — and in the
   * ordinary case it is. But a navigation in a transition can render the new
   * page, put the old one back while the payload lands, and commit again, so
   * the cleanup runs *twice*; by the second one the framework has scrolled the
   * new page to the top and `window.scrollY` is 0. That is exactly what it
   * recorded (every time, in dev), and no assertion about the narrowing would
   * have caught it — the search text came back perfectly and the offset was
   * always the top of the page. A press is a moment the rider chose, and there
   * is nothing ambiguous about where the page is when it happens.
   *
   * `onClickCapture` rather than `onClick`, so the capture reaches this before
   * the card's own navigation, and a keyboard Enter on a focused card counts
   * like a tap does.
   *
   * The address carries `mine` and `cat` because the server resolves those on
   * the way back in; everything else here has no address and would otherwise be
   * gone.
   */
  const keepPlace = () => {
    rememberLibraryPlace({
      href: libraryHref({ mine, cat: category ?? undefined }),
      sport,
      narrowing: { search, difficulty, status, sort },
      scrollY: window.scrollY,
    });
  };

  const pool = useMemo(() => tricksFor(sport, tricks), [sport, tricks]);
  /*
   * In "My tricks" the switch owns the status: it asks for `tracked` and the
   * sidebar's own status pills are hidden while it is on, so the two controls
   * can never disagree and leave a rider staring at an empty grid wondering
   * which of them emptied it.
   */
  const list = useMemo(
    () =>
      filterTricks(
        { search, sport, category, difficulty, status: mine ? 'tracked' : status, sort, byId },
        tricks,
      ),
    [search, sport, category, difficulty, status, sort, byId, tricks, mine],
  );
  const groups = useMemo(
    () => (mine ? groupTricksByStage(list, byId, sort) : []),
    [mine, list, byId, sort],
  );
  /** How many of this sport's tricks the rider has a stage on — the switch's count. */
  const tracked = useMemo(() => pool.filter((t) => byId[t.id]).length, [pool, byId]);

  const lockedCount = pool.filter((t) => isTrickLocked(t, plan)).length;
  const activeFilters = activeFilterCount({ category, difficulty, status: mine ? 'all' : status });
  const showRookieBanner = signedIn && plan === 'rookie' && lockedCount > 0;

  /*
   * Flipping the switch rewrites the address as well as the view.
   *
   * `replace`, not `push`: the two sides are one screen in two modes, not two
   * places, so Back should leave the library rather than walk a rider through
   * every toggle they made. `scroll: false` because the switch sits at the top
   * of the list it changes — jumping to the top of a page you are already at
   * the top of only ever looks like a glitch.
   */
  const setMine = (next: boolean) => {
    setMineState(next);
    // The category rides along so a rider who arrived on `?cat=park` from a
    // spot page still has that address after flipping the switch.
    router.replace(libraryHref({ mine: next, cat: category ?? undefined }), { scroll: false });
  };

  const reset = () => {
    setSearch('');
    setCategory(null);
    setDifficulty(null);
    setStatus('all');
  };

  const card = (trick: Trick) => (
    <TrickCard
      key={trick.id}
      name={trick.name}
      category={{ label: categoryLabel(trick.cat, trick.sport), color: CATS[trick.cat].color }}
      difficulty={trick.diff}
      sport={SPORT_LOOKS[trick.sport]}
      stage={byId[trick.id] ? STAGE[byId[trick.id]!] : null}
      locked={isTrickLocked(trick, plan)}
      lockTier={TIERS_LABEL[trick.diff - 1]}
      /*
       * A link, not a button with a `router.push` on it.
       *
       * This grid is the only way into the trick pages, and until now it was
       * not a way in at all for anything that reads links rather than clicking
       * things: every trick page was unreachable from anywhere on the site, and
       * a crawler that arrived here left with nothing. `linkAs` hands the card
       * `next/link`, so it is a real `<a href>` in the served HTML *and* still a
       * client-side navigation for a rider — plus middle-click, open in a new
       * tab, and the link semantics a screen reader announces.
       *
       * A locked trick links too. `/library/[slug]` answers with the locked
       * page rather than the trick, which is a page worth reaching.
       */
      href={trickHref(trick.id)}
      linkAs={Link}
    />
  );

  const filters = (
    <Panel flat className={styles.filters}>
      <div className="lab">Category</div>
      <div className={styles.pills}>
        <Pill
          on={!category}
          onClick={() => {
            capture(ANALYTICS_EVENTS.libraryFiltered, { category: 'all' });
            setCategory(null);
          }}
        >
          All
        </Pill>
        {CATEGORY_IDS.map((id) => (
          <Pill
            key={id}
            on={category === id}
            onClick={() => {
              // A category id is catalogue data. The search box is deliberately
              // not instrumented: what a rider types is theirs.
              capture(ANALYTICS_EVENTS.libraryFiltered, { category: id });
              setCategory(id);
            }}
            style={
              category === id
                ? {
                    background: CATS[id].color,
                    color: foregroundFor(CATS[id].color) ?? 'var(--on-dark)',
                    boxShadow: '3px 3px 0 var(--ink)',
                  }
                : undefined
            }
          >
            {categoryLabel(id, sport)}
          </Pill>
        ))}
      </div>

      <div className={`lab ${styles.groupLabel}`}>Difficulty</div>
      <div className={styles.pills}>
        <Pill on={!difficulty} onClick={() => setDifficulty(null)}>
          Any
        </Pill>
        {TIERS_LABEL.map((label, index) => (
          <Pill key={label} on={difficulty === index + 1} onClick={() => setDifficulty(index + 1)}>
            {label}
          </Pill>
        ))}
      </div>

      {/*
        Hidden while "My tricks" is on, because the switch is already answering
        this question. Two controls over one field is how a rider ends up asking
        for their tracked tricks *and* the untracked ones and being told there
        are none.
      */}
      {!mine && (
        <>
          <div className={`lab ${styles.groupLabel}`}>My status</div>
          <div className={styles.pills}>
            {TRICK_STATUS_FILTERS.map((option) => (
              <Pill key={option.id} on={status === option.id} onClick={() => setStatus(option.id)}>
                {option.label}
              </Pill>
            ))}
          </div>
        </>
      )}

      <div className={`lab ${styles.groupLabel}`}>Sort</div>
      <div className={styles.pills}>
        {TRICK_SORTS.map((option) => (
          <Pill key={option.id} on={sort === option.id} onClick={() => setSort(option.id)}>
            {option.label}
          </Pill>
        ))}
      </div>
    </Panel>
  );

  return (
    <div onClickCapture={keepPlace}>
      <SportSwitch note={(id) => tricksFor(id, tricks).length} label="Trick library sport" />

      <div className={styles.head}>
        <div>
          <span className="eyebrow">
            {mine
              ? `Your ${SPORTS[sport].label.toLowerCase()} tricks`
              : `${SPORTS[sport].label} library`}
          </span>
          <h1 className={`d ${styles.title}`}>
            {mine ? (
              <>{tracked} tracked</>
            ) : (
              <>
                {pool.length} trick{pool.length === 1 ? '' : 's'}
              </>
            )}
          </h1>
        </div>
        <div className={`search ${styles.search}`}>
          <Icon name="search" size={19} strokeWidth={2.6} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tricks: whip, grind, flip…"
            aria-label="Search tricks"
          />
          {search && (
            <button type="button" className={`cond ${styles.clear}`} onClick={() => setSearch('')}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="two-col">
        <div>
          <button
            type="button"
            className="filter-toggle"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            <Icon name="grid" size={17} strokeWidth={2.4} />
            <span>Filters &amp; sort</span>
            {activeFilters > 0 && <span className="fcount">{activeFilters}</span>}
            <span className={styles.toggleState}>{filtersOpen ? 'Hide' : 'Show'}</span>
          </button>
          <div className={`filterwrap${filtersOpen ? ' open' : ''}`}>{filters}</div>
        </div>

        <div>
          {/*
            "My tricks" (T22). Signed in only — a visitor with no account has no
            tracked tricks, so the switch would be a control with one working
            side, and the library is deliberately readable signed out.

            A pair of buttons rather than pills: the two are one choice with two
            answers, and the pills below are many independent narrowings. The
            shape says which kind of control it is before the label is read.
          */}
          {signedIn && (
            <div className={styles.mineSwitch} role="group" aria-label="Which tricks to show">
              <button
                type="button"
                className={`cond ${styles.mineOption}`}
                aria-pressed={!mine}
                onClick={() => setMine(false)}
              >
                All {pool.length} tricks
              </button>
              <button
                type="button"
                className={`cond ${styles.mineOption}`}
                aria-pressed={mine}
                onClick={() => setMine(true)}
              >
                My tricks · {tracked}
              </button>
            </div>
          )}

          {showRookieBanner && (
            <Panel flat className={styles.banner}>
              <span className={styles.bannerIcon}>
                <Icon name="lock" size={17} strokeWidth={2.6} />
              </span>
              <div className={styles.bannerText}>
                <div className={`cond ${styles.bannerTitle}`}>You&rsquo;re on Rookie</div>
                {/*
                  Not "Rookie and Easy tricks are yours. The Spicy, Gnarly and
                  Pro tiers open up on Shredder", which is what this said until
                  2026-09-04 and was false in both directions — the free tier is
                  a hand-picked twenty per sport that reaches past Easy, and it has
                  never covered all of Easy (`PLANS` in `@landit/core`, issue
                  #286). The grid beside this banner shows every lock, so the
                  banner does not need to enumerate tiers it would get wrong.
                */}
                <p className={styles.bannerBody}>
                  Twenty hand-picked tricks in every sport are yours. The rest of the library opens
                  up on Shredder.
                </p>
              </div>
              {/*
                A real link since T15 built `/plans`. Until then this was the
                label "Upgrading is not switched on yet", because `typedRoutes`
                made a link to an unbuilt page a compile error (LESSONS §3a) —
                and it outlived the reason by long enough to still be telling
                riders they could not buy anything after Stripe went live. A
                dead label is not a safe default: it goes stale silently, where
                a dead link does not compile.

                The label is **"Upgrade now"**, chosen by the owner
                (2026-08-18, in chat) over "Get Shredder", which this first
                shipped with because it matched the plans page's own button on
                the same purchase. Do not "correct" it back for consistency:
                the two say different things on purpose. The plans page names
                the plan because the rider is already choosing between three;
                this banner names the *action*, because a rookie looking at a
                locked trick has not started choosing yet.

                Still within plan §6.4, standard 13. "Now" is when the button
                works, not a deadline — there is no countdown, no scarcity and
                no claim that the price is about to change. That standard bars
                manufactured urgency, not the imperative mood.
              */}
              <Link
                className={`btn sm ${styles.bannerCta}`}
                href={ROUTES.plans}
                style={{ background: 'var(--violet)' }}
              >
                Upgrade now
              </Link>
            </Panel>
          )}

          <div className={`lab ${styles.count}`}>
            {list.length} trick{list.length === 1 ? '' : 's'}
            {category ? ` · ${CATS[category].blurb}` : ''}
          </div>

          {mine ? (
            groups.length ? (
              groups.map((group) => (
                <section key={group.stage} className={styles.stageGroup}>
                  <div className={styles.stageHead}>
                    <span
                      className={styles.stageSwatch}
                      style={{ background: STAGE[group.stage].color }}
                    />
                    <h2 className={`d ${styles.stageTitle}`}>{STAGE[group.stage].label}</h2>
                    <span className={`lab ${styles.stageCount}`}>{group.tricks.length}</span>
                    <span className={styles.stageRule} />
                  </div>
                  <div className="grid-tricks">{group.tricks.map(card)}</div>
                </section>
              ))
            ) : (
              <Empty
                icon="grid"
                title={
                  tracked ? 'Nothing matches in your tricks' : 'You are not tracking anything yet'
                }
                sub={
                  tracked
                    ? 'Drop a filter, or switch back to the whole library.'
                    : 'Open any trick and tell it whether you can do it. It shows up here straight after.'
                }
                cta="Browse all tricks"
                onCta={() => setMine(false)}
              />
            )
          ) : list.length ? (
            <div className="grid-tricks">{list.map(card)}</div>
          ) : (
            <Empty
              icon="search"
              title="Nothing matches"
              sub="Try dropping a filter or searching something broader."
              cta="Reset filters"
              onCta={reset}
            />
          )}

          {/*
            The way to tell us a trick is missing, at the foot of the list that
            made a rider notice.

            It is under the grid rather than beside the filters because it is
            the answer to "I have looked and it is not here", and a rider only
            knows that once they have got to the bottom. `topic` is baked in, so
            the form opens on the right radio button and the count knows the
            library earned the suggestion (`suggestion_filed`, `where`).
          */}
          <SuggestPrompt topic="trick" from="library">
            Missing a trick, or is one of these named wrong?
          </SuggestPrompt>
        </div>
      </div>
    </div>
  );
}
