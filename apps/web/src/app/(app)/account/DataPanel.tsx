import { Panel } from '@landit/ui-web';
import Link from 'next/link';

import { ROUTES } from '@/lib/routes';

import styles from './account.module.css';

/**
 * Your data, and where the end of it lives (T18; plan §6.5).
 *
 * The privacy policy promises both a copy and a deletion, and until T18 neither
 * had a control — a promise with no button is the same shape of problem the
 * safeguarding page's reporting paragraph had.
 *
 * **The deletion half moved out on 2026-09-12** (owner, in chat). It was a
 * second panel here: a label, two paragraphs about erasure being irreversible,
 * and a button, in front of every rider who came to change their stance. It is
 * `/account/close` now, and what is left of it here is the last line of this
 * panel. The two belong in one place — the closing page tells a rider to take
 * their data first, and this is where they do that — but only one of them is
 * something an ordinary visit to this screen should be offered.
 *
 * **The link is a link, and stays one.** Not a button, not a panel of its own,
 * and not removed: erasure has to be reachable, and a rider looking for the way
 * out should find it under the heading they would look under.
 *
 * A server component since the form left. Nothing here has state any more.
 */
export function DataPanel() {
  return (
    <Panel flat className={styles.later}>
      <div className="lab">Your data</div>
      <p className={`cond ${styles.handle}`} style={{ marginTop: 8 }}>
        Everything Land The Trick holds about you, in one file: your profile, every trick you have
        logged, your notes, your stickers, your crews and anything you have reported to us.
      </p>
      <div className={styles.profileLinks} style={{ marginTop: 12 }}>
        {/*
          A plain link, not a fetch. The route sets `Content-Disposition`, so
          the browser saves the file instead of this page holding a second copy
          of a rider's entire account in memory.
        */}
        <a className="btn sm ghost" href="/api/account/export" download>
          Download your data
        </a>
      </div>
      <p className={`cond ${styles.handle}`} style={{ marginTop: 12 }}>
        Done with Land The Trick? <Link href={ROUTES.accountClose}>Closing your account</Link>.
      </p>
    </Panel>
  );
}
