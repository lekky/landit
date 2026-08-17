'use client';

import { CONTACT } from '@landit/core';
import { Button, Panel } from '@landit/ui-web';
import { useActionState, useState } from 'react';

import { deleteAccountAction, type DeleteAccountState } from './dataActions';
import styles from './account.module.css';

/**
 * Your data, and the end of it (T18; plan §6.5).
 *
 * The privacy policy promises both a copy and a deletion, and until this landed
 * neither had a control — a promise with no button is the same shape of problem
 * the safeguarding page's reporting paragraph had.
 *
 * **The screen says what deletion actually does, before it does it.** Erasure
 * here is anonymise-and-retain (owner decision, Rachid, 2026-08-17): the rider's
 * own records go, the safeguarding trail stays under a pseudonym. Somebody
 * pressing this button is entitled to know that, in a sentence, without reading
 * the privacy policy — a consent obtained by only mentioning the half that
 * sounds better is not one.
 *
 * **Two confirmations, and the password is one of them.** The server checks it
 * (`96_account.pb.js`); this is the copy that explains why it is being asked.
 */
export function DataPanel() {
  const [result, action, pending] = useActionState<DeleteAccountState | undefined, FormData>(
    deleteAccountAction,
    undefined,
  );
  const [open, setOpen] = useState(false);

  return (
    <>
      <Panel flat className={styles.later}>
        <div className="lab">Your data</div>
        <p className={`cond ${styles.handle}`} style={{ marginTop: 8 }}>
          Everything Land It holds about you, in one file: your profile, every trick you have
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
      </Panel>

      <Panel flat className={styles.later}>
        <div className="lab">Closing your account</div>
        <p className={`cond ${styles.handle}`} style={{ marginTop: 8 }}>
          Your name, your handle, your email and everything you have logged are wiped, and the
          account stops working. Some records have to stay: if anything was ever reported to us by
          you or about you, and the note of any permission a grown-up gave, those are kept with your
          name replaced by a code that means nothing on its own. We keep them because a service that
          can be made to forget a safeguarding report is not a safe one.
        </p>
        <p className={`cond ${styles.handle}`} style={{ marginTop: 8 }}>
          It cannot be undone, and we cannot get it back for you afterwards. Download your data
          first if you want to keep it.
        </p>

        {!open ? (
          <div className={styles.profileLinks} style={{ marginTop: 12 }}>
            <Button variant="ghost" onClick={() => setOpen(true)}>
              Close my account
            </Button>
          </div>
        ) : (
          <form action={action} className={styles.guardianForm} style={{ marginTop: 12 }}>
            <div className="field">
              <label htmlFor="delete_password">Your password</label>
              <input id="delete_password" name="password" type="password" autoComplete="off" />
              <span className="cond" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                We ask again so that somebody who picks up your phone cannot do this.
              </span>
            </div>
            <div className="field">
              <label htmlFor="delete_confirm">Type DELETE</label>
              <input id="delete_confirm" name="confirm" autoComplete="off" placeholder="DELETE" />
            </div>
            {result?.error ? <span className="err">{result.error}</span> : null}
            <div className={styles.profileLinks}>
              <Button type="submit" disabled={pending}>
                {pending ? 'Closing…' : 'Close my account for good'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Keep my account
              </Button>
            </div>
          </form>
        )}

        <p className={`cond ${styles.handle}`} style={{ marginTop: 10 }}>
          Questions about any of this: <a href={`mailto:${CONTACT.privacy}`}>{CONTACT.privacy}</a>.
        </p>
      </Panel>
    </>
  );
}
