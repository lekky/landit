'use client';

import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { SettingsRowSpec } from './rows';

import styles from './account.module.css';

/**
 * `SettingsList` / `SettingsRow` — what `/account` is now (rethink §3.9, T51).
 *
 * A row is the shape `OptionRow` already gave the Log sheet (§3.5 says as
 * much: "the shape the settings list and Home's cards take later") at §3.9's
 * numbers — 60px tall, a 40px icon square with a fixed fill, a 16px title, a
 * 13px sub-line carrying the current value, and a chevron. §4's press applies,
 * and the row is well over the 44px floor.
 *
 * **Each row is a link, at every width.** Not a button that swaps a panel: the
 * URL changing is the whole point of the desktop's list-plus-panel, so a rider
 * can link to "who can see your profile", come back to it, and land on the
 * right panel rather than on the top of a long screen. On a phone the same
 * link is the whole navigation.
 *
 * `usePathname` is what lights the current row. It is the only reason this is a
 * client component: the list is otherwise inert, and every value on it was
 * computed on the server (`rows.ts`).
 */
function SettingsRow({ row, current }: { row: SettingsRowSpec; current: boolean }) {
  return (
    <Link
      href={row.href}
      className={`${styles.settingsRow} ${current ? styles.settingsRowOn : ''}`.trim()}
      aria-current={current ? 'page' : undefined}
    >
      <span
        className={styles.settingsMark}
        // A dark fill carries `--on-dark`; everything else takes the class's
        // `--on-light`, which is what `.optionMark` sets for the same squares in
        // the Log sheet.
        style={{ background: row.fill, ...(row.ink ? { color: row.ink } : null) }}
        aria-hidden="true"
      >
        <Icon name={row.icon} size={20} strokeWidth={2.4} />
      </span>
      <span className={styles.settingsText}>
        <span className={styles.settingsTitle}>{row.title}</span>
        <span className={styles.settingsValue}>{row.value}</span>
      </span>
      <Icon
        name="chevron"
        size={18}
        strokeWidth={2.6}
        className={styles.settingsChevron}
        aria-hidden
      />
    </Link>
  );
}

export function SettingsList({ rows }: { rows: readonly SettingsRowSpec[] }) {
  const pathname = usePathname();

  return (
    <nav className={styles.settings} aria-label="Your account">
      {rows.map((row) => (
        <SettingsRow key={row.id} row={row} current={pathname === row.href} />
      ))}
    </nav>
  );
}
