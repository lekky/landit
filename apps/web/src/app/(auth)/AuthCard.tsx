import { Icon, Panel } from '@landit/ui-web';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Wordmark } from '@/components/site/Wordmark';
import { ROUTES } from '@/lib/routes';

import styles from './auth.module.css';

/**
 * The frame every signed-out auth screen shares (screenshot 04): ink field, a
 * back link, one panel with a yellow offset shadow.
 */
export function AuthCard({
  title,
  lede,
  children,
  footer,
  footnote,
}: {
  title: string;
  lede: string;
  children: ReactNode;
  /** The "already riding?" line under the card's contents. */
  footer?: ReactNode;
  /** The small print outside the card. */
  footnote?: ReactNode;
}) {
  return (
    <div className={styles.column}>
      <Link href={ROUTES.home} className={`cond ${styles.back}`}>
        <Icon name="back" size={16} /> Back
      </Link>

      <Panel className={styles.card}>
        <Wordmark onPaper />
        <h1 className={`d ${styles.title}`}>{title}</h1>
        <p className={`cond ${styles.lede}`}>{lede}</p>
        {children}
        {footer ? <div className={`cond ${styles.swap}`}>{footer}</div> : null}
      </Panel>

      {footnote ? <p className={`cond ${styles.footnote}`}>{footnote}</p> : null}
    </div>
  );
}
