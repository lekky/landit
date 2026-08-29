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
import { Empty, Icon, Panel, Pill, TrickCard } from '@landit/ui-web';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { SportSwitch } from '@/components/shell/SportSwitch';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
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
 */
export function LibraryBrowser({
  tricks,
  byId,
  plan,
  signedIn,
  initialMine = false,
}: {
  /** Every live trick, from the database, so a staff edit shows up here. */
  tricks: readonly Trick[];
  /** The rider's stages, keyed by slug. Empty for a signed-out visitor. */
  byId: Readonly<Record<string, StageId>>;
  plan: PlanId;
  signedIn: boolean;
  /** `?mine=1` on the way in, resolved on the server. Never true signed out. */
  initialMine?: boolean;
}) {
  const router = useRouter();
  const { sport } = useSport();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [status, setStatus] = useState<TrickStatusFilter>('all');
  const [sort, setSort] = useState<TrickSort>('easiest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mine, setMineState] = useState(initialMine);

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
    router.replace(libraryHref({ mine: next }), { scroll: false });
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
      onOpen={() => router.push(trickHref(trick.id))}
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
                ? { background: CATS[id].color, color: '#fff', boxShadow: '3px 3px 0 var(--ink)' }
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
    <div>
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
                <p className={styles.bannerBody}>
                  {TIERS_LABEL[0]} and {TIERS_LABEL[1]} tricks are yours. The {TIERS_LABEL[2]},{' '}
                  {TIERS_LABEL[3]} and {TIERS_LABEL[4]} tiers open up on Shredder.
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
        </div>
      </div>
    </div>
  );
}
