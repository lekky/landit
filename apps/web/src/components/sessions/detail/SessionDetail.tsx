import {
  Avatar,
  ClipPoster,
  Equipment,
  FeelFace,
  Icon,
  StageMove,
  VisibilityLabel,
  WeatherIcon,
  type IconName,
} from '@landit/ui-web';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { sessionsHref } from '@/lib/sessionRoutes';

import { DetailActions } from './DetailActions';
import { MakePrivateButton } from './MakePrivateButton';
import type { SessionDetailView } from './load';
import styles from './detail.module.css';

/**
 * One session (T39; design 1e desktop, 2c phone). A server component: every
 * string arrives formatted, and only Edit/Delete and "Make it private" are
 * client islands.
 *
 * Owner and non-owner share the layout. What a non-owner does not get is
 * decided by `load.ts` and stated here in one place each: no Edit or Delete, no
 * visibility card, no "1 of 10", and "What this one changed" cut to stage moves.
 */
export function SessionDetail({ view }: { readonly view: SessionDetailView }) {
  const editHref = view.editHref;

  const stats: {
    key: string;
    label: string;
    value: string;
    icon: ReactNode;
    phoneOnly?: boolean;
  }[] = [
    {
      key: 'sport',
      label: 'Sport',
      value: view.sport.label,
      icon: <Equipment name={view.sport.icon as IconName} size={20} />,
    },
    {
      key: 'time',
      label: 'Time on it',
      value: view.duration,
      icon: <Icon name="clock" size={20} strokeWidth={2.2} />,
    },
    // A session logged without a feel has no row here at all. An empty "How it
    // felt" would be the screen asking a question the rider already declined.
    ...(view.feel
      ? [
          {
            key: 'feel',
            label: 'How it felt',
            value: view.feel.label,
            icon: <FeelFace feel={view.feel.id} size={20} />,
          },
        ]
      : []),
    {
      key: 'tricks',
      label: 'Tricks',
      value: view.tricksStat,
      icon: <Icon name="grid" size={20} strokeWidth={2.2} />,
    },
    {
      key: 'crew',
      label: 'Rode with',
      value: view.crewStat,
      icon: <Icon name="users" size={20} strokeWidth={2.2} />,
    },
    {
      key: 'clip',
      label: 'Clip',
      value: view.clip ? view.clip.label : 'None',
      icon: <Icon name="cam" size={20} strokeWidth={2.2} />,
      phoneOnly: true,
    },
  ];

  const actionProps = editHref
    ? {
        sessionId: view.id,
        editHref,
        spotName: view.spot.name,
        dateLabel: view.dates.dayMonth,
      }
    : null;

  return (
    <div className={styles.page}>
      {/* Phone: the black bar — back, position, Edit and the trash icon (2c). */}
      <div className={styles.phoneBar}>
        <Link className={styles.barBack} href={sessionsHref()} aria-label="All sessions">
          <Icon name="arrow-left" size={22} strokeWidth={2.2} />
        </Link>
        {view.pager.position ? <span className={styles.barPos}>{view.pager.position}</span> : null}
        {actionProps ? <DetailActions {...actionProps} variant="bar" /> : null}
      </div>

      {/* Desktop: back link and the pager (1e). */}
      <div className={styles.topRow}>
        <Link className={styles.backLink} href={sessionsHref()}>
          <Icon name="arrow-left" size={16} strokeWidth={2.2} />
          All sessions
        </Link>
        <nav className={styles.topPager} aria-label="Other sessions">
          <PagerLink to={view.pager.newer} dir="newer" compact />
          {view.pager.position ? (
            <span className={styles.pagerPos}>{view.pager.position}</span>
          ) : null}
          <PagerLink to={view.pager.older} dir="older" compact />
        </nav>
      </div>

      <article className={styles.card}>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <div className={styles.pills}>
              <span className={styles.datePill}>
                <span className={styles.desktopOnly}>{view.dates.long}</span>
                <span className={styles.phoneOnly}>{view.dates.short}</span>
              </span>
              {view.event ? (
                <Link className={styles.eventPill} href={view.event.href}>
                  <Icon name="flag" size={13} strokeWidth={2.2} />
                  {view.event.name}
                </Link>
              ) : null}
            </div>
            <h1 className={styles.spotName}>{view.spot.name}</h1>
            {view.spot.href ? (
              <Link className={styles.spotLink} href={view.spot.href}>
                <Icon name="map" size={16} strokeWidth={2.2} />
                {view.spot.place ? `${view.spot.place} · ` : ''}open the spot →
              </Link>
            ) : view.spot.place ? (
              <span className={styles.spotLink}>
                <Icon name="map" size={16} strokeWidth={2.2} />
                {view.spot.place}
              </span>
            ) : null}
          </div>
          {actionProps ? (
            <div className={styles.desktopOnly}>
              <DetailActions {...actionProps} variant="hero" />
            </div>
          ) : null}
        </header>

        <dl className={styles.stats}>
          {stats.map((stat) => (
            <div
              key={stat.key}
              className={`${styles.stat}${stat.phoneOnly ? ` ${styles.statPhoneOnly}` : ''}`}
            >
              <span className={styles.statIcon} aria-hidden="true">
                {stat.icon}
              </span>
              <div className={styles.statText}>
                <dt className={styles.statLabel}>{stat.label}</dt>
                <dd className={styles.statValue}>{stat.value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <div className={styles.body}>
          <div className={styles.mainCol}>
            {view.clip ? (
              <div className={styles.player}>
                <ClipPoster
                  platform={view.clip.platform}
                  href={view.clip.href}
                  label={view.clip.label}
                  variant="player"
                />
                <span className={styles.playerNote} aria-hidden="true">
                  Plays on {view.clip.label} · we hold the link
                </span>
              </div>
            ) : null}

            {view.changes.length ? (
              <Changes lines={view.changes} className={styles.phoneOnlyBlock} />
            ) : null}

            {view.aim || view.notes ? (
              <section className={styles.words}>
                {view.aim ? (
                  <div>
                    <SectionHead>The aim</SectionHead>
                    <p className={styles.aim}>{view.aim}</p>
                  </div>
                ) : null}
                {view.notes ? (
                  <div>
                    <SectionHead>Notes</SectionHead>
                    <p className={styles.notes}>{view.notes}</p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {view.tricks.length ? (
              <section className={styles.tricksBox}>
                <SectionHead>Tricks worked on</SectionHead>
                <ul className={styles.trickList}>
                  {view.tricks.map((trick) => {
                    const inner = (
                      <>
                        {trick.art ? (
                          // Our own sticker art, served by us — never a third party.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className={styles.trickArt} src={trick.art} alt="" />
                        ) : (
                          <span className={styles.trickArt} aria-hidden="true" />
                        )}
                        <span className={styles.trickText}>
                          <span className={styles.trickName}>{trick.name}</span>
                          <span className={styles.trickNote}>{trick.note}</span>
                        </span>
                        {trick.move ? (
                          <>
                            <StageMove
                              from={trick.move.from}
                              to={trick.move.to}
                              className={styles.desktopMove}
                            />
                            <span className={styles.phoneMove}>→ {trick.move.to.label}</span>
                          </>
                        ) : null}
                        <span className={styles.chev} aria-hidden="true">
                          <Icon name="arrow-right" size={16} strokeWidth={2.2} />
                        </span>
                      </>
                    );
                    const cls = `${styles.trickRow}${trick.move ? ` ${styles.trickMoved}` : ''}`;
                    return (
                      <li key={trick.key}>
                        {trick.href ? (
                          <Link className={cls} href={trick.href}>
                            {inner}
                          </Link>
                        ) : (
                          <div className={cls}>{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className={styles.sideCol}>
            {view.changes.length ? (
              <Changes lines={view.changes} className={styles.desktopOnlyBlock} />
            ) : null}

            {view.crew.length ? (
              <section className={styles.box}>
                <h2 className={styles.label}>Who was there</h2>
                <ul className={styles.crewList}>
                  {view.crew.map((mate) => (
                    <li key={mate.id} className={styles.crewChip}>
                      <Avatar
                        avatarId={mate.avatarId}
                        name={mate.name}
                        size={24}
                        ringWidth={2}
                        decorative
                      />
                      <span>{mate.name}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {view.isOwner ? (
              <section className={styles.box}>
                {/*
                  The shared label, not `VISIBILITY_ICONS` read here: that table
                  lives in a `'use client'` module, and a server component gets a
                  client reference in its place rather than the paths.
                */}
                <h2 className={styles.visTitle}>
                  <VisibilityLabel
                    visibility={view.visibility.id}
                    label={view.visibility.title}
                    size={19}
                  />
                </h2>
                <p className={styles.visBody}>{view.visibility.body}</p>
                {view.visibility.id !== 'private' ? (
                  <MakePrivateButton sessionId={view.id} />
                ) : view.editHref ? (
                  <Link className={styles.smallBtn} href={view.editHref}>
                    Change
                  </Link>
                ) : null}
              </section>
            ) : null}

            {view.weather ? (
              <section className={styles.weather}>
                <h2 className={styles.label}>Weather that day</h2>
                <div className={styles.weatherRow}>
                  <WeatherIcon weather={view.weather.id} size={26} />
                  <span>{view.weather.label}</span>
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </article>

      {/* Phone: the pager at the foot (2c). */}
      <nav className={styles.footPager} aria-label="Other sessions">
        <PagerLink to={view.pager.newer} dir="newer" />
        <PagerLink to={view.pager.older} dir="older" />
      </nav>
    </div>
  );
}

function SectionHead({ children }: { children: ReactNode }) {
  return (
    <div className={styles.secHead}>
      <span className={styles.secDiamond} aria-hidden="true" />
      <h2 className={styles.secTitle}>{children}</h2>
      <span className={styles.secRule} aria-hidden="true" />
    </div>
  );
}

function Changes({ lines, className }: { lines: readonly string[]; className?: string }) {
  return (
    <section className={`${styles.changes} ${className ?? ''}`}>
      <h2 className={styles.changesTitle}>What this one changed</h2>
      <ul className={styles.changeList}>
        {lines.map((line) => (
          <li key={line} className={styles.changeItem}>
            <span className={styles.tick} aria-hidden="true">
              <Icon name="check" size={14} strokeWidth={3.4} />
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Newer or older. The end with nowhere to go is drawn dimmed and is not a link,
 * so the newer end of the diary is disabled on the latest session.
 */
function PagerLink({
  to,
  dir,
  compact = false,
}: {
  to: SessionDetailView['pager']['newer'];
  dir: 'newer' | 'older';
  compact?: boolean;
}) {
  const cls = compact ? styles.pagerBtn : styles.footBtn;
  const label =
    dir === 'newer' ? (compact ? 'Newer' : '← Newer') : to ? `${to.label} →` : 'Older →';
  if (!to) {
    return (
      <span className={`${cls} ${styles.pagerOff}`} aria-disabled="true">
        {compact && dir === 'newer' ? (
          <Icon name="chevron" size={15} className={styles.chevLeft} />
        ) : null}
        {compact ? (dir === 'newer' ? 'Newer' : 'Older') : label}
      </span>
    );
  }
  return (
    <Link
      className={cls}
      href={to.href}
      aria-label={dir === 'newer' ? 'Newer session' : 'Older session'}
    >
      {compact && dir === 'newer' ? (
        <Icon name="chevron" size={15} className={styles.chevLeft} />
      ) : null}
      {compact ? (dir === 'newer' ? to.label : to.label) : label}
      {compact && dir === 'older' ? (
        <Icon name="chevron" size={15} className={styles.chevRight} />
      ) : null}
    </Link>
  );
}
