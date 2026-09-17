'use client';

import { useTabParam } from '@/components/shell/useTabParam';

import { WhatsNewPanel, YOU_TAB } from './WhatsNewPanel';
import type { WhatsNewView } from './view';

/**
 * `/whats-new`'s tab, kept in `?tab=` (integration review, F8).
 *
 * The page **read** `?tab=` — the dropdown's "All →" writes it — and never
 * wrote one, so a rider who arrived on You, pressed a crew tab and then opened
 * a rider's profile came back to You, having lost the tab they were reading.
 * Every other tab row in the product that switches a panel in place keeps its
 * answer in the address (`useTabParam`, T46): reload keeps it, Back restores it,
 * and the address can be shared. `replace` rather than push, so three taps do
 * not put three entries in the history.
 *
 * It is a wrapper rather than a hook call inside `WhatsNewPanel` because the
 * **dropdown** renders that same component from the top bar of every screen,
 * and it must not rewrite the query of the page it is floating over — nor read
 * one, since `useSearchParams` in a component the shell renders is a hook every
 * route would then pay for. The panel takes the tab as a prop and does not care
 * where it is kept.
 */
export function WhatsNewPageBody({ view }: { view: WhatsNewView }) {
  // Validated against the tabs this rider actually has, so a hand-typed
  // `?tab=nonsense` — or a crew they have since left — opens You.
  const ids = [YOU_TAB, ...view.crews.map((crew) => crew.id)];
  const [tab, setTab] = useTabParam(ids, YOU_TAB);

  return <WhatsNewPanel view={view} place="page" tab={tab} onTab={setTab} />;
}
