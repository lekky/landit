import type { ReactNode } from 'react';

import { BackLink } from '@/components/shell/BackLink';
import { ROUTES } from '@/lib/routes';

import styles from './account.module.css';

/**
 * One of the account's screens: a back link, the eyebrow, the title, the panel.
 *
 * **The back link is the phone's** (§2.3). On a desktop the list is 340px to
 * the left of this heading with the current row lit, so a second control
 * pointing at it would be the thing T48 removed from `/events/mine`: two
 * controls with the same words, going to the same address, a few centimetres
 * apart. It is hidden in CSS rather than not rendered, because whether it
 * belongs is a question about the width of the screen and the server does not
 * know one.
 *
 * **The title is the row's own words**, so a rider who pressed "Who can see
 * your profile" arrives at a screen with that at the top of it. The panel
 * underneath is therefore drawn without its own label — `headed={false}` on
 * each of them — because the alternative is the same four words twice, 20px
 * apart, in two different sizes.
 *
 * **And there is no eyebrow.** Every other screen in the product wears one, and
 * here it would read "YOUR ACCOUNT" directly under a back link reading "←
 * YOUR ACCOUNT" — measured on a 390px phone, two identical lines of the same
 * small caps, 6px apart. On a desktop the list is on the left with the row lit,
 * which says the same thing better. So the parent is named once, by whichever
 * of the two the width has drawn.
 */
export function AccountDetail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className={styles.detailBack}>
        <BackLink href={ROUTES.account} label="Your account" />
      </div>
      <h1 className={`d ${styles.detailHead}`}>{title}</h1>
      {children}
    </div>
  );
}
