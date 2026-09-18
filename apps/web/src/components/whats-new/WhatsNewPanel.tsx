'use client';

import type { WhatsNewKind } from '@landit/core';
import { Avatar, Icon, Panel, SportChip, Tag, type IconName } from '@landit/ui-web';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { FEED_META, FEED_WHO, FeedLine, FeedList } from '@/components/feed/FeedLine';
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
 * sentences, same `FeedLine`. Neither has anywhere a rider could put a
 * *sentence* of their own, which is what plan §6.1 means by "no rider-to-rider
 * messaging" being true of the shapes and not only of the intent. Two
 * rider-typed **names** do appear — a crew's and a rider's — and both are
 * already on the crew screen for the same readers; `@landit/core`'s
 * `whats-new.ts` says which is which and why the distinction matters.
 *
 * **Opening it marks it read, when there is something to mark.**
 * `markWhatsNewSeenAction` stamps `users.whats_new_seen_at` on mount and the
 * bell's count goes with it, without the rider having to do anything — but only
 * when the count was above zero and the read succeeded, so a bell pressed out of
 * habit costs no write and no re-render, and a feed that failed to load never
 * walks the bookmark past news nobody saw. "Mark all read" is the explicit
 * version of the same promise, for a rider who skimmed a long list and wants to
 * say so, and it reports the count the panel *opened* with because that is the
 * number that was on the bell.
 *
 * **Every line stays on the list once it is read**, which is why the panel has
 * no unread styling: this is what has happened lately, not an inbox. The count
 * is the only thing "read" changes, and it is a count of what arrived since the
 * rider last looked rather than of what they have not ticked off.
 */

export type WhatsNewPlace = 'page' | 'dropdown';

/** `/whats-new`, opening on the tab the rider was reading. */
function allHref(crewId: string | undefined): Route {
  return (
    crewId ? `${ROUTES.whatsNew}?tab=${encodeURIComponent(crewId)}` : ROUTES.whatsNew
  ) as Route;
}

/** The disc beside a You line: a fixed fill and an icon, both by kind. */
const LINE_LOOK: Record<WhatsNewKind, { icon: IconName; fill: string }> = {
  sticker: { icon: 'star', fill: 'var(--yellow)' },
  event: { icon: 'flag', fill: 'var(--sky)' },
  challenge: { icon: 'bolt', fill: 'var(--orange)' },
  week: { icon: 'flame', fill: 'var(--lime)' },
  join: { icon: 'users', fill: 'var(--violet)' },
};

/** The first tab's id. Exported so the page's `?tab=` wrapper can name it. */
export const YOU_TAB = 'you';

/**
 * The DOM id of a tab, so its panel can be `aria-labelledby` it (§3.3).
 *
 * The place is in the id because a desktop rider standing on `/whats-new` can
 * open the bell over it, which puts two copies of this panel in one document —
 * and two elements answering to one id is a reference that names whichever the
 * browser finds first.
 */
const tabElementId = (place: WhatsNewPlace, id: string) => `whats-new-${place}-tab-${id}`;

const NOTHING_YET =
  'Nothing here yet. Stickers you earn, riders joining your crews and what’s coming up will land here.';

export function WhatsNewPanel({
  view,
  place = 'page',
  tab: controlledTab,
  onTab,
}: {
  view: WhatsNewView;
  place?: WhatsNewPlace;
  /**
   * The tab being read, where somebody outside keeps it.
   *
   * The **page** does (`WhatsNewPageBody`), in `?tab=` through `useTabParam` —
   * the same place Progress and the sticker wall keep theirs, so the address
   * a rider is on says which tab they are on, a reload keeps it, and the
   * dropdown's "All →" lands where it pointed. The **dropdown** does not: it
   * is a panel over whatever page the rider is reading, and rewriting that
   * page's query because somebody glanced at a crew tab would be the bell
   * editing the address of a screen it is only floating above.
   *
   * Left undefined, the panel keeps the tab in its own state.
   */
  tab?: string;
  onTab?: (id: string) => void;
}) {
  const [localTab, setLocalTab] = useState<string>(YOU_TAB);
  const tab = controlledTab ?? localTab;
  const setTab = onTab ?? setLocalTab;
  const [read, setRead] = useState(false);

  /*
   * The count the bell was showing when this opened.
   *
   * Frozen at mount rather than read from `view` at press time, because the
   * stamp below changes what `unread` would be on the next render: the
   * analytics property is meant to say how much news the rider had, not how
   * much was left by the time they pressed the button clearing it. The button
   * is also *drawn* from it — disabled and reading "All read" at zero — which
   * is why this is state rather than a ref: a ref read during render is a value
   * React has not promised to re-render for, and the lint rule is right to say
   * so.
   */
  const [openedWith] = useState(view.unread);

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

  /**
   * There is something to clear, and the list we would be clearing is real.
   *
   * Two guards on one line, from two findings. **Nothing unread, nothing to
   * do** (review S2): stamping on every opening meant a rider who pressed the
   * bell out of habit paid a write and a full server re-render of whatever page
   * they were on, to move a bookmark that was already past everything. And
   * **never stamp a list that failed to load** (review N5): the loader fails
   * soft to an empty list so a broken feed cannot take the library down, which
   * would otherwise let a transient read failure walk the bookmark past news
   * the rider was never shown.
   */
  const clearable = view.ok && view.unread > 0;

  const stamped = useRef(false);
  useEffect(() => {
    // Once per mount. React's strict mode runs effects twice in development,
    // and a second PATCH would be harmless but pointless.
    if (stamped.current) return;
    stamped.current = true;

    /*
     * The opening is counted here rather than on the control that was pressed
     * (review N1). On a phone the bell is a `Link`, so a `capture` on its click
     * raced the navigation and PostHog could drop it — and a rider arriving by
     * "All →", by a deep link or by the back button fired nothing at all, so
     * the mobile number undercounted by however many of those there were. The
     * page mounting is the thing that actually happened. The dropdown keeps
     * firing from `BellButton`, where opening it *is* the press.
     */
    if (place === 'page') {
      capture(ANALYTICS_EVENTS.whatsNewOpened, { where: 'mobile', unread: view.unread });
    }

    if (clearable) void stampAndRefresh();
  }, [clearable, place, stampAndRefresh, view.unread]);

  const tabs: TabRowItem[] = [
    { id: YOU_TAB, label: 'You', elementId: tabElementId(place, YOU_TAB) },
    ...view.crews.map((crew, index) => ({
      id: crew.id,
      label: crew.name,
      elementId: tabElementId(place, crew.id),
      // The crew's name is rider-typed and 2–40 characters, so the row has to
      // be able to clip it — `title` is what a pointer gets instead (B1).
      title: crew.name,
      // Never the crew id: `tabs_switched` carries catalogue facts, and a crew
      // id in a third-party store is a membership graph (review S3).
      analyticsId: `crew-${index + 1}`,
    })),
  ];

  const inDropdown = place === 'dropdown';
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
        {/*
          **Offered only when it would do something** (review N2, N3).

          It was drawn and enabled on an empty feed and on a bell already at
          zero, where pressing it wrote a bookmark that was already past
          everything and fired `whats_new_read` carrying the same number the
          `whats_new_opened` before it carried — an event that measured nothing
          the first one did not. Now the count it reports is the count the panel
          *opened* with, and it only fires when that count was above zero, so
          "how many did a rider clear by hand" is a question the catalogue can
          answer. At zero it reads "All read" and is disabled, which is also
          what it says the moment it has been pressed.
        */}
        <button
          type="button"
          className={styles.markRead}
          disabled={read || openedWith === 0}
          onClick={() => {
            setRead(true);
            capture(ANALYTICS_EVENTS.whatsNewRead, { unread: openedWith });
            void stampAndRefresh();
          }}
        >
          {read || openedWith === 0 ? 'All read' : 'Mark all read'}
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

          **And it is the tab row's `tabpanel`** (integration review, F8). The
          row declared `role="tab"` over a panel with no role at all, so a
          screen reader was told "You, tab, 1 of 3" and then about nothing —
          which is what a tab is *for*. It is `aria-labelledby` the tab rather
          than carrying a copy of its words, which is ARIA's own pattern and a
          name that cannot drift from the crew's. The role is only claimed where
          the row is actually drawn: a rider in one crew gets no row (§3.6), and
          a lone `tabpanel` is a promise about a control that is not there.
        */}
        <div
          key={tab}
          className={TAB_PANEL}
          {...(tabs.length > 1
            ? { role: 'tabpanel', 'aria-labelledby': tabElementId(place, tab) }
            : {})}
        >
          {crew ? (
            <CrewFeed crew={crew} items={crewItems ?? []} inDropdown={inDropdown} />
          ) : (
            <YouFeed lines={lines} inDropdown={inDropdown} />
          )}
          {more && (
            // Carrying the tab, so a rider reading a crew in the dropdown lands
            // on that crew rather than back on You (review N4).
            <Link href={allHref(crew?.id)} className={styles.all}>
              All →
            </Link>
          )}
        </div>
      </Panel>
    </>
  );
}

function YouFeed({
  lines,
  inDropdown,
}: {
  lines: readonly WhatsNewLineView[];
  inDropdown: boolean;
}) {
  if (lines.length === 0) return <p className={styles.empty}>{NOTHING_YET}</p>;

  return (
    <FeedList className={inDropdown ? styles.dropdownFeed : undefined}>
      {lines.map((line) => {
        const look = LINE_LOOK[line.kind];
        return (
          <FeedLine
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
                <span className={`lab ${FEED_META}`}>{line.source}</span>
                {line.when && <span className={`lab ${FEED_META}`}>{line.when}</span>}
              </>
            }
          >
            {line.line}
          </FeedLine>
        );
      })}
    </FeedList>
  );
}

function CrewFeed({
  crew,
  items,
  inDropdown,
}: {
  crew: { name: string; problem: string | null };
  items: readonly WhatsNewCrewItemView[];
  inDropdown: boolean;
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
    <FeedList className={inDropdown ? styles.dropdownFeed : undefined}>
      {items.map((item) => (
        <FeedLine
          key={item.id}
          disc={<Avatar avatarId={item.avatarKey} name={item.name} size={32} />}
          meta={
            <>
              <span className={`lab ${FEED_META}`}>{item.when}</span>
              {item.sport ? <SportChip sport={item.sport} small /> : null}
              {item.hue ? <Tag color={item.hue}>Sticker</Tag> : null}
            </>
          }
        >
          <Link href={riderHref(item.handle)} className={FEED_WHO}>
            {item.name}
          </Link>{' '}
          {item.line}
        </FeedLine>
      ))}
    </FeedList>
  );
}
