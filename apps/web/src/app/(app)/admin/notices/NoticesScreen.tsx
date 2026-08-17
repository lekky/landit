'use client';

import { SPORTS, SPORT_IDS } from '@landit/core';
import { Empty, Panel, Tag } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { postNoticeAction, setNoticeLiveAction } from '../content-actions';
import type { AdminNoticeRow, AdminPlanOption } from '../view';

import styles from '../admin.module.css';

/** The design pack's five banner hues. */
const HUES = ['#FFC23F', '#9CE05B', '#3AC0FF', '#FF3D78', '#8A3BE0'] as const;

const BLANK = { title: '', body: '', label: 'Land It', audience: '', hue: HUES[0] as string };

/**
 * The announcements composer (`landit-admin.jsx`, `AdminNotices`).
 *
 * "Pull" is a hide, not a delete, and the reason is different from every other
 * tab's: elsewhere the cascade would take a rider's own record with it, and here
 * the record *is* the point. A banner that went to every rider is a thing the
 * product said, and a portal that can make it never have been said is a portal
 * that can rewrite what riders were told. The row stays, greyed, with the count
 * of how many people dismissed it while it was up.
 */
export function NoticesScreen({
  rows,
  plans,
}: {
  rows: readonly AdminNoticeRow[];
  plans: readonly AdminPlanOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(BLANK);

  const post = () => {
    startTransition(async () => {
      const result = await postNoticeAction(form);
      if (result.ok) {
        toast('Posted to riders', form.hue);
        setForm(BLANK);
      } else {
        toast(result.message, 'var(--red)');
      }
      router.refresh();
    });
  };

  const toggle = (row: AdminNoticeRow) => {
    startTransition(async () => {
      const result = await setNoticeLiveAction(row.id, !row.isLive);
      if (result.ok) toast(row.isLive ? 'Pulled from riders' : 'Back up on Home');
      else toast(result.message, 'var(--red)');
      router.refresh();
    });
  };

  const live = rows.filter((r) => r.isLive);
  const pulled = rows.filter((r) => !r.isLive);

  const card = (row: AdminNoticeRow) => (
    <Panel
      key={row.id}
      flat
      className={`${styles.noticeCard} ${row.isLive ? '' : styles.hiddenRow}`}
      style={{ background: row.hue }}
    >
      <div className={styles.noticeHead}>
        <Tag color="var(--ink)">{row.label}</Tag>
        <span className="lab" style={{ color: 'var(--ink-2)' }}>
          {row.audienceLabel}
        </span>
        <button
          type="button"
          className="btn sm"
          disabled={pending}
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            padding: '4px 9px',
            background: row.isLive ? 'var(--red)' : 'var(--green)',
          }}
          onClick={() => toggle(row)}
        >
          {row.isLive ? 'Pull' : 'Put back up'}
        </button>
      </div>
      <div className="cond" style={{ fontSize: 16 }}>
        {row.title}
      </div>
      {row.body && <p className={styles.noticeBody}>{row.body}</p>}
      <div className="lab" style={{ color: 'var(--ink-2)', marginTop: 8 }}>
        Posted {row.posted} · {row.dismissals} dismissed
      </div>
    </Panel>
  );

  return (
    <div className={styles.stack}>
      <div className={styles.split}>
        <Panel className={styles.composer}>
          <div>
            <div className="lab" style={{ marginBottom: 4 }}>
              New announcement
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2)' }}>
              Shows as a banner at the top of Home until each rider dismisses it.
            </p>
          </div>

          <div className="field">
            <label htmlFor="notice-title">Title</label>
            <input
              id="notice-title"
              value={form.title}
              placeholder="Skate library just landed"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="notice-body">Body</label>
            <textarea
              id="notice-body"
              rows={3}
              value={form.body}
              placeholder="Thirty one skateboard tricks, tracked the same way."
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="notice-label">Label</label>
              <input
                id="notice-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="notice-audience">Who sees it</label>
              <select
                id="notice-audience"
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              >
                <option value="">Everyone</option>
                {SPORT_IDS.map((id) => (
                  <option key={id} value={id}>
                    {SPORTS[id].label} riders
                  </option>
                ))}
                {plans.map((plan) => (
                  <option key={plan.slug} value={`plan:${plan.slug}`}>
                    {plan.name} riders
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="notice-hue">Colour</label>
            <div className={styles.editorChoices} id="notice-hue">
              {HUES.map((hue) => (
                <button
                  key={hue}
                  type="button"
                  aria-label={`Banner colour ${hue}`}
                  aria-pressed={form.hue === hue}
                  className={styles.swatch}
                  style={{ background: hue, borderWidth: form.hue === hue ? 4 : 2.5 }}
                  onClick={() => setForm({ ...form, hue })}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn wide"
            disabled={pending || !form.title.trim()}
            onClick={post}
          >
            Post to riders
          </button>
        </Panel>

        <div className={styles.column}>
          <div className="lab">Live now</div>
          {live.length ? (
            live.map(card)
          ) : (
            <Empty
              icon="bolt"
              title="Nothing posted"
              sub="Announcements you post show up here and on every rider's dashboard."
            />
          )}

          {pulled.length > 0 && (
            <>
              <div className="lab" style={{ marginTop: 8 }}>
                Pulled
              </div>
              {pulled.map(card)}
            </>
          )}
        </div>
      </div>

      <p className={styles.footnote}>
        Pulling an announcement takes the banner down for every rider and keeps the record of what
        was said and who dismissed it. Nothing here is deleted — a message the product sent should
        stay findable afterwards.
      </p>
    </div>
  );
}
