import type { ReactNode } from 'react';

import styles from './auth.module.css';

/**
 * The signed-out auth screens: sign up, sign in, and the two password ones.
 *
 * Deliberately outside `(app)`: there is no nav, no sport switch and no footer
 * here. Screenshot 04 is a single card on an ink field, and the reason is worth
 * keeping — the only two things to do on this screen are fill it in or go back.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className={styles.screen}>{children}</div>;
}
