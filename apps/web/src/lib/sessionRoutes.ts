import type { Route } from 'next';

import { ROUTES } from './routes';

/**
 * Where the session screens live (T36, for T37–T40).
 *
 * In a file of its own rather than more lines in `routes.ts`, because four
 * screen sessions start on top of this at once and every one of them needs a
 * session link: one shared file each of them would otherwise add to is a
 * four-way merge conflict waiting to happen (LESSONS §1). The builders follow
 * `routes.ts`'s shape — they return a `Route`, cast, because `typedRoutes`
 * cannot see a page that has not been built yet.
 *
 * **Only record ids go in these URLs, never anything a rider typed.** A spot's
 * *name* or a trick's *slug* can be a child's words (`spot_page_opened` in
 * `analytics.ts` argues this at length), and a URL ends up in history, in
 * referrers and in server logs. So the builders take ids and refuse anything
 * that is not shaped like one, and `readNewSessionPrefill` drops anything that
 * is not shaped like one on the way back in.
 */

/** A PocketBase record id: fifteen lower-case letters and digits. */
export const RECORD_ID_PATTERN = /^[a-z0-9]{15}$/;

export function isRecordId(value: unknown): value is string {
  return typeof value === 'string' && RECORD_ID_PATTERN.test(value);
}

function requireId(id: string, what: string): string {
  if (!isRecordId(id)) throw new Error(`not a ${what} record id: ${JSON.stringify(id)}`);
  return id;
}

/** The Progress › Sessions tab. */
export const SESSIONS_PATH = `${ROUTES.progress}/sessions` as const;

/** `/progress/sessions`. */
export const sessionsHref = (): Route => SESSIONS_PATH as Route;

/** `/progress/sessions/<id>` — one session. */
export const sessionHref = (id: string): Route =>
  `${SESSIONS_PATH}/${requireId(id, 'session')}` as Route;

/** `/progress/sessions/<id>/edit`. */
export const editSessionHref = (id: string): Route =>
  `${SESSIONS_PATH}/${requireId(id, 'session')}/edit` as Route;

/** What the log form can be opened already holding. Ids only. */
export interface NewSessionPrefill {
  readonly spot?: string;
  readonly event?: string;
  readonly trick?: string;
  /** Open the three-tap quick log rather than the full form. */
  readonly quick?: boolean;
}

/**
 * `/progress/sessions/new`, with `spot`, `event`, `trick` and `quick=1` when
 * given, in that fixed order so two links to the same prefill are the same URL.
 */
export const newSessionHref = (prefill: NewSessionPrefill = {}): Route => {
  const params = new URLSearchParams();
  if (prefill.spot) params.set('spot', requireId(prefill.spot, 'spot'));
  if (prefill.event) params.set('event', requireId(prefill.event, 'event'));
  if (prefill.trick) params.set('trick', requireId(prefill.trick, 'trick'));
  if (prefill.quick) params.set('quick', '1');
  const search = params.toString();
  return `${SESSIONS_PATH}/new${search ? `?${search}` : ''}` as Route;
};

/** A page's `searchParams`, as Next hands them over. */
type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The prefill back out of `/progress/sessions/new`'s search params.
 *
 * Anything that is not a record id is dropped rather than trusted — a hand-typed
 * `?spot=Tennis%20court` opens an empty form, not a form holding that text.
 * The ids are still only *suggestions*: the server checks the spot is live and
 * the event is on the calendar when the session is saved.
 */
export function readNewSessionPrefill(searchParams: SearchParams): NewSessionPrefill {
  const spot = first(searchParams.spot);
  const event = first(searchParams.event);
  const trick = first(searchParams.trick);
  return {
    ...(isRecordId(spot) ? { spot } : {}),
    ...(isRecordId(event) ? { event } : {}),
    ...(isRecordId(trick) ? { trick } : {}),
    ...(first(searchParams.quick) === '1' ? { quick: true } : {}),
  };
}
