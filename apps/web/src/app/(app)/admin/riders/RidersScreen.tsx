'use client';

import { Avatar, Icon, Panel, Pill, SportChip, Tag } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { Pager, useTableNav } from '../Pager';
import { setRiderPlanAction } from '../actions';
import type { AdminPlanOption, AdminRiderRow, AdminRiderStatus } from '../view';

import { RiderSheet } from './RiderSheet';

import styles from '../admin.module.css';

/**
 * The riders table.
 *
 * The search box writes to the URL rather than to component state, debounced,
 * so the server does the filtering (see `page.tsx`). `useTransition` is what
 * keeps that from feeling like a page load: the old rows stay on screen and go
 * translucent while the new ones are fetched, instead of the table blanking on
 * every keystroke.
 */

/**
 * The Account column's four tags.
 *
 * `guardian` and `withdrawn` are the two halves of the consent gate and they
 * are deliberately different words rather than one tag with two colours: both
 * accounts are equally shut out of crews, events and a subscription, but only
 * one of them is waiting for anybody. "Guardian" reads as an open question,
 * which is what a `pending` account is; a `revoked` one has had its answer.
 *
 * Orange rather than red for `withdrawn`, because red is `suspended` and the
 * two must not be confused at a glance — suspension is something staff did,
 * revocation is something a parent did, and only one of them is staff's to
 * undo. Both are within the 150px Account track (`admin.module.css`), which is
 * sized for SUSPENDED — the longest of the four.
 */
const STATUS_LOOK: Readonly<Record<AdminRiderStatus, { label: string; color: string }>> = {
  ok: { label: 'ok', color: 'var(--green)' },
  pending: { label: 'guardian', color: 'var(--yellow)' },
  revoked: { label: 'withdrawn', color: 'var(--orange)' },
  suspended: { label: 'suspended', color: 'var(--red)' },
};

export function RidersScreen({
  rows,
  plans,
  query,
  plan,
  page,
  totalPages,
  totalItems,
}: {
  rows: readonly AdminRiderRow[];
  plans: readonly AdminPlanOption[];
  query: string;
  plan: string;
  page: number;
  totalPages: number;
  totalItems: number;
}) {
  const router = useRouter();
  const { pending: navigating, params, setFilter, goToPage } = useTableNav();
  // Two transitions: one for re-fetching the table, one for a plan change. A
  // slow save should not disable the pager, and a slow page should not disable
  // the plan selects — but both dim the same rows, so the screen reads `pending`.
  const [saving, startTransition] = useTransition();
  const pending = navigating || saving;
  const { toast } = useToast();

  const [text, setText] = useState(query);
  const [openRider, setOpenRider] = useState<AdminRiderRow | null>(null);

  // The box is re-synced only when the *server's* idea of the query changes
  // under it — a back button, a shared link — never on every render, which
  // would fight the person typing.
  //
  // Adjusted during render rather than in an effect. React re-runs this
  // component before touching the DOM, so there is no flash of the stale value
  // and no second commit; an effect here would be a cascading render, which is
  // what `react-hooks/set-state-in-effect` is pointing at.
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setText(query);
  }

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (debounce.current ? clearTimeout(debounce.current) : undefined), []);

  const onSearch = (value: string) => {
    setText(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const next = params();
      if (value.trim()) next.set('q', value.trim());
      else next.delete('q');
      // `setFilter` returns to page one: staying on page 4 of a filter that now
      // matches six riders shows an empty table.
      setFilter(next);
    }, 300);
  };

  const onPlanFilter = (slug: string) => {
    const next = params();
    if (slug === 'all') next.delete('plan');
    else next.set('plan', slug);
    setFilter(next);
  };

  const onPlanChange = (rider: AdminRiderRow, slug: string) => {
    startTransition(async () => {
      const result = await setRiderPlanAction(rider.id, slug as never);
      if (result.ok) {
        const name = plans.find((p) => p.slug === slug);
        toast(`${rider.name.split(' ')[0]} moved to ${name?.name ?? slug}`, name?.hue);
      } else {
        toast(result.message, 'var(--red)');
      }
      // Whatever happened, the row is redrawn from the server rather than from
      // an optimistic guess: a refused change that left the select showing the
      // new plan would read as success.
      router.refresh();
    });
  };

  const planName = (slug: string) => plans.find((p) => p.slug === slug)?.name ?? slug;

  return (
    <div className={styles.stack}>
      <div className={styles.filters}>
        <div className="search" style={{ flex: 1, minWidth: 220, padding: '9px 12px' }}>
          <Icon name="search" size={17} strokeWidth={2.6} />
          <input
            value={text}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Name, handle or email…"
            aria-label="Search riders by name, handle or email"
          />
        </div>
        <Pill on={plan === 'all'} onClick={() => onPlanFilter('all')}>
          All
        </Pill>
        {plans.map((p) => (
          <Pill key={p.slug} on={plan === p.slug} onClick={() => onPlanFilter(p.slug)}>
            {p.name}
          </Pill>
        ))}
      </div>

      {/* `styles.table` is the same `padding: 0; overflow: hidden` this panel
          used to carry inline, moved to the class every other admin table uses.
          The `data-label`s below are the column names a phone prints in each
          cell, where this header row is hidden and every rider is a card
          (issue #371; "Tables on a phone" in `admin.module.css`). */}
      <Panel className={`${styles.table} ${pending ? styles.busy : ''}`}>
        <div
          className={`arow ${styles.riderRow} ${styles.cardHead}`}
          style={{ background: 'var(--paper-2)', borderBottom: '2px solid var(--wash)' }}
        >
          <span className="lab">Rider</span>
          <span className="lab">Rides</span>
          <span className="lab">Landed</span>
          <span className="lab">Age band</span>
          <span className="lab">Joined</span>
          <span className="lab">Last seen</span>
          <span className="lab">Plan override</span>
          <span className="lab">Account</span>
        </div>

        {rows.map((rider) => (
          <div
            key={rider.id}
            className={`arow ${styles.riderRow} ${styles.cardRow}`}
            style={{ borderBottom: '2px solid var(--wash)' }}
          >
            <div className={styles.riderCell}>
              <Avatar avatarId={rider.avatarKey} name={rider.name} size={32} />
              <div style={{ minWidth: 0 }}>
                <div className="cond" style={{ fontSize: 15 }}>
                  {rider.name}
                  {rider.isMe && ' (you)'}
                </div>
                <div className={styles.handle}>@{rider.handle}</div>
              </div>
            </div>

            <div className={styles.sportCell} data-label="Rides">
              {rider.sports.map((sport) => (
                <SportChip key={sport.label} sport={sport} small />
              ))}
            </div>

            <span className="d" style={{ fontSize: 19 }} data-label="Landed">
              {rider.landed}
            </span>

            {/* A band, never an age — there is no birth date to show. The
                account column's GUARDIAN tag is the consequence of this cell,
                which is why it sits on the same row rather than on the sheet. */}
            <span className="cond" style={{ fontSize: 13.5 }} data-label="Age band">
              {rider.ageBand}
            </span>

            <span className={styles.muted} data-label="Joined">
              {rider.joined}
            </span>

            {/* When the rider last used the app (`users.last_seen`), which is
                not the same question as when they last logged a ride — the
                sheet carries that one. See `../view.ts`. */}
            <span
              className="cond"
              style={{ fontSize: 13.5, color: rider.seenToday ? 'var(--green)' : 'var(--ink-2)' }}
              data-label="Last seen"
            >
              {rider.seen}
            </span>

            {/* Wrapped so the cell can carry its label on a phone; see
                `.controlCell`. */}
            <div className={styles.controlCell} data-label="Plan override">
              <select
                value={rider.plan}
                disabled={rider.isMe || pending}
                aria-label={`Plan for ${rider.name}`}
                onChange={(e) => onPlanChange(rider, e.target.value)}
                className={styles.planSelect}
              >
                {plans.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
                {/* A rider on a plan no longer live still shows what they are on,
                    rather than silently displaying the first option instead. */}
                {!plans.some((p) => p.slug === rider.plan) && (
                  <option value={rider.plan}>{planName(rider.plan)}</option>
                )}
              </select>
            </div>

            <div className={styles.accountCell} data-label="Account">
              <Tag
                color={STATUS_LOOK[rider.status].color}
                style={{
                  fontSize: 10,
                }}
              >
                {STATUS_LOOK[rider.status].label}
              </Tag>
              <button
                type="button"
                className="btn sm ghost"
                style={{ fontSize: 11, padding: '4px 9px' }}
                onClick={() => setOpenRider(rider)}
              >
                Open
              </button>
            </div>
          </div>
        ))}

        {!rows.length && (
          <div className={styles.noRows}>
            {query || plan !== 'all'
              ? 'No riders match that.'
              : 'No riders yet. The first sign-up appears here.'}
          </div>
        )}
      </Panel>

      <Pager
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        noun="rider"
        nounPlural="riders"
        onPage={goToPage}
        busy={pending}
      />

      <p className={styles.footnote}>
        A plan override takes effect on the rider&rsquo;s next request and skips billing entirely —
        nobody is charged and nobody is refunded. Your own row cannot be changed from here.
      </p>

      {openRider && (
        <RiderSheet
          rider={openRider}
          plans={plans}
          onClose={() => setOpenRider(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}
