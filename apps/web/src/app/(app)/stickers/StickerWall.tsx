'use client';

import type { SportId } from '@landit/core';
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

import { SectionTabs } from '@/components/shell/SectionTabs';
import { PROGRESS_TABS } from '@/components/shell/nav';
import { SportSwitch } from '@/components/shell/SportSwitch';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { useToast } from '@/providers/toast';
import { useSport } from '@/providers/sport';

import { acknowledgeStickersAction } from './actions';
import { groupWall } from './groups';
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
  const earned = wall.filter((s) => s.earned).length;

  const notes = new Map(view.tabs.map((t) => [t.sport, t.earnedLabel]));

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
      <SectionTabs tabs={PROGRESS_TABS} label="Progress" />

      <SportSwitch note={(id) => notes.get(id) ?? ''} label="Sport" />

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
        Shelved, not heaped (#245): Earned first, then the locked awards by what
        they are for — see `groups.ts` for the shelves and for why "nearly
        there" is not one of them yet. Each shelf is a labelled section so a
        screen reader can jump between them the way the eye does.
      */}
      <Panel className={styles.wall}>
        {groupWall(wall).map((group) => (
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
              {group.stickers.map((s) => (
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
          </section>
        ))}
      </Panel>

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
          onCopied={(ok) =>
            ok
              ? toast('Caption copied', 'var(--sky)')
              : toast('Could not copy that — select it and copy by hand.', 'var(--red)')
          }
          onClose={() => setSharing(null)}
        />
      )}
    </div>
  );
}
