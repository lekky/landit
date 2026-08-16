'use client';

import type { SportId } from '@landit/core';
import { Avatar, Bar, Empty, Panel, SectionHead, StickerBadge, TrickCard } from '@landit/ui-web';
import { useCallback } from 'react';

import { SportSwitch } from '@/components/shell/SportSwitch';
import { useSport } from '@/providers/sport';

import { AnnouncementBanner } from './AnnouncementBanner';
import { StreakCard } from './StreakCard';
import type { HomeView, TrickCardView } from './view';

import styles from './home.module.css';

/**
 * The dashboard, as the rider sees it (screenshot 06).
 *
 * A client component only because the sport tabs are: everything it renders was
 * computed on the server and handed over as plain data (`view.ts`), so switching
 * tab is a re-render rather than a fetch, and nothing on the page is produced by
 * ICU on one side of hydration and not the other (LESSONS §3a).
 *
 * **Cross-route links are deliberately absent.** `/library`, `/library/[trick]`,
 * `/progress`, `/stickers` and `/crew` are T7, T9, T10 and T11 — none of them
 * exists on this branch, `typedRoutes` makes a link to one a compile error, and
 * casting a route to make a dead link compile deletes the guard instead of
 * solving the problem (LESSONS §3a). So the section heads drop their "more"
 * link and the trick cards have no click target until the routes land. Every
 * one is listed in this PR for the follow-up that wires them.
 */
export function HomeScreen({ view }: { view: HomeView }) {
  const { sport } = useSport();
  const current = view.bySport[sport] ?? view.bySport[view.sports[0] as string];

  const note = useCallback(
    (id: SportId) => `${view.bySport[id]?.landed ?? 0} landed`,
    [view.bySport],
  );

  if (!current) return null;

  const working = current.workingTricks.length > 0;
  const primary = working ? current.workingTricks : current.startHere;

  return (
    <div className={styles.page}>
      {current.announcement && <AnnouncementBanner notice={current.announcement} />}

      <SportSwitch note={note} label="Sport" />

      <div className={styles.top}>
        <Panel className={styles.greeting}>
          <span className="eyebrow">{view.dateLabel}</span>
          <h1 className={`d ${styles.hello}`}>Alright, {view.firstName}.</h1>
          <p className={styles.summary}>
            {current.summary}
            {current.acrossSports && <span className={styles.across}>{current.acrossSports}</span>}
          </p>

          <div className={styles.stats}>
            <StatBlock n={current.landed} label="Landed" hue="var(--lime)" />
            <StatBlock n={current.working} label="Learning" hue="var(--yellow)" />
            <StatBlock n={current.wanted} label="Want to" hue="#C9B8FF" />
            <StatBlock n={current.stickerCount} label="Stickers" hue="#FFB3C9" />
          </div>

          <div className={styles.library}>
            <div className={styles.libraryHead}>
              <span className="lab">{current.libraryLabel}</span>
              <span className="lab">
                {current.landed} / {current.total}
              </span>
            </div>
            <Bar pct={current.pct} />
          </div>
        </Panel>

        <div className={styles.side}>
          <StreakCard streak={view.streak} />

          {current.challenge && (
            <div
              className={`panel ${styles.challenge}`}
              style={{ background: current.challenge.hue }}
            >
              <div className={styles.challengeHead}>
                <span className="tag" style={{ background: 'var(--ink)' }}>
                  {current.challenge.week}
                </span>
                <span className="lab">{current.challenge.stateLabel}</span>
              </div>
              <div className={`d ${styles.challengeTitle}`}>{current.challenge.title}</div>
              <p className={styles.challengeBlurb}>{current.challenge.blurb}</p>
              <Bar pct={current.challenge.pct} color="var(--ink)" height={13} />
              <div className="lab" style={{ marginTop: 7 }}>
                {current.challenge.logged} of {current.challenge.goal} logged
              </div>
            </div>
          )}
        </div>
      </div>

      <section>
        <SectionHead>{working ? 'Working on it' : 'Start here'}</SectionHead>
        {primary.length ? (
          <div className="grid-tricks">
            {primary.map((t) => (
              <HomeTrickCard key={t.slug} trick={t} />
            ))}
          </div>
        ) : (
          <Empty
            icon="grid"
            title="Nothing to show yet"
            sub="The trick library lands next. Everything you log there shows up here."
          />
        )}
      </section>

      {current.wishList.length > 0 && (
        <section>
          <SectionHead>On the wish list</SectionHead>
          <div className="grid-tricks">
            {current.wishList.map((t) => (
              <HomeTrickCard key={t.slug} trick={t} />
            ))}
          </div>
        </section>
      )}

      <div className={styles.bottom}>
        <section>
          <SectionHead>Stickers</SectionHead>
          {view.stickers.length ? (
            <div className={styles.stickerRow}>
              {view.stickers.map((s) => (
                <StickerBadge
                  key={s.id}
                  sticker={{
                    name: s.name,
                    hue: s.hue,
                    ...(s.icon ? { icon: s.icon as never } : {}),
                  }}
                  earned
                />
              ))}
            </div>
          ) : (
            <Empty
              icon="star"
              title="No stickers yet"
              sub="Log your first trick and the first one drops straight away."
            />
          )}
        </section>

        <section>
          <SectionHead>Your crew</SectionHead>
          {view.crew.length ? (
            <Panel flat className={styles.crew}>
              {view.crew.map((rider, i) => (
                <div
                  key={rider.id}
                  className={styles.crewRow}
                  data-me={rider.isMe || undefined}
                  data-last={i === view.crew.length - 1 || undefined}
                >
                  <span className={`d ${styles.crewRank}`}>{i + 1}</span>
                  <Avatar avatarId={rider.avatarKey || null} name={rider.name} size={32} />
                  <div className={styles.crewName}>
                    <div className="cond" style={{ fontSize: 15 }}>
                      {rider.name}
                    </div>
                    <div className={`lab ${styles.crewHandle}`}>
                      {rider.handle ? `@${rider.handle}` : ''}
                    </div>
                  </div>
                  <div className={styles.crewScore}>
                    <div className="d" style={{ fontSize: 19 }}>
                      {rider.landed}
                    </div>
                    <div className="lab" style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>
                      landed
                    </div>
                  </div>
                </div>
              ))}
            </Panel>
          ) : (
            <Empty
              icon="users"
              title="No crew yet"
              sub="Crews are invite-only — yours shows up here the moment a mate sends you a code."
            />
          )}
        </section>
      </div>
    </div>
  );
}

function StatBlock({ n, label, hue }: { n: number; label: string; hue: string }) {
  return (
    <div className={styles.stat} style={{ background: hue }}>
      <div className={`d ${styles.statNumber}`}>{n}</div>
      <div className={`lab ${styles.statLabel}`}>{label}</div>
    </div>
  );
}

/**
 * A trick card with no destination.
 *
 * `/library/[trick]` is T7's and does not exist here, so the card renders
 * without an `onOpen` rather than with a cast route. It keeps its place, its
 * stage colour and its lock state; only the tap is missing, and the follow-up
 * that wires the route adds it in one line.
 */
function HomeTrickCard({ trick }: { trick: TrickCardView }) {
  return (
    <TrickCard
      name={trick.name}
      category={trick.category}
      difficulty={trick.difficulty}
      sport={trick.sport}
      stage={trick.stage}
      locked={trick.locked}
      {...(trick.lockTier ? { lockTier: trick.lockTier } : {})}
    />
  );
}
