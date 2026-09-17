'use client';

import type { WhatsNewKind } from '@landit/core';
import { Avatar, Icon, Panel, SportChip, Tag, type IconName } from '@landit/ui-web';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { TabRow, TAB_PANEL, type TabRowItem } from '@/components/shell/TabRow';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { riderHref, ROUTES } from '@/lib/routes';

import { markWhatsNewSeenAction } from './actions';
import styles from './whats-new.module.css';
import {
  WHATS_NEW_DROPDOWN_LINES,
  type WhatsNewCrewItemView,
  type WhatsNewLineView,
  type WhatsNewView,
} from './view';

/**
 * What's new (D4, rethink §3.6) — the bell's contents at both widths.
 *
 * One component in two places, which is the whole of the phone/desktop split
 * the spec asks for: on a phone it *is* the page `/whats-new`, and on a desktop
 * it is the body of the bell's `Dropdown`, capped at eight lines with an
 * "All →" to the same page. A 420px panel hanging off the right edge of a 375px
 * screen is not a panel, and a page that a rider has to navigate away from to
 * see the rest of is not a dropdown.
 *
 * **Two tabs' worth of content, and they come from different places on
 * purpose.** The You tab is the derived feed — sentences the product wrote from
 * the rider's own rows, in `@landit/core` where they can be unit-tested. A crew
 * tab is the **existing crew activity feed**, unchanged: same route, same six
 * sentences, same row. Neither has anywhere a rider could put a word of their
 * own, which is what plan §6.1 means by "no rider-to-rider messaging" being
 * true of the shapes and not only of the intent.
 *
 * **Opening it marks it read.** `markWhatsNewSeenAction` stamps
 * `users.whats_new_seen_at` on mount and the bell's count goes with it, without
 * the rider having to do anything; "Mark all read" stamps again and is the
 * explicit version of the same promise, for a rider who skimmed a long list and
 * wants to say so. The count the button reports is the count the panel *opened*
 * with, because that is the number that was on the bell.
 *
 * **Every line stays on the list once it is read**, which is why the panel has
 * no unread styling: this is what has happened lately, not an inbox. The count
 * is the only thing "read" changes, and it is a count of what arrived since the
 * rider last looked rather than of what they have not ticked off.
 */

export type WhatsNewPlace = 'page' | 'dropdown';

/** The disc beside a You line: a fixed fill and an icon, both by kind. */
const LINE_LOOK: Record<WhatsNewKind, { icon: IconName; fill: string }> = {
  sticker: { icon: 'star', fill: 'var(--yellow)' },
  event: { icon: 'flag', fill: 'var(--sky)' },
  challenge: { icon: 'bolt', fill: 'var(--orange)' },
  week: { icon: 'flame', fill: 'var(--lime)' },
  join: { icon: 'users', fill: 'var(--violet)' },
};

const YOU_TAB = 'you';

const NOTHING_YET =
  'Nothing here yet. Stickers you earn, riders joining your crews and what’s coming up will land here.';

export function WhatsNewPanel({
  view,
  place = 'page',
}: {
  view: WhatsNewView;
  place?: WhatsNewPlace;
}) {
  const [tab, setTab] = useState<string>(YOU_TAB);
  const [read, setRead] = useState(false);

  /*
   * The count the bell was showing when this opened.
   *
   * Held in a ref rather than read from `view` at press time because the
   * stamp below changes what `unread` would be on the next render, and the
   * analytics property is meant to say how much news the rider had — not how
   * much was left by the time they pressed a button clearing it.
   */
  const openedWith = useRef(view.unread);

  const router = useRouter();

  /**
   * Stamp the bookmark, then ask the server for a fresh layout.
   *
   * The count on the bell comes from the layout's server render, so without the
   * refresh a rider sits reading four lines with a badge beside them still
   * saying four, until they happen to navigate. `router.refresh()` re-renders
   * the server components and **keeps client state**, so the dropdown does not
   * close and the tab does not move — the number simply goes.
   *
   * It costs one server render per opening, which is the honest price of a
   * badge that is right while a rider is looking at it.
   */
  const stampAndRefresh = useCallback(async () => {
    await markWhatsNewSeenAction();
    router.refresh();
  }, [router]);

  const stamped = useRef(false);
  useEffect(() => {
    // Once per mount. React's strict mode runs effects twice in development,
    // and a second PATCH would be harmless but pointless.
    if (stamped.current) return;
    stamped.current = true;
    void stampAndRefresh();
  }, [stampAndRefresh]);

  const tabs: TabRowItem[] = [
    { id: YOU_TAB, label: 'You' },
    ...view.crews.map((crew) => ({ id: crew.id, label: crew.name })),
  ];

  const crew = view.crews.find((c) => c.id === tab) ?? null;
  const lines = place === 'dropdown' ? view.lines.slice(0, WHATS_NEW_DROPDOWN_LINES) : view.lines;
  const crewItems =
    crew && place === 'dropdown' ? crew.items.slice(0, WHATS_NEW_DROPDOWN_LINES) : crew?.items;

  const more =
    place === 'dropdown' &&
    (crew
      ? crew.items.length > WHATS_NEW_DROPDOWN_LINES
      : view.lines.length > WHATS_NEW_DROPDOWN_LINES);

  return (
    <>
      <div className={styles.head}>
        {place === 'page' ? (
          <h1 className={`d ${styles.title}`} style={{ fontSize: 'clamp(30px,6vw,44px)' }}>
            What’s new
          </h1>
        ) : (
          <span className="lab">What’s new</span>
        )}
        <button
          type="button"
          className={styles.markRead}
          disabled={read}
          onClick={() => {
            setRead(true);
            capture(ANALYTICS_EVENTS.whatsNewRead, { unread: openedWith.current });
            void stampAndRefresh();
          }}
        >
          {read ? 'All read' : 'Mark all read'}
        </button>
      </div>

      {/*
        One tab per crew, named after the crew. The row is hidden with a single
        crewless rider for the same reason the sport chip is hidden for a
        one-sport rider: a row of one is not a choice.
      */}
      {tabs.length > 1 && (
        <TabRow
          items={tabs}
          value={tab}
          group="whats-new"
          label="What’s new"
          className={styles.tabs}
          onChange={setTab}
        />
      )}

      <Panel flat className={place === 'dropdown' ? styles.inDropdown : undefined}>
        {/*
          Keyed on the tab so React remounts the panel and §4's 120ms
          cross-fade runs on every switch (`TAB_PANEL`, T45).
        */}
        <div key={tab} className={TAB_PANEL}>
          {crew ? <CrewFeed crew={crew} items={crewItems ?? []} /> : <YouFeed lines={lines} />}
          {more && (
            <Link href={ROUTES.whatsNew} className={styles.all}>
              All →
            </Link>
          )}
        </div>
      </Panel>
    </>
  );
}

function YouFeed({ lines }: { lines: readonly WhatsNewLineView[] }) {
  if (lines.length === 0) return <p className={styles.empty}>{NOTHING_YET}</p>;

  return (
    <div className={styles.feed}>
      {lines.map((line) => {
        const look = LINE_LOOK[line.kind];
        return (
          <Row
            key={line.id}
            disc={
              line.avatarKey || line.riderName ? (
                <Avatar avatarId={line.avatarKey} name={line.riderName ?? ''} size={32} />
              ) : (
                <span
                  className={styles.disc}
                  style={{ background: line.hue || look.fill }}
                  aria-hidden="true"
                >
                  <Icon name={look.icon} size={16} strokeWidth={2.3} />
                </span>
              )
            }
            meta={
              <>
                <span className={`lab ${styles.when}`}>{line.source}</span>
                {line.when && <span className={`lab ${styles.when}`}>{line.when}</span>}
              </>
            }
          >
            {line.line}
          </Row>
        );
      })}
    </div>
  );
}

function CrewFeed({
  crew,
  items,
}: {
  crew: { name: string; problem: string | null };
  items: readonly WhatsNewCrewItemView[];
}) {
  if (crew.problem) return <p className={styles.empty}>{crew.problem}</p>;

  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing yet. Riders whose profile is private never show up here — they still hold their
        place on the board.
      </p>
    );
  }

  return (
    <div className={styles.feed}>
      {items.map((item) => (
        <Row
          key={item.id}
          disc={<Avatar avatarId={item.avatarKey} name={item.name} size={32} />}
          meta={
            <>
              <span className={`lab ${styles.when}`}>{item.when}</span>
              {item.sport ? <SportChip sport={item.sport} small /> : null}
              {item.hue ? <Tag color={item.hue}>Sticker</Tag> : null}
            </>
          }
        >
          <Link href={riderHref(item.handle)} className={styles.who}>
            {item.name}
          </Link>{' '}
          {item.line}
        </Row>
      ))}
    </div>
  );
}

/** The row itself: 32px disc, one sentence, a `.lab` line under it (§3.6). */
function Row({ disc, meta, children }: { disc: ReactNode; meta: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.row}>
      {disc}
      <div className={styles.body}>
        <p className={styles.line}>{children}</p>
        <div className={styles.meta}>{meta}</div>
      </div>
    </div>
  );
}
