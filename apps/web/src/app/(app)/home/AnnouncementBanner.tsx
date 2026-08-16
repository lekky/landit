'use client';

import { Tag } from '@landit/ui-web';
import { useState, useTransition } from 'react';

import { dismissAnnouncementAction } from './actions';
import type { AnnouncementView } from './view';

import styles from './home.module.css';

/**
 * The staff announcement banner (`landit-screens-a.jsx`, top of Home).
 *
 * "Got it" writes an `announcement_dismissals` row, which is what replaces the
 * prototype's `seenNotices` array in `localStorage` (plan §3) — so a rider who
 * dismisses it on a phone does not meet it again on a laptop.
 *
 * It goes at once, before the server has confirmed: the write is idempotent and
 * the worst case is a banner that comes back on the next load. Making a child
 * watch a spinner to dismiss a notice is the wrong trade.
 */
export function AnnouncementBanner({ notice }: { notice: AnnouncementView }) {
  const [gone, setGone] = useState(false);
  const [, startTransition] = useTransition();

  if (gone) return null;

  return (
    <div className={`panel ${styles.notice}`} style={{ background: notice.hue }} role="status">
      <Tag color="var(--ink)">{notice.label}</Tag>
      <div className={styles.noticeBody}>
        <div className="cond" style={{ fontSize: 16 }}>
          {notice.title}
        </div>
        {notice.body && <p className={styles.noticeText}>{notice.body}</p>}
      </div>
      <button
        type="button"
        className="btn sm ink"
        onClick={() => {
          setGone(true);
          startTransition(() => dismissAnnouncementAction(notice.id));
        }}
      >
        Got it
      </button>
    </div>
  );
}
