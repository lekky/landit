'use client';

import { Avatar, Modal, SportChip, Tag } from '@landit/ui-web';
import { useEffect, useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import {
  deleteRiderAction,
  riderSheetAction,
  setRiderPlanAction,
  setRiderSuspendedAction,
} from '../actions';
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

  /**
   * Deleting is two deliberate steps, and the second one is typing.
   *
   * `armed` opens the confirmation; nothing is sent until the handle matches.
   * The comparison is repeated on the server — this one only decides whether
   * the button is enabled, so the rider cannot be deleted by a stray Enter on
   * an empty field.
   */
  const [armed, setArmed] = useState(false);
  const [typed, setTyped] = useState('');
  const handleMatches = typed.trim().toLowerCase() === rider.handle.toLowerCase();

  const onDelete = () => {
    if (!handleMatches) return;
    startTransition(async () => {
      const result = await deleteRiderAction(rider.id, typed);
      if (result.ok) {
        toast(`@${rider.handle} deleted`, 'var(--red)');
        onChanged();
        // The sheet is a view of a row that no longer exists, so it closes
        // rather than sitting there offering actions against a gone account.
        onClose();
      } else {
        toast(result.message, 'var(--red)');
      }
    });
  };

  /**
   * Is this account held behind the consent gate right now?
   *
   * Read off the row's tag rather than re-deriving it, so the block below and
   * the tag in the table can never disagree about the same rider.
   */
  const gated = rider.status === 'pending' || rider.status === 'revoked';

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
          <div className="lab" style={{ color: 'var(--ink-soft)', marginTop: 5 }}>
            @{rider.handle} · joined {view?.joined ?? rider.joined} · seen{' '}
            {(view?.seen ?? rider.seen).toLowerCase()}
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
        {/*
          The ride figure the table used to show under "Last active". It is a
          real thing to know — a rider who is here every day and has not logged
          a ride in a month is a different rider from one who logs every
          session — but it is not what "last seen" means, and the header said
          the wrong one for both. Kept here where there is room to name both.
        */}
        <div className={styles.sheetFact}>
          <span className="lab" style={{ color: 'var(--ink-3)' }}>
            Last ride
          </span>
          <span className={styles.sheetFactValue}>{view?.lastRide ?? '—'}</span>
        </div>
      </div>

      {/*
        The guardian block, shown for an account behind the gate and for any
        account that has ever asked — a rider whose guardian approved months
        ago is `ok` in the table and still has a request worth reading.

        Rendered from `rider.status` rather than waiting for `view`, so a
        gated rider's block is there from the first frame with "Loading…" in
        it rather than appearing a beat later. An em dash would not do here as
        it does above: in the facts block it means "we hold nothing", and here
        "nobody has been asked" and "not fetched yet" are different enough
        answers that a staff member chasing a stuck account must not have them
        spelled the same way. `missing` drops the block entirely rather than
        adding a third wording: the account is gone, so there is no request to
        report and "Loading…" would never resolve.
      */}
      {!missing && (gated || view?.guardian) && (
        <div className={styles.sheetGuardian}>
          <div className="lab" style={{ color: 'var(--ink-3)' }}>
            Latest guardian request
          </div>
          {!view ? (
            <p className={styles.quiet}>Loading…</p>
          ) : !view.guardian ? (
            <p className={styles.quiet}>
              Nobody has been asked yet. This rider has not sent a guardian email.
            </p>
          ) : (
            <>
              <div className={styles.sheetGuardianHead}>
                <span className={styles.sheetFactValue}>{view.guardian.email}</span>
                <Tag color={view.guardian.standingColor} style={{ fontSize: 10 }}>
                  {view.guardian.standing}
                </Tag>
              </div>
              <div className="lab" style={{ color: 'var(--ink-3)' }}>
                Asked {view.guardian.requested}
                {view.guardian.answered ? ` · answered ${view.guardian.answered}` : ''}
              </div>
            </>
          )}
        </div>
      )}

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

        {view?.canDelete && (
          <div className={styles.dangerZone}>
            {!armed ? (
              <button
                type="button"
                className="btn sm"
                disabled={pending}
                style={{ background: 'var(--red)' }}
                onClick={() => setArmed(true)}
              >
                Delete account permanently
              </button>
            ) : (
              <div className={styles.dangerBox}>
                <p className={styles.quiet}>
                  <strong>This cannot be undone.</strong> Deleting @{rider.handle} removes their
                  progress, videos, crew memberships, subscription record and guardian consent
                  record along with the account. Type <strong>@{rider.handle}</strong> to confirm.
                </p>
                <div className={styles.dangerConfirm}>
                  <input
                    className={styles.dangerInput}
                    value={typed}
                    disabled={pending}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={`Type @${rider.handle} to confirm deletion`}
                    placeholder={`@${rider.handle}`}
                    onChange={(e) => setTyped(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn sm"
                    disabled={pending || !handleMatches}
                    style={{ background: 'var(--red)' }}
                    onClick={onDelete}
                  >
                    {pending ? 'Deleting…' : 'Delete for good'}
                  </button>
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={pending}
                    onClick={() => {
                      setArmed(false);
                      setTyped('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
