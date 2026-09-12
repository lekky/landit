'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { noteScreen } from '@/lib/libraryPlace';

/**
 * Renders nothing; tells the library's place memory which screen the rider is
 * on (`lib/libraryPlace.ts`).
 *
 * This is the half that makes "put me back where I was" a promise rather than a
 * guess. The library records its scroll offset and its narrowing as it
 * unmounts, and would otherwise hand them back to whoever arrived next — a
 * rider coming from Home an hour later included. Forgetting the place on the
 * first screen that is not the library is what keeps it to the one hop it is
 * for: open a trick, come back.
 *
 * In the shell rather than in each screen, for the same reason the offline
 * registrar is: a screen landed next month should not have to know this exists
 * in order to not be caught by it. It sits inside `AppShell`, so it covers every
 * `(app)` route and nothing outside it — the landing page, the legal documents
 * and the auth screens have no shell and no library to remember.
 */
export function PlaceKeeper() {
  const path = usePathname();

  useEffect(() => {
    noteScreen(path);
  }, [path]);

  return null;
}
