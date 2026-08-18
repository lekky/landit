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
import { ROUTES, trickHref } from '@/lib/routes';
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
}: {
  /** Every live trick, from the database, so a staff edit shows up here. */
  tricks: readonly Trick[];
  /** The rider's stages, keyed by slug. Empty for a signed-out visitor. */
  byId: Readonly<Record<string, StageId>>;
  plan: PlanId;
  signedIn: boolean;
}) {
  const router = useRouter();
  const { sport } = useSport();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [status, setStatus] = useState<TrickStatusFilter>('all');
  const [sort, setSort] = useState<TrickSort>('easiest');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const pool = useMemo(() => tricksFor(sport, tricks), [sport, tricks]);
  const list = useMemo(
    () => filterTricks({ search, sport, category, difficulty, status, sort, byId }, tricks),
    [search, sport, category, difficulty, status, sort, byId, tricks],
  );

  const lockedCount = pool.filter((t) => isTrickLocked(t, plan)).length;
  const activeFilters = activeFilterCount({ category, difficulty, status });
  const showRookieBanner = signedIn && plan === 'rookie' && lockedCount > 0;

  const reset = () => {
    setSearch('');
    setCategory(null);
    setDifficulty(null);
    setStatus('all');
  };

  const filters = (
    <Panel flat className={styles.filters}>
      <div className="lab">Category</div>
      <div className={styles.pills}>
        <Pill on={!category} onClick={() => setCategory(null)}>
          All
        </Pill>
        {CATEGORY_IDS.map((id) => (
          <Pill
            key={id}
            on={category === id}
            onClick={() => setCategory(id)}
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

      <div className={`lab ${styles.groupLabel}`}>My status</div>
      <div className={styles.pills}>
        {TRICK_STATUS_FILTERS.map((option) => (
          <Pill key={option.id} on={status === option.id} onClick={() => setStatus(option.id)}>
            {option.label}
          </Pill>
        ))}
      </div>

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
          <span className="eyebrow">{SPORTS[sport].label} library</span>
          <h1 className={`d ${styles.title}`}>
            {pool.length} trick{pool.length === 1 ? '' : 's'}
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

                Still no countdown and no pressure — the tier is described, and
                the button says where it goes (plan §6.4, standard 13). "Get
                Shredder" is the wording the plans page puts on the same
                purchase, so the label and its destination agree.
              */}
              <Link
                className={`btn sm ${styles.bannerCta}`}
                href={ROUTES.plans}
                style={{ background: 'var(--violet)' }}
              >
                Get Shredder
              </Link>
            </Panel>
          )}

          <div className={`lab ${styles.count}`}>
            {list.length} trick{list.length === 1 ? '' : 's'}
            {category ? ` · ${CATS[category].blurb}` : ''}
          </div>

          {list.length ? (
            <div className="grid-tricks">
              {list.map((trick) => {
                const locked = isTrickLocked(trick, plan);
                const stage = byId[trick.id];
                return (
                  <TrickCard
                    key={trick.id}
                    name={trick.name}
                    category={{
                      label: categoryLabel(trick.cat, trick.sport),
                      color: CATS[trick.cat].color,
                    }}
                    difficulty={trick.diff}
                    sport={SPORT_LOOKS[trick.sport]}
                    stage={stage ? STAGE[stage] : null}
                    locked={locked}
                    lockTier={TIERS_LABEL[trick.diff - 1]}
                    onOpen={() => router.push(trickHref(trick.id))}
                  />
                );
              })}
            </div>
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
