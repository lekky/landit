'use client';

import { Avatar, Modal, SportChip, Tag } from '@landit/ui-web';
import { useEffect, useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { riderSheetAction, setRiderPlanAction, setRiderSuspendedAction } from '../actions';
import type { AdminPlanOption, AdminRiderRow, RiderSheetView } from '../view';

import styles from '../admin.module.css';

/**
 * One rider, opened from the table (`landit-admin.jsx`, `AdminRiderSheet`).
 *
 * The sheet's contents are fetched when it opens rather than shipped with the
 * table, because it is a per-rider read and forty of them would be paid for on
 * every page load to render a modal that is usually not opened. Until it
 * arrives the header renders from the row that was clicked — the name, handle
 * and plan are already known — so the modal opens with something in it rather
 * than an empty box.
 */
export function RiderSheet({
  rider,
  plans,
  onClose,
  onChanged,
}: {
  rider: AdminRiderRow;
  plans: readonly AdminPlanOption[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<RiderSheetView | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    riderSheetAction(rider.id)
      .then((result) => {
        if (!live) return;
        if (result) setView(result);
        else setMissing(true);
      })
      .catch(() => {
        if (live) setMissing(true);
      });
    // Guards against the sheet being closed and reopened on another rider
    // before the first read lands, which would paint one rider's tricks under
    // another rider's name.
    return () => {
      live = false;
    };
  }, [rider.id]);

  const plan = view?.plan ?? rider.plan;
  const suspended = view?.suspended ?? rider.status === 'suspended';
  const planLook = plans.find((p) => p.slug === plan);

  const onPlan = (slug: string) => {
    startTransition(async () => {
      const result = await setRiderPlanAction(rider.id, slug as never);
      if (result.ok) {
        const next = plans.find((p) => p.slug === slug);
        toast(`${rider.name.split(' ')[0]} moved to ${next?.name ?? slug}`, next?.hue);
        setView((v) => (v ? { ...v, plan: slug, planName: next?.name ?? slug } : v));
        onChanged();
      } else {
        toast(result.message, 'var(--red)');
      }
    });
  };

  const onSuspend = () => {
    const next = !suspended;
    startTransition(async () => {
      const result = await setRiderSuspendedAction(rider.id, next);
      if (result.ok) {
        toast(
          `${rider.name.split(' ')[0]} ${next ? 'suspended' : 'restored'}`,
          next ? 'var(--red)' : 'var(--green)',
        );
        setView((v) => (v ? { ...v, suspended: next } : v));
        onChanged();
      } else {
        toast(result.message, 'var(--red)');
      }
    });
  };

  const stats: readonly (readonly [number, string])[] = [
    [view?.tracked.length ?? 0, 'Tracked'],
    [view?.landed ?? rider.landed, 'Landed'],
    [view?.clips ?? 0, 'Videos'],
    [(view?.sports ?? rider.sports).length, 'Sports'],
  ];

  return (
    <Modal onClose={onClose} width={620} label={`${rider.name}, staff view`}>
      <div className={styles.sheetHead}>
        <Avatar
          avatarId={rider.avatarKey}
          name={rider.name}
          size={54}
          ringWidth={3}
          ring="var(--paper)"
        />
        <div style={{ minWidth: 0 }}>
          <div className="d" style={{ fontSize: 26, color: 'var(--paper)' }}>
            {rider.name}
          </div>
          <div className="lab" style={{ color: '#C9C2B4', marginTop: 5 }}>
            @{rider.handle} · joined {view?.joined ?? rider.joined} · active{' '}
            {(view?.active ?? rider.active).toLowerCase()}
          </div>
        </div>
        <Tag tilt color={planLook?.hue} style={{ marginLeft: 'auto' }}>
          {view?.planName ?? planLook?.name ?? plan}
        </Tag>
      </div>

      <div className={styles.sheetStats}>
        {stats.map(([n, label]) => (
          <div key={label} className={styles.sheetStat}>
            <div className="d" style={{ fontSize: 24 }}>
              {n}
            </div>
            <div className="lab" style={{ color: 'var(--ink-3)', marginTop: 3 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/*
        The two facts the table deliberately does not carry (`../view.ts`).
        Both wait for `view` rather than guessing from the row, because the row
        has never held either — an em dash here means "still loading", which is
        the same thing it means once loaded for an account that has neither.
      */}
      <div className={styles.sheetFacts}>
        <div className={styles.sheetFact}>
          <span className="lab" style={{ color: 'var(--ink-3)' }}>
            Signed up with
          </span>
          <span className={styles.sheetFactValue}>{view?.email || '—'}</span>
        </div>
        <div className={styles.sheetFact}>
          <span className="lab" style={{ color: 'var(--ink-3)' }}>
            Age band
          </span>
          <span className={styles.sheetFactValue}>{view?.ageBand ?? '—'}</span>
        </div>
      </div>

      <div className={styles.sheetBody}>
        <div>
          <div className="lab" style={{ marginBottom: 10 }}>
            What they&rsquo;re tracking
          </div>
          {missing ? (
            <p className={styles.quiet}>
              This rider is no longer there. Close the sheet and the table will catch up.
            </p>
          ) : !view ? (
            <p className={styles.quiet}>Loading…</p>
          ) : view.tracked.length ? (
            <div className={styles.tracked}>
              {view.tracked.map((trick) => (
                <div key={trick.id} className={styles.trackedRow}>
                  {trick.sport && <SportChip sport={trick.sport} small />}
                  <span className="cond" style={{ fontSize: 14.5 }}>
                    {trick.name}
                  </span>
                  <span className={styles.trackedRule} />
                  <Tag color={trick.stageColor} style={{ fontSize: 10 }}>
                    {trick.stage}
                  </Tag>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.quiet}>Nothing tracked yet.</p>
          )}
        </div>

        <div className={styles.sheetActions}>
          <div className="lab">Plan override</div>
          <select
            value={plan}
            disabled={rider.isMe || pending}
            aria-label={`Plan for ${rider.name}`}
            onChange={(e) => onPlan(e.target.value)}
            className={styles.planSelect}
          >
            {plans.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
            {!plans.some((p) => p.slug === plan) && <option value={plan}>{plan}</option>}
          </select>

          {!rider.isMe && (
            <button
              type="button"
              className="btn sm"
              disabled={pending}
              style={{ background: suspended ? 'var(--green)' : 'var(--red)' }}
              onClick={onSuspend}
            >
              {suspended ? 'Restore account' : 'Suspend account'}
            </button>
          )}

          <button
            type="button"
            className="btn sm ghost"
            style={{ marginLeft: 'auto' }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {rider.isMe && (
          <p className={styles.quiet}>
            This is your own account. Ask another member of staff to change your plan or your access
            — the log should never name one person on both sides of a change.
          </p>
        )}
      </div>
    </Modal>
  );
}
