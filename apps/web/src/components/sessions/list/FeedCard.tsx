'use client';

import {
  ClipPoster,
  Equipment,
  FeelFace,
  Icon,
  MetaChip,
  TrickPill,
  VisibilityLabel,
  WeatherIcon,
} from '@landit/ui-web';
import Link from 'next/link';

import type { SessionCardView } from './types';
import styles from './sessionsList.module.css';

type EquipmentName = Parameters<typeof Equipment>[0]['name'];

/**
 * One session on the feed (1a desktop, 2a phone). One set of markup for both:
 * the desktop date rail becomes the phone's inline "12 Sep" heading, the clip
 * goes full width, and View / Edit / Delete become two equal buttons and a
 * 44px bin — all in `sessionsList.module.css`, at 700px.
 */
export function FeedCard({ item, onDelete }: { item: SessionCardView; onDelete: () => void }) {
  const visibility = (
    <span title={item.visibility.blurb}>
      <VisibilityLabel
        visibility={item.visibility.id}
        label={item.visibility.label}
        size={13}
        className={styles.vis}
      />
    </span>
  );

  return (
    <article className={styles.card} aria-label={`${item.spot.name}, ${item.dateLabel}`}>
      <div className={`${styles.rail} ${item.isToday ? styles.railToday : ''}`} aria-hidden="true">
        <span className={styles.railDow}>{item.dow}</span>
        <span className={styles.railDay}>{item.day}</span>
        <span className={styles.railMon}>{item.mon}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.phoneDate}>
          <span className={styles.phoneDay}>{item.dateLabel}</span>
          <span className={styles.phoneTime}>
            {item.time} · {item.duration}
          </span>
          <span className={styles.phoneVis}>{visibility}</span>
        </div>

        <div className={styles.line1}>
          {item.spot.href ? (
            <Link href={item.spot.href} className={styles.spot}>
              {item.spot.name}
            </Link>
          ) : (
            <span className={styles.spot}>{item.spot.name}</span>
          )}
          {item.event ? (
            item.event.href ? (
              <Link href={item.event.href} className={styles.eventPill}>
                <Icon name="flag" size={13} className={styles.hidePhone} />
                {item.event.name}
              </Link>
            ) : (
              <span className={styles.eventPill}>{item.event.name}</span>
            )
          ) : null}
          <span className={`${styles.line1Vis} ${styles.hidePhone}`}>{visibility}</span>
        </div>

        <div className={styles.chips2}>
          <MetaChip icon={<Equipment name={item.sport.art as EquipmentName} size={15} title="" />}>
            {item.sport.label}
          </MetaChip>
          <MetaChip icon={<Icon name="clock" size={13} className={styles.hidePhone} />}>
            {item.duration}
          </MetaChip>
          {item.weather ? (
            <MetaChip icon={<WeatherIcon weather={item.weather.id} size={13} />}>
              {item.weather.label}
            </MetaChip>
          ) : null}
          <MetaChip background={item.feel.color} icon={<FeelFace feel={item.feel.id} size={15} />}>
            {item.feel.label}
          </MetaChip>
          {item.crew ? (
            <span className={styles.crew} title={`Rode with ${item.crew}`}>
              <Icon name="users" size={14} title="Rode with" />
              {item.crew}
            </span>
          ) : null}
        </div>

        {item.aim ? (
          <div className={styles.aim}>
            <span className={styles.aimLabel}>Aim</span>
            <span className={styles.aimText}>{item.aim}</span>
          </div>
        ) : null}

        {item.tricks.length || item.notes || item.clip ? (
          <div className={styles.mid}>
            {item.tricks.length || item.notes ? (
              <div className={styles.midText}>
                {item.tricks.length ? (
                  <div className={styles.tricks}>
                    {item.tricks.map((trick) => (
                      <TrickPill
                        key={trick.key}
                        name={trick.name}
                        move={trick.move || undefined}
                        href={trick.href ?? undefined}
                        className={styles.trick}
                      />
                    ))}
                  </div>
                ) : null}
                {item.notes ? <p className={styles.notes}>{item.notes}</p> : null}
              </div>
            ) : null}
            {item.clip ? (
              <ClipPoster
                platform={item.clip.platform}
                href={item.clip.href}
                label={item.clip.label}
                className={styles.clip}
              />
            ) : null}
          </div>
        ) : null}

        <div className={styles.foot}>
          <Link href={item.viewHref} className={`${styles.act} ${styles.tap}`}>
            View
          </Link>
          <Link href={item.editHref} className={`${styles.act} ${styles.tap}`}>
            Edit
          </Link>
          <button
            type="button"
            className={styles.del}
            onClick={onDelete}
            aria-label={`Delete the session at ${item.spot.name} on ${item.dateLabel}`}
          >
            <span className={styles.hidePhone}>Delete</span>
            <Icon name="trash" size={16} className={styles.hideDesktop} />
          </button>
          <span className={styles.time}>
            {item.time} · {item.duration}
          </span>
        </div>
      </div>
    </article>
  );
}
