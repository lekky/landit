'use client';

import { CREW_NAME_MAX_LENGTH, MAX_OWNED_CREWS } from '@landit/core';
import { Avatar, Button, Empty, Icon, Panel, SportChip, Tag } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState, useState, useTransition } from 'react';

import { ROUTES, riderHref } from '@/lib/routes';

import {
  createCrewAction,
  joinCrewAction,
  leaveCrewAction,
  mintInviteAction,
  type CrewFormState,
} from './actions';
import { InviteCard } from './InviteCard';
import type { BoardRowView, CrewView, FeedItemView } from './view';

import styles from './crew.module.css';

/**
 * The crew screen as a rider sees it (screenshot 15).
 *
 * A client component because the invite share card draws itself in a canvas and
 * the two forms want their pending states. Everything it shows was computed on
 * the server (`view.ts`), so nothing here fetches and nothing here decides who
 * may see what.
 */
export function CrewScreen({ view }: { view: CrewView }) {
  const [inviting, setInviting] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [minting, startMinting] = useTransition();

  const crew = view.selected;

  const openInvite = () => {
    if (!crew) return;
    setInviteError(null);
    startMinting(async () => {
      const result = await mintInviteAction(crew.id);
      if (result.code) {
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
            <div className={styles.grid}>
              <Board rows={crew.board} />
              <Feed items={crew.feed} />
            </div>
          )}

          <div className={styles.footRow}>
            <p className={styles.footNote}>
              {crew.isOwner
                ? 'You started this crew. Invites you send last two weeks.'
                : 'Invite-only — nobody can find this crew or ask to join it.'}
            </p>
            {crew.membershipId ? (
              <form action={leaveCrewAction}>
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

      {crew && view.crews.length < MAX_OWNED_CREWS ? (
        <details className={styles.more}>
          <summary className="lab">Start another crew, or join one with a code</summary>
          <NoCrew compact />
        </details>
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

/* ----------------------------------------------------------------- board -- */

function Board({ rows }: { rows: readonly BoardRowView[] }) {
  return (
    <Panel className={styles.panel}>
      <div className={styles.panelHead}>
        <span className="lab">This month&rsquo;s board</span>
      </div>
      {rows.length === 0 ? (
        <p className={styles.panelEmpty}>Nobody on the board yet.</p>
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
              <span className={styles.stat}>
                <span className="d">{row.streak}</span>
                <span className="lab">weeks</span>
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
        <div className={styles.feed}>
          {items.map((item) => (
            <div key={item.id} className={styles.feedItem}>
              <Avatar avatarId={item.avatarKey} name={item.name} size={32} />
              <div className={styles.feedBody}>
                <p className={styles.feedLine}>
                  <Link href={riderHref(item.handle)} className={styles.feedWho}>
                    {item.name}
                  </Link>{' '}
                  {item.line}
                </p>
                <div className={styles.feedMeta}>
                  <span className={`lab ${styles.feedWhen}`}>{item.when}</span>
                  {item.sport ? <SportChip sport={item.sport} small /> : null}
                  {item.hue ? <Tag color={item.hue}>Sticker</Tag> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
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
function NoCrew({ compact = false }: { compact?: boolean }) {
  const [createState, create, creating] = useActionState<CrewFormState | undefined, FormData>(
    createCrewAction,
    undefined,
  );
  const [joinState, joinCrew, joining] = useActionState<CrewFormState | undefined, FormData>(
    joinCrewAction,
    undefined,
  );

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
        <Panel flat className={styles.startPanel}>
          <div className="lab">Start a crew</div>
          <form action={create} className={styles.startForm}>
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

        <Panel flat className={styles.startPanel}>
          <div className="lab">Join with a code</div>
          <form action={joinCrew} className={styles.startForm}>
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
      </div>
    </div>
  );
}
