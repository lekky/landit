'use client';

import type { SportId } from '@landit/core';
import { Avatar, Bar, Empty, Panel, SectionHead, StickerBadge, TrickCard } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { SportSwitch } from '@/components/shell/SportSwitch';
import { ROUTES, libraryHref, trickHref } from '@/lib/routes';
import { useSport } from '@/providers/sport';

import { AnnouncementBanner } from './AnnouncementBanner';
import { StreakCard } from './StreakCard';
import { WorkingTrick } from './WorkingTrick';
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
 * **Some cross-route links are still absent, and that is the guard working.**
 * The library is wired — T7 merged while this was building, so the trick cards
 * open `/library/[trick]` and the section head goes to `/library`. `/progress`,
 * `/stickers`, `/crew` and `/challenge` are T9, T10, T11 and T12 and do not
 * exist yet; `typedRoutes` makes a link to one a compile error, and casting a
 * route to make a dead link compile deletes the guard instead of solving the
 * problem (LESSONS §3a). So those section heads simply drop their "more" link,
 * and the task that lands each screen adds it back in one line. Each is listed
 * in this PR.
 */
export function HomeScreen({ view }: { view: HomeView }) {
  const { sport } = useSport();
  const router = useRouter();
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
        {/*
          The way into "My tricks" (T22). When there is something in progress
          this section is a slice of the rider's own list, so the link out goes
          to the whole of it rather than to the library at large — and it says
          how many are there, which is the reason to follow it. With nothing in
          progress the section is "Start here", suggestions from the library,
          and the library is where it should still point.
        */}
        <SectionHead
          more={working ? `All ${current.tracked} of yours →` : 'Library →'}
          onMore={() => router.push(working ? libraryHref({ mine: true }) : ROUTES.library)}
        >
          {working ? 'Working on it' : 'Start here'}
        </SectionHead>
        {primary.length ? (
          <div className="grid-tricks">
            {primary.map((t) =>
              working ? (
                <WorkingTrick
                  key={t.slug}
                  trick={t}
                  onOpen={() => router.push(trickHref(t.slug))}
                />
              ) : (
                <HomeTrickCard
                  key={t.slug}
                  trick={t}
                  onOpen={() => router.push(trickHref(t.slug))}
                />
              ),
            )}
          </div>
        ) : (
          <Empty
            icon="grid"
            title="Nothing to show yet"
            sub="Find a trick in the library and mark it as one you are learning."
            cta="Find a trick"
            onCta={() => router.push(ROUTES.library)}
          />
        )}
      </section>

      {current.wishList.length > 0 && (
        <section>
          <SectionHead>On the wish list</SectionHead>
          <div className="grid-tricks">
            {current.wishList.map((t) => (
              <HomeTrickCard key={t.slug} trick={t} onOpen={() => router.push(trickHref(t.slug))} />
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
              cta="Find a trick"
              onCta={() => router.push(ROUTES.library)}
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

/** A trick card that opens the trick page T7 landed. */
function HomeTrickCard({ trick, onOpen }: { trick: TrickCardView; onOpen: () => void }) {
  return (
    <TrickCard
      name={trick.name}
      category={trick.category}
      difficulty={trick.difficulty}
      sport={trick.sport}
      stage={trick.stage}
      locked={trick.locked}
      onOpen={onOpen}
      {...(trick.lockTier ? { lockTier: trick.lockTier } : {})}
    />
  );
}
