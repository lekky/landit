'use client';

import { SITE_URL, type SportId } from '@landit/core';
import {
  Bar,
  Button,
  Modal,
  Panel,
  ShareCard,
  SportChip,
  StickerBadge,
  type IconName,
} from '@landit/ui-web';
import { useEffect, useRef, useState } from 'react';

import { BackLink } from '@/components/shell/BackLink';
import { useTabParam } from '@/components/shell/useTabParam';
import { TAB_PANEL, TabRow } from '@/components/shell/TabRow';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ROUTES } from '@/lib/routes';
import { useToast } from '@/providers/toast';
import { useSport } from '@/providers/sport';

import { acknowledgeStickersAction } from './actions';
import { WALL_VIEW_IDS, WALL_VIEW_LABELS, capShelf, shelveWall, type WallView } from './groups';
import type { StickerView, StickerWallView } from './view';

import styles from './stickers.module.css';

/**
 * The sticker wall, the detail modal and the share card (screenshot 14).
 *
 * Three things here are decisions rather than transcription, and each is
 * recorded in `docs/implementation-plan.md` §7 T10:
 *
 * - **The "real vinyl" panel is gone.** The prototype sells a posted die-cut
 *   pack to "Crew Pass riders". The Crew Pass was dropped (plan §2.4) and no
 *   posted pack exists, so the panel promised a product on a plan, neither of
 *   which is real. T5's rule for exactly this: describe what exists.
 * - **Earned comes off the record, not off a rule run here.** See `page.tsx`.
 * - **A sticker pops once.** An earned row the rider has never been shown plays
 *   the `just` keyframe, and the screen then acknowledges it, so the pop and
 *   the toast are both once-only (plan §3, `rider_stickers.seen_at`).
 */
export function StickerWall({ view }: { view: StickerWallView }) {
  const { sport } = useSport();
  const { toast } = useToast();
  const [open, setOpen] = useState<StickerView | null>(null);
  const [sharing, setSharing] = useState<StickerView | null>(null);

  const first = view.tabs[0]?.sport;
  const current: SportId | undefined = view.bySport[sport] ? (sport as SportId) : first;
  const wall = current ? (view.bySport[current] ?? []) : [];
  // The two halves. Disjoint by construction: `earned` is the only thing that
  // decides which side a badge is on, so none can be missing and none doubled.
  const half: Readonly<Record<WallView, readonly StickerView[]>> = {
    earned: wall.filter((s) => s.earned),
    unearned: wall.filter((s) => !s.earned),
  };
  const earned = half.earned.length;

  /*
   * Which half is showing, and which shelves the rider has opened.
   *
   * **The half is in `?tab=` now** (T46, review S3), the same as Progress's
   * three: a rider who opens a badge's detail and comes back, or reloads, or
   * shares the address, gets the wall they were looking at. `useTabParam`
   * `replace`s rather than pushes, so pressing the two tabs does not fill the
   * history with them.
   *
   * The **default is still per sport** — `defaultViewBySport` opens the wall on
   * whichever half has something in it — and the URL only overrides it when a
   * rider has actually chosen. A chosen tab does survive a sport switch, where
   * the old per-sport state quietly reset; if that lands them on an Earned wall
   * with nothing on it, the panel says so kindly and the other tab is one tap
   * away, which is a better trade than an address bar that lies about what is
   * on screen.
   *
   * Expanded shelves stay component state, keyed by sport and half, so opening
   * "Trick awards" on scooter does not open skate's.
   */
  const fallback: WallView = current
    ? (view.defaultViewBySport[current] ?? 'unearned')
    : 'unearned';
  const [chosen, setChosen] = useTabParam(WALL_VIEW_IDS, fallback);
  const active = chosen as WallView;
  const [expanded, setExpanded] = useState<readonly string[]>([]);

  /*
   * Acknowledge on arrival, once.
   *
   * The ref rather than a dependency on the ids: `acknowledgeStickersAction`
   * revalidates nothing, but a re-render for any other reason must not fire a
   * second round of writes, and in development React mounts effects twice.
   */
  const acknowledged = useRef(false);
  useEffect(() => {
    if (acknowledged.current) return;
    const fresh = Object.values(view.bySport)
      .flat()
      .filter((s) => s.unannounced && s.riderStickerId);
    if (!fresh.length) return;
    acknowledged.current = true;
    // One event per award, at the moment the rider is shown it — the earn
    // itself happens server-side in the hook, where no analytics runs. The
    // properties are catalogue facts (slug, stars, rarity), never rider facts.
    const seen = new Set<string>();
    for (const s of fresh) {
      if (seen.has(s.slug)) continue;
      seen.add(s.slug);
      capture(ANALYTICS_EVENTS.stickerEarned, {
        sticker: s.slug,
        stars: s.stars ?? 0,
        rarity: s.rarity ?? '',
      });
    }
    void acknowledgeStickersAction([...new Set(fresh.map((s) => s.riderStickerId as string))]);
  }, [view.bySport]);

  if (!current) return null;

  return (
    <div className={styles.page}>
      {/*
        The Home back link (§2.3). The wall is one of the four screens reached
        from a Home card now, and Home's cell stays lit while a rider is on it.
      */}
      <BackLink href={ROUTES.dashboard} label="Home" />

      <div className={styles.head}>
        <div>
          <span className="eyebrow">{view.eyebrowBySport[current]}</span>
          <h1 className={`d ${styles.count}`}>
            {earned} of {wall.length}
          </h1>
        </div>
        <div className={styles.progress}>
          <Bar pct={wall.length ? (earned / wall.length) * 100 : 0} color="var(--pink)" />
        </div>
      </div>

      {/*
        Earned · Not yet, as a `TabRow` in the header (§3.10).

        It was an underline bar **inside** the ink panel, put there because
        issue #379 item 5 logged two rows of identically shaped tabs on this
        screen — one navigating by sport, one filtering the wall. The sport row
        is gone (D5: the sport is the top bar's chip), so the collision it was
        hiding from is gone with it, and the switch can be the boxed row every
        other screen uses. One tab shape in the product beats two.

        `TabRow` fires `tabs_switched` `{ group: 'stickers', tab }` itself,
        which is what `sticker_view_switched` used to say — the catalogue entry
        records that the tab rows are taking those per-screen events over
        (`analytics.ts`), so this fires one event rather than two names for one
        tap.
      */}
      <TabRow
        items={[
          { id: 'earned', label: WALL_VIEW_LABELS.earned, note: half.earned.length },
          { id: 'unearned', label: WALL_VIEW_LABELS.unearned, note: half.unearned.length },
        ]}
        value={active}
        group="stickers"
        label="Which badges to show"
        onChange={setChosen}
      />

      {/*
        Shelved, not heaped (#245): awards by what they are for — see
        `groups.ts` for the shelves and for why "nearly there" is not one of
        them yet. Each shelf is a labelled section so a screen reader can jump
        between them the way the eye does.

        Two tabs over the top of that, and they are **disjoint halves of the
        same wall**: Earned holds what the rider has, Not yet holds what they
        have not, every badge on exactly one, both shelved the same way. Each
        shelf is cut to `SHELF_CAP` with the rest behind its own button.

        The control sits *inside* the ink panel and is an underline bar rather
        than the bordered pills the sport switch uses, because #379 item 5
        logged exactly that collision on Progress — two rows of identically
        shaped tabs, one navigation and one filter.
      */}
      {/*
        `role="tabpanel"`, named after its tab — the other half of the tab row
        above it. Without it a screen reader is told "Earned, tab, 1 of 2" and
        then told about no panel at all.

        On a wrapper rather than on the `Panel`, because `Panel` takes no ARIA
        props and widening a `packages/ui-web` signature for two attributes is
        not what additive-only is for. The wrapper carries the role, the name
        and the key — so §4's 120ms cross-fade still runs on every switch —
        and the `Panel` keeps the ink surface it always had.
      */}
      <div key={active} role="tabpanel" aria-label={WALL_VIEW_LABELS[active]} className={TAB_PANEL}>
        <Panel className={styles.wall}>
          {!half[active].length && (
            <p className={styles.empty}>
              {active === 'earned'
                ? 'Nothing yet. Every badge you earn lands here.'
                : 'Every badge on this wall is yours. Nothing left to go and get.'}
            </p>
          )}

          {shelveWall(half[active]).map((group) => {
            // Both tabs cap, and only until the rider opens that shelf. An opened
            // shelf stays open for the visit; nothing is remembered past it, so
            // the wall opens the same way every time. The key carries the tab as
            // well as the sport — "Trick awards" exists on both sides, and
            // opening one should not open the other.
            const key = `${current}:${active}:${group.id}`;
            const { shown, hidden } = expanded.includes(key)
              ? { shown: group.stickers, hidden: 0 }
              : capShelf(group.stickers);

            return (
              <section
                key={group.id}
                className={styles.group}
                aria-labelledby={`wall-shelf-${group.id}`}
              >
                <h2 id={`wall-shelf-${group.id}`} className={`lab ${styles.groupHead}`}>
                  {group.label}
                  <span className={styles.groupCount}>{group.stickers.length}</span>
                </h2>
                <div className={styles.grid}>
                  {shown.map((s) => (
                    <StickerBadge
                      key={s.slug}
                      sticker={{
                        name: s.name,
                        hue: s.hue,
                        ...(s.icon ? { icon: s.icon as IconName } : {}),
                        ...(s.img ? { img: s.img } : {}),
                      }}
                      earned={s.earned}
                      just={s.unannounced}
                      onClick={() => setOpen(s)}
                    />
                  ))}
                </div>
                {hidden > 0 && (
                  <button
                    type="button"
                    className={styles.showAll}
                    // The visible text repeats on every shelf, so the name a
                    // screen reader reads carries the shelf it belongs to.
                    aria-label={`Show all ${group.stickers.length} ${group.label}`}
                    onClick={() => {
                      // A shelf id is one of nine fixed strings from `groups.ts`.
                      capture(ANALYTICS_EVENTS.stickerShelfExpanded, { shelf: group.id });
                      setExpanded((open) => [...open, key]);
                    }}
                  >
                    Show all {group.stickers.length}
                  </button>
                )}
              </section>
            );
          })}
        </Panel>
      </div>

      {open && (
        <Modal onClose={() => setOpen(null)} width={400} label={open.name}>
          <div className={styles.detail}>
            <div className={styles.detailBadge}>
              <StickerBadge
                sticker={{
                  name: open.name,
                  hue: open.hue,
                  ...(open.icon ? { icon: open.icon as IconName } : {}),
                  ...(open.img ? { img: open.img } : {}),
                }}
                earned={open.earned}
              />
            </div>
            <div className="d" style={{ fontSize: 26 }}>
              {open.name}
            </div>
            <div className={styles.detailSport}>
              {open.sportLabel && open.sportColor && open.sportIcon ? (
                <SportChip
                  sport={{
                    label: open.sportLabel,
                    color: open.sportColor,
                    icon: open.sportIcon as IconName,
                  }}
                />
              ) : (
                <span
                  className="sportchip"
                  style={{ borderColor: 'var(--ink-3)', color: 'var(--ink-3)' }}
                >
                  Any sport
                </span>
              )}
            </div>
            <p className={`cond ${styles.detailCond}`}>{open.condition}</p>
            <div
              className="lab"
              style={{ marginTop: 14, color: open.earned ? 'var(--green)' : 'var(--ink-3)' }}
            >
              {open.earned ? (open.earnedLabel ?? '✓ Earned') : 'Still locked'}
            </div>
            <div className={styles.detailButtons}>
              <Button variant="ghost" style={{ flex: 1 }} onClick={() => setOpen(null)}>
                Close
              </Button>
              {open.earned && (
                <Button
                  style={{ flex: 1 }}
                  onClick={() => {
                    capture(ANALYTICS_EVENTS.stickerShared, { sticker: open.slug });
                    setSharing(open);
                    setOpen(null);
                  }}
                >
                  Share it
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {sharing && (
        <ShareCard
          kind="sticker"
          sticker={{
            name: sharing.name,
            hue: sharing.hue,
            ...(sharing.icon ? { icon: sharing.icon as IconName } : {}),
            ...(sharing.img ? { img: sharing.img } : {}),
          }}
          headline={sharing.shareHeadline}
          meta={view.shareMeta}
          dateLabel={view.dateLabel}
          caption={sharing.caption}
          poster={{
            url: `${SITE_URL}${ROUTES.stickers}`,
            fileName: `earned-${sharing.slug}.png`,
          }}
          onCopied={(ok) =>
            ok
              ? toast('Caption copied', 'var(--sky)')
              : toast('Could not copy that — select it and copy by hand.', 'var(--red)')
          }
          onShared={(method) => {
            capture(ANALYTICS_EVENTS.shareImageSent, { kind: 'sticker', method });
            if (method === 'save') toast('Image saved', 'var(--green)');
            if (method === 'clipboard') toast('No share sheet here. Caption copied', 'var(--sky)');
          }}
          onShareFailed={() => toast("Couldn't open the share sheet", 'var(--red)')}
          onClose={() => setSharing(null)}
        />
      )}
    </div>
  );
}
