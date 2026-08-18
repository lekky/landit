'use client';

import { Avatar, Icon, Panel, Pill, SportChip, Tag } from '@landit/ui-web';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

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

const STATUS_LOOK: Readonly<Record<AdminRiderStatus, { label: string; color: string }>> = {
  ok: { label: 'ok', color: 'var(--green)' },
  pending: { label: 'guardian', color: 'var(--yellow)' },
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
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

  const push = (next: URLSearchParams) => {
    // Any change to what is being looked at returns to the first page. Staying
    // on page 4 of a filter that now matches six riders shows an empty table.
    next.delete('page');
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`);
    });
  };

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (debounce.current ? clearTimeout(debounce.current) : undefined), []);

  const onSearch = (value: string) => {
    setText(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (value.trim()) next.set('q', value.trim());
      else next.delete('q');
      push(next);
    }, 300);
  };

  const onPlanFilter = (slug: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (slug === 'all') next.delete('plan');
    else next.set('plan', slug);
    push(next);
  };

  const goToPage = (n: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(n));
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`);
    });
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

      <Panel style={{ padding: 0, overflow: 'hidden' }} className={pending ? styles.busy : ''}>
        <div
          className={`arow ${styles.riderRow}`}
          style={{ background: 'var(--paper-2)', borderBottom: '2px solid var(--wash)' }}
        >
          <span className="lab">Rider</span>
          <span className="lab">Rides</span>
          <span className="lab">Landed</span>
          <span className="lab">Age band</span>
          <span className="lab">Joined</span>
          <span className="lab">Last active</span>
          <span className="lab">Plan override</span>
          <span className="lab">Account</span>
        </div>

        {rows.map((rider) => (
          <div
            key={rider.id}
            className={`arow ${styles.riderRow}`}
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

            <div className={styles.sportCell}>
              {rider.sports.map((sport) => (
                <SportChip key={sport.label} sport={sport} small />
              ))}
            </div>

            <span className="d" style={{ fontSize: 19 }}>
              {rider.landed}
            </span>

            {/* A band, never an age — there is no birth date to show. The
                account column's GUARDIAN tag is the consequence of this cell,
                which is why it sits on the same row rather than on the sheet. */}
            <span className="cond" style={{ fontSize: 13.5 }}>
              {rider.ageBand}
            </span>

            <span className={styles.muted}>{rider.joined}</span>

            <span
              className="cond"
              style={{ fontSize: 13.5, color: rider.activeToday ? 'var(--green)' : 'var(--ink-2)' }}
            >
              {rider.active}
            </span>

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

            <div className={styles.accountCell}>
              <Tag
                color={STATUS_LOOK[rider.status].color}
                style={{
                  fontSize: 10,
                  color: rider.status === 'pending' ? 'var(--ink)' : '#fff',
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

      <div className={styles.tableFoot}>
        <span className="cond">
          {totalItems === 1 ? '1 rider' : `${totalItems} riders`}
          {totalPages > 1 && ` · page ${page} of ${totalPages}`}
        </span>
        {totalPages > 1 && (
          <div className={styles.pager}>
            <button
              type="button"
              className="btn sm ghost"
              disabled={page <= 1 || pending}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn sm ghost"
              disabled={page >= totalPages || pending}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>

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
