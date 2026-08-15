import { CORE_PACKAGE } from '@landit/core';
import { DB_PACKAGE } from '@landit/db';
import { UI_WEB_PACKAGE } from '@landit/ui-web';

/**
 * Scaffold placeholder. Not a design — the landing page is T5, and it is built
 * against the design system from T3, not from here.
 *
 * Its one job is to prove the wiring: the app renders, and it can import from
 * all three workspace packages.
 */
export default function ScaffoldPage() {
  return (
    <main>
      <h1>Land It</h1>
      <p data-testid="scaffold-note">
        Scaffold only. No product code yet — see docs/implementation-plan.md §7.
      </p>
      <ul data-testid="workspace-packages">
        <li>{CORE_PACKAGE}</li>
        <li>{DB_PACKAGE}</li>
        <li>{UI_WEB_PACKAGE}</li>
      </ul>
    </main>
  );
}
