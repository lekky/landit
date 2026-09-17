'use client';

import { CREW_NAME_MAX_LENGTH, MAX_OWNED_CREWS } from '@landit/core';
import { Avatar, Button, Empty, Icon, Panel, SportChip, Tag } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState, useState, useTransition } from 'react';

import { FEED_META, FEED_WHO, FeedLine, FeedList } from '@/components/feed/FeedLine';
import { TAB_PANEL, TabRow } from '@/components/shell/TabRow';
import { useTabParam } from '@/components/shell/useTabParam';
import { ROUTES, riderHref } from '@/lib/routes';
import { runActionOr } from '@/lib/runAction';

import {
  createCrewAction,
  joinCrewAction,
  leaveCrewAction,
  mintInviteAction,
  type CrewFormState,
} from './actions';
import { InviteCard } from './InviteCard';
import type { BoardRowView, CrewView, FeedItemView } from './view';

import { ANALYTICS_EVENTS, capture, useFailureCapture } from '@/lib/analyticsClient';

import styles from './crew.module.css';

/**
 * The crew screen as a rider sees it (screenshot 15).
 *
 * A client component because the invite share card draws itself in a canvas and
 * the two forms want their pending states. Everything it shows was computed on
 * the server (`view.ts`), so nothing here fetches and nothing here decides who
 * may see what.
 */
/**
 * Board · Activity · Members (rethink §3.10, T52).
 *
 * The ids are the catalogue ones `tabs_switched` carries as `tab`, under the
 * group `crew`, and they are what `?tab=` spells.
 */
const CREW_TABS = ['board', 'activity', 'members'] as const;
type CrewTab = (typeof CREW_TABS)[number];

export function CrewScreen({ view }: { view: CrewView }) {
  const [inviting, setInviting] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [minting, startMinting] = useTransition();
  /**
   * Which of the two ways into another crew is open, if either.
   *
   * §3.10 asks for "Start another" and "Join with a code" as two small ghost
   * buttons that reveal the existing forms, in place of the one `<details>` that
   * used to open both at once. One at a time: they are alternatives — you are
   * either starting a crew or redeeming somebody's code — and a phone that
   * opened both put two forms and four controls under a rider who wanted one.
   */
  const [opening, setOpening] = useState<'start' | 'join' | null>(null);

  const crew = view.selected;

  /*
   * The tab is in `?tab=`, the Progress pattern (§3.10, `useTabParam`).
   *
   * A rider opens a mate from the board, reads their profile and presses Back —
   * and with the tab in `useState` they would land on Board however they left.
   * It rides beside `?crew=`, which the hook carries through untouched, so a
   * rider in two crews keeps both answers in one address.
   */
  const [tab, setTab] = useTabParam(CREW_TABS, 'board');
  const active = tab as CrewTab;

  const openInvite = () => {
    if (!crew) return;
    setInviteError(null);
    startMinting(async () => {
      // Reports its failure as `{ error }`, and a thrown one used to leave the
      // invite modal simply never opening with nothing said.
      const result = await runActionOr(
        'crew_invite',
        () => mintInviteAction(crew.id),
        (error) => ({ error }),
      );
      if (result.code) {
        // That an invite was made. Never the code — it is a capability, and
        // crews are invite-only with no discovery (plan §6.1).
        capture(ANALYTICS_EVENTS.inviteMinted);
        setInviteCode(result.code);
        setInviting(true);
      } else {
        setInviteError(result.error ?? 'We could not make an invite just now.');
      }
    });
  };

  if (view.consentLimited) {
    return (
      <div>
        <span className="eyebrow">Crew</span>
        <h1 className={`d ${styles.head}`}>Ride with mates</h1>
        <Panel flat className={styles.gate}>
          <div className="lab">Waiting on a grown-up</div>
          <p className={styles.gateBody}>
            Crews open up as soon as your parent or guardian says yes. Everything else — the
            library, your tricks, your streak — works exactly as it does now.
          </p>
          <Link className={styles.gateLink} href={ROUTES.account}>
            Ask them again from your account →
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <span className="eyebrow">
            {crew ? `${crew.name} · ${riderCount(crew.memberCount)}` : 'Crew'}
          </span>
          <h1 className={`d ${styles.head}`}>{crew ? crew.name : 'Ride with mates'}</h1>
        </div>
        <div className={styles.headerActions}>
          {view.handle ? (
            <Link className="btn sm ghost" href={riderHref(view.handle)}>
              Your public profile
            </Link>
          ) : null}
          {crew ? (
            <Button size="sm" onClick={openInvite} disabled={minting}>
              {minting ? 'One moment…' : 'Invite a mate'}
            </Button>
          ) : null}
        </div>
      </div>

      {view.crews.length > 1 ? (
        <div className={styles.switcher}>
          <span className="lab">Your crews</span>
          {view.crews.map((c) => (
            // A link wearing the pill's clothes, not a button inside an anchor:
            // the design system styles `.pill` by class, and the module class
            // outranks the token sheet's `a:hover` (LESSONS §3a).
            <Link
              key={c.id}
              href={`${ROUTES.crew}?crew=${c.id}`}
              className={`pill ${c.id === crew?.id ? 'on' : ''} ${styles.switcherLink}`}
              aria-current={c.id === crew?.id ? 'page' : undefined}
            >
              {c.name}
            </Link>
          ))}
        </div>
      ) : null}

      {inviteError ? <p className={styles.error}>{inviteError}</p> : null}

      {crew ? (
        <>
          {crew.problem ? (
            <Panel flat className={styles.gate}>
              <p className={styles.gateBody}>{crew.problem}</p>
            </Panel>
          ) : (
            <>
              {/*
                Board · Activity · Members (§3.10, D6).

                The board and the feed used to sit side by side in a
                `1fr / 340px` grid that stacked on a phone, which made the
                activity the second half of a long scroll and gave the crew's
                membership nowhere of its own. Three tabs at **every width**:
                §3.3 lists this row among `TabRow`'s users without a width on
                it, §3.10 names all three tabs, and a row that existed only
                below 860px would leave Members homeless on a desktop and give
                the screen two shapes to learn. Recorded in
                `docs/app-shell-rethink.md` §3.10 against §7's older
                "board left, activity right".

                Nothing new is exposed by the third tab. Every field on a
                Members row — the name, the handle, the avatar, the sports, who
                started the crew — is already on the board above it, from the
                same `crew-board` route (plan §3 guarantee 1). There is no
                search, no directory and nothing to press but a rider's own
                profile, which the board already links.
              */}
              <TabRow
                items={[
                  { id: 'board', label: 'Board' },
                  { id: 'activity', label: 'Activity' },
                  /*
                    No count on this tab (review nit 10). `TabRowItem`'s `note`
                    exists to give a reason to press a tab — "Not yet 118" is a
                    wall worth opening where "Not yet" is a word — and here the
                    reason is already answered ten pixels above it: the header
                    reads "RAMP RATS · 3 RIDERS". One number, once.
                  */
                  { id: 'members', label: 'Members' },
                ]}
                value={active}
                group="crew"
                label="What to show for this crew"
                onChange={setTab}
              />

              <div
                key={active}
                role="tabpanel"
                aria-label={TAB_LABEL[active]}
                className={TAB_PANEL}
              >
                {active === 'board' ? <Board rows={crew.board} onInvite={openInvite} /> : null}
                {active === 'activity' ? <Feed items={crew.feed} /> : null}
                {active === 'members' ? <Members rows={crew.board} /> : null}
              </div>
            </>
          )}

          <div className={styles.footRow}>
            <p className={styles.footNote}>
              {crew.isOwner
                ? 'You started this crew. Invites you send last two weeks.'
                : 'Invite-only — nobody can find this crew or ask to join it.'}
            </p>
            {crew.membershipId ? (
              <form action={leaveCrewAction} onSubmit={() => capture(ANALYTICS_EVENTS.crewLeft)}>
                <input type="hidden" name="membership" value={crew.membershipId} />
                <Button type="submit" variant="ghost" size="sm">
                  Leave crew
                </Button>
              </form>
            ) : null}
          </div>
        </>
      ) : (
        <NoCrew />
      )}

      {/*
        Counted on crews *owned*, not crews belonged to: the server's ceiling is
        on ownership (minting invites is what it limits), and a rider may sit on
        more boards than they run. Joining with a code is never capped.
      */}
      {crew && view.crews.filter((c) => c.isOwner).length < MAX_OWNED_CREWS ? (
        <div className={styles.more}>
          <div className={styles.moreButtons}>
            <Button
              size="sm"
              variant="ghost"
              className={styles.moreButton}
              aria-expanded={opening === 'start'}
              onClick={() => setOpening((was) => (was === 'start' ? null : 'start'))}
            >
              Start another
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={styles.moreButton}
              aria-expanded={opening === 'join'}
              onClick={() => setOpening((was) => (was === 'join' ? null : 'join'))}
            >
              Join with a code
            </Button>
          </div>
          {opening ? <NoCrew compact only={opening} /> : null}
        </div>
      ) : null}

      {inviting && crew && inviteCode ? (
        <InviteCard
          code={inviteCode}
          crewName={crew.name}
          firstName={view.firstName}
          sportsLine={view.sportsLine}
          onClose={() => setInviting(false)}
        />
      ) : null}
    </div>
  );
}

function riderCount(n: number): string {
  return `${n} ${n === 1 ? 'rider' : 'riders'}`;
}

/** What a screen reader is told the panel under the row is. */
const TAB_LABEL: Readonly<Record<CrewTab, string>> = {
  board: 'This month’s board',
  activity: 'Just happened',
  members: 'Members',
};

/* ----------------------------------------------------------------- board -- */

function Board({
  rows,
  onInvite,
}: {
  rows: readonly BoardRowView[];
  /** The screen's invite flow — the empty board's one action. */
  onInvite: () => void;
}) {
  return (
    <Panel className={styles.panel}>
      <div className={styles.panelHead}>
        <span className="lab">This month&rsquo;s board</span>
      </div>
      {rows.length === 0 ? (
        <div className={styles.panelEmpty}>
          <p style={{ margin: '0 0 12px' }}>
            Nobody on the board yet. It fills up as your crew lands things this month.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              capture(ANALYTICS_EVENTS.emptyStateAction, { screen: 'crew', action: 'invite' });
              onInvite();
            }}
          >
            Invite a mate
          </Button>
        </div>
      ) : (
        rows.map((row, i) => (
          <Link
            key={row.id}
            href={riderHref(row.handle)}
            className={`${styles.row} ${row.isMe ? styles.rowMe : ''}`}
          >
            <span
              className={`d ${styles.rank}`}
              style={{ color: i === 0 ? 'var(--orange)' : 'var(--ink-3)' }}
            >
              {i + 1}
            </span>
            <Avatar avatarId={row.avatarKey} name={row.name} size={38} />
            <span className={styles.rowWho}>
              <span className={`cond ${styles.rowName}`}>
                {row.name}
                {row.isMe ? ' (you)' : ''}
                {row.flair ? (
                  <Tag color="var(--violet)" className={styles.flair}>
                    Legend
                  </Tag>
                ) : null}
              </span>
              <span className={styles.rowSports}>
                {row.sports.map((sport) => (
                  <SportChip key={sport.label} sport={sport} small />
                ))}
              </span>
            </span>
            <span className={styles.rowStats}>
              {/*
                Sessions this month, where the weekly streak used to be
                (Rachid, 2026-09-13, in chat). The streak is a number a rider
                cannot see the working of; turning up is a thing they did, and
                it resets with the board's own month. "This month's board"
                above is what makes the window readable — the label says
                `sessions`, and the heading says when.
              */}
              <span className={styles.stat}>
                <span className="d">{row.sessions}</span>
                <span className="lab">sessions</span>
              </span>
              <span className={styles.stat}>
                <span className="d">{row.landed}</span>
                <span className="lab">landed</span>
              </span>
              <Icon name="back" size={16} strokeWidth={2.4} className={styles.chevron} />
            </span>
          </Link>
        ))
      )}
    </Panel>
  );
}

/* --------------------------------------------------------------- members -- */

/**
 * Who is in the crew — the board's own rows, without the ranking.
 *
 * **It reads nothing the board did not already read.** These are
 * `SelectedCrewView.board`, from `GET /api/landit/crew-board/{crew}`, which is
 * the one route allowed to name a rider whose profile is private (plan §3
 * guarantee 1: by name and score, to a crew-mate). So the third tab is the
 * second view of a payload the first tab already had, and there is no second
 * request, no `users` read and nothing on screen that was not one tap away.
 *
 * What it drops is the two scores and the rank, because a roster is a list of
 * who is here rather than a second league table — and what it adds is the one
 * fact the board has never shown, which of them started the crew.
 */
function Members({ rows }: { rows: readonly BoardRowView[] }) {
  return (
    <Panel className={styles.panel}>
      <div className={styles.panelHead}>
        <span className="lab">Who is in it</span>
      </div>
      {rows.length === 0 ? (
        <p className={styles.panelEmpty}>
          Nobody here yet. Invites are the only way in — there is no list of crews to browse and
          nobody can ask to join.
        </p>
      ) : (
        rows.map((row) => (
          <Link
            key={row.id}
            href={riderHref(row.handle)}
            className={`${styles.row} ${row.isMe ? styles.rowMe : ''}`}
          >
            <Avatar avatarId={row.avatarKey} name={row.name} size={38} />
            <span className={styles.rowWho}>
              <span className={`cond ${styles.rowName}`}>
                {row.name}
                {row.isMe ? ' (you)' : ''}
                {row.isOwner ? (
                  <Tag color="var(--sky)" className={styles.flair}>
                    Started it
                  </Tag>
                ) : null}
              </span>
              <span className={styles.rowSports}>
                {row.sports.map((sport) => (
                  <SportChip key={sport.label} sport={sport} small />
                ))}
              </span>
            </span>
            <span className={styles.rowStats}>
              <Icon name="back" size={16} strokeWidth={2.4} className={styles.chevron} />
            </span>
          </Link>
        ))
      )}
      <p className={styles.membersNote}>
        A rider whose profile is private still holds their place here. Opening one shows you
        whatever they have chosen to show.
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ feed -- */

function Feed({ items }: { items: readonly FeedItemView[] }) {
  return (
    <Panel className={styles.panel}>
      <div className={styles.panelHead}>
        <span className="lab">Just happened</span>
      </div>
      {items.length === 0 ? (
        <p className={styles.panelEmpty}>
          Nothing yet. Riders whose profile is private never show up here — they still hold their
          place on the board.
        </p>
      ) : (
        /*
          The row is `FeedLine` in `components/feed/` since T47, where What's
          new's crew tab draws the same one. Same markup, same styles, moved
          rather than copied — a change to this row is now a change in one file
          (T47 review S5).
        */
        <FeedList>
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
      )}
    </Panel>
  );
}

/* ------------------------------------------------------- start, or join -- */

/**
 * The only two ways into a crew: start one, or redeem a code.
 *
 * There is deliberately no third control here. Plan §6.1 — crews are
 * invite-only with no discovery — is a fact about what this component does not
 * render as much as about what the server refuses.
 */
function NoCrew({
  compact = false,
  only,
}: {
  compact?: boolean;
  /**
   * Draw one of the two panels rather than both (T52).
   *
   * The empty state still offers both, because a rider with no crew has two
   * ways in and no reason to prefer either. A rider who already has one asked
   * for one of them by name, and gets that one.
   */
  only?: 'start' | 'join';
}) {
  const [createState, create, creating] = useActionState<CrewFormState | undefined, FormData>(
    createCrewAction,
    undefined,
  );
  const [joinState, joinCrew, joining] = useActionState<CrewFormState | undefined, FormData>(
    joinCrewAction,
    undefined,
  );

  useFailureCapture(ANALYTICS_EVENTS.crewCreated, createState?.error);
  useFailureCapture(ANALYTICS_EVENTS.crewJoined, joinState?.error, { from: 'crew' });

  return (
    <div className={compact ? styles.startCompact : styles.start}>
      {!compact ? (
        <Empty
          icon="users"
          title={<>You&rsquo;re riding solo</>}
          sub="Crews are invite-only — there is no list to browse and nobody can find you. Start one and send the code to a mate, or paste a code somebody sent you."
        />
      ) : null}

      <div className={styles.startForms}>
        {only === 'join' ? null : (
          <Panel flat className={styles.startPanel}>
            <div className="lab">Start a crew</div>
            <form
              action={create}
              className={styles.startForm}
              onSubmit={() => capture(ANALYTICS_EVENTS.crewCreated, { outcome: 'attempted' })}
            >
              <div className="field">
                <label htmlFor="crew-name">What is it called?</label>
                <input
                  id="crew-name"
                  name="name"
                  maxLength={CREW_NAME_MAX_LENGTH}
                  placeholder="Ramp Rats"
                  autoComplete="off"
                />
              </div>
              {createState?.error ? <p className={styles.error}>{createState.error}</p> : null}
              <Button type="submit" disabled={creating} size="sm">
                {creating ? 'Starting…' : 'Start it'}
              </Button>
            </form>
          </Panel>
        )}

        {only === 'start' ? null : (
          <Panel flat className={styles.startPanel}>
            <div className="lab">Join with a code</div>
            <form
              action={joinCrew}
              className={styles.startForm}
              onSubmit={() =>
                capture(ANALYTICS_EVENTS.crewJoined, { outcome: 'attempted', from: 'crew' })
              }
            >
              <div className="field">
                <label htmlFor="crew-code">The code a mate sent you</label>
                <input
                  id="crew-code"
                  name="code"
                  placeholder="ABCDE-FGHJK"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              {joinState?.error ? <p className={styles.error}>{joinState.error}</p> : null}
              <Button type="submit" disabled={joining} size="sm" variant="ghost">
                {joining ? 'Checking…' : 'Join'}
              </Button>
            </form>
          </Panel>
        )}
      </div>
    </div>
  );
}
