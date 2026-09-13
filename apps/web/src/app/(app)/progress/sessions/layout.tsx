import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { currentRider } from '@/lib/session';
import { sessionsEnabledFor } from '@/lib/sessionsPreview';

/**
 * Progress › Sessions (T37): the list, with a `@modal` slot beside it.
 *
 * The slot is for T38's desktop log and edit modal ("the desktop log form is a
 * modal over the sessions list — you never lose your place", handoff
 * decisions). Next's parallel and intercepting routes give that for free: a
 * soft navigation from this list to `/progress/sessions/new` or
 * `/progress/sessions/<id>/edit` renders the form into `modal` over the list,
 * while a hard load of either URL renders its own full page. When nothing
 * matches the slot, `@modal/default.tsx` renders nothing.
 *
 * T37 owns only this layout and that default. The intercepting routes are
 * T38's — plan §7, T37, "The `@modal` slot", says exactly which files they are.
 *
 * **Owner-only preview (T41).** Every route under here — the list, one
 * session, new, edit and both intercepts — answers 404 to anyone
 * `sessionsEnabledFor` does not name, signed in or not.
 */
export default async function SessionsLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  const session = await currentRider();
  if (!sessionsEnabledFor(session?.rider)) notFound();

  return (
    <>
      {children}
      {modal}
    </>
  );
}
