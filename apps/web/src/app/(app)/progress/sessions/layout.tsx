import type { ReactNode } from 'react';

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
 */
export default function SessionsLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
