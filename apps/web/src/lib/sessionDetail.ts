import {
  DEFAULT_TIMEZONE,
  MONTH_LABELS,
  MONTH_NAMES,
  STAGE,
  WEEKDAY_NAMES,
  sessionChangeLabel,
  sessionChanges,
  toDayKey,
  type EventDateState,
  type Instant,
  type RideSession,
  type SessionTrickEntry,
  type SessionVisibilityId,
} from '@landit/core';

/**
 * The words and small decisions on the session detail page and the three page
 * blocks (T39), as pure functions.
 *
 * Here rather than in the components because this app's unit tests may only
 * reach `src/lib` (`vitest.config.ts`), and because every one of these is a
 * decision a careless edit could undo without a build noticing: which lines
 * "What this one changed" shows to somebody who is not the owner, what an event
 * block says before, during and after, what a count reads as.
 *
 * **Every date here is formatted on the server** and handed down as a string
 * (LESSONS §3a). The day comes from `toDayKey` and the names from core's tables;
 * the clock time is the one place `Intl` is read, and it is only ever called
 * from a server component.
 */

/** The day key, weekday and parts of an instant on a rider's clock. */
function parts(instant: Instant, timezone: string) {
  const tz = timezone || DEFAULT_TIMEZONE;
  const key = toDayKey(instant, tz);
  const day = Number(key.slice(8, 10));
  const month = Number(key.slice(5, 7)) - 1;
  const year = key.slice(0, 4);
  const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
  return { key, day, month, year, weekday, tz };
}

/**
 * "14:00", on the rider's clock. `hourCycle: 'h23'` for the reason
 * `riderHour` gives in core: `hour12: false` still says "24" at midnight in
 * some runtimes. Server only — see the header.
 */
export function sessionClock(instant: Instant, timezone: string = DEFAULT_TIMEZONE): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  const out = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone || DEFAULT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hh = out.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = out.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hh}:${mm}`;
}

export interface SessionDateLabels {
  /** "Saturday 12 September 2026 · 14:00" — the desktop hero pill (1e). */
  readonly long: string;
  /** "Sat 12 Sep 2026 · 14:00" — the phone hero pill (2c). */
  readonly short: string;
  /** "12 Sep" — the pager, the delete confirm, the event and trick blocks. */
  readonly dayMonth: string;
  /** "12 Sep 2026" — the spot block's rows. */
  readonly dayMonthYear: string;
}

export function sessionDateLabels(
  instant: Instant,
  timezone: string = DEFAULT_TIMEZONE,
): SessionDateLabels {
  const p = parts(instant, timezone);
  const clock = sessionClock(instant, p.tz);
  const weekday = WEEKDAY_NAMES[p.weekday] ?? '';
  const monthLong = MONTH_NAMES[p.month] ?? '';
  const monthShort = MONTH_LABELS[p.month] ?? '';
  return {
    long: `${weekday} ${p.day} ${monthLong} ${p.year} · ${clock}`,
    short: `${weekday.slice(0, 3)} ${p.day} ${monthShort} ${p.year} · ${clock}`,
    dayMonth: `${p.day} ${monthShort}`,
    dayMonthYear: `${p.day} ${monthShort} ${p.year}`,
  };
}

/** "5 Aug" from a day key — the trick block's "first tried". */
export function dayKeyDayMonth(key: string | null): string {
  if (!key) return '';
  return `${Number(key.slice(8, 10))} ${MONTH_LABELS[Number(key.slice(5, 7)) - 1] ?? ''}`;
}

/**
 * The stat strip's "Time on it": "30 minutes", "1 hour", "2 hours", "3 hours+".
 * The chip labels are `30m / 1h / 2h / 3h+`; the strip spells them out, as the
 * design does ("2 hours").
 */
export function durationWords(minutes: number): string {
  if (minutes >= 180) return '3 hours+';
  if (minutes >= 120) return '2 hours';
  if (minutes >= 60) return '1 hour';
  return `${Math.max(0, Math.round(minutes))} minutes`;
}

/** "2 worked, 1 moved", "1 worked", or "None". */
export function tricksStatValue(entries: readonly SessionTrickEntry[]): string {
  if (!entries.length) return 'None';
  const moved = entries.filter((e) => Boolean(e.stageTo)).length;
  return moved ? `${entries.length} worked, ${moved} moved` : `${entries.length} worked`;
}

/** "Ollie, Mia" — first names only — or "Nobody tagged". */
export function crewStatValue(names: readonly string[]): string {
  const firsts = names.map((n) => (n.trim().split(/\s+/)[0] ?? '').trim()).filter(Boolean);
  return firsts.length ? firsts.join(', ') : 'Nobody tagged';
}

/** A tagged rider's chip label: their first name, or "Rider". */
export function crewChipName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Rider';
}

/**
 * The visibility card (owner only). The title names who can see it; the body
 * says what that means. Public borrows core's `help`, because the ceiling —
 * never more visible than the profile — is the thing a rider needs told.
 */
export function visibilityCardCopy(visibility: SessionVisibilityId): {
  readonly title: string;
  readonly body: string;
} {
  if (visibility === 'public') {
    return {
      title: 'Anyone can see this',
      body: 'Anyone can see it — as long as your profile is open to them too.',
    };
  }
  if (visibility === 'members') {
    return {
      title: 'Your crew can see this',
      body: 'Nobody outside it sees the spot, the time or the clip.',
    };
  }
  return {
    title: 'Only you can see this',
    body: 'Nobody else sees the spot, the time or the clip.',
  };
}

/**
 * The lines on "What this one changed".
 *
 * **The owner gets core's whole list** — stage moves, the ride that held the
 * streak, the week banked, which session at the spot it was — computed against
 * their whole diary.
 *
 * **Anybody else gets the stage moves only.** The other three are about the
 * owner's streak and their history at a place, and a crew-mate's client can
 * only see the sessions that were shared with it: counted over those, "your
 * first session at this spot" would be false as often as true, and it would be
 * addressed to the wrong person. A stage move is on the session itself, so it
 * is the same fact whoever reads it.
 */
export function changeLines(
  session: RideSession,
  allSessions: readonly RideSession[] | null,
  trickName: (trickId: string) => string,
  options: { isOwner: boolean; timezone?: string },
): string[] {
  const changes = options.isOwner
    ? sessionChanges(session, allSessions ?? [session], { timezone: options.timezone })
    : sessionChanges(session, [session], { timezone: options.timezone }).filter(
        (c) => c.kind === 'stage',
      );
  return changes.map((c) => sessionChangeLabel(c, c.kind === 'stage' ? trickName(c.trickId) : ''));
}

/** The small line under a trick's name on the detail page. */
export function detailTrickNote(entry: SessionTrickEntry): string {
  if (entry.stageTo) return `Landed it · now ${STAGE[entry.stageTo].label}`;
  return entry.landed ? 'Landed it' : 'Worked on it';
}

/** "1 of 10": where a session sits in the owner's diary, newest first. */
export function pagerPosition(
  orderedIds: readonly string[],
  id: string,
): { readonly label: string } | null {
  const at = orderedIds.indexOf(id);
  if (at === -1) return null;
  return { label: `${at + 1} of ${orderedIds.length}` };
}

/* ------------------------------------------------------------ blocks --- */

/** "4 · 8h 30m" — the spot block's ink badge. */
export function spotBlockBadge(count: number, minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  const time = hours === 0 ? `${rest}m` : rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
  return `${count} · ${time}`;
}

/** A trick chip in the spot block: "Tailwhip → Most times", or just the name. */
export function trickChipLabel(name: string, entry: SessionTrickEntry): string {
  return entry.stageTo ? `${name} → ${STAGE[entry.stageTo].label}` : name;
}

/**
 * Which event block to draw, if any.
 *
 * - **`live`** on the day: "Riding it? Put it in your log." A session cannot
 *   start in the future, so there is nothing to offer before the day.
 * - **`past`** once it is over — the sessions the rider logged there, or, when
 *   they logged none, the offer to log one now.
 * - Nothing for an upcoming event.
 *
 * A rider who logged a session earlier on the day still gets the live block:
 * a second session at the same jam is the normal case.
 *
 * **`past` no longer needs a session to exist** (owner, 2026-09-17, in chat:
 * "no log a session at event"). It used to require one, on the argument that
 * "You logged 0 sessions here" is a sentence about nothing — true of that
 * heading, but it left the rider who rode a jam and opened the app on the way
 * home with no way to attach it: the session form offers an event only when one
 * is at the chosen spot *today* (`eventsAtSpotToday`), and this block was the
 * only other door. The empty case is now an invitation rather than a count, so
 * the sentence about nothing never gets written.
 */
export function eventBlockState(state: EventDateState, count: number): 'live' | 'past' | null {
  if (state === 'today') return 'live';
  if (state === 'over') return 'past';
  if (count > 0) return 'past';
  return null;
}

/** "You logged 1 session here", "You logged 2 sessions here". */
export function loggedHereHeading(count: number): string {
  return `You logged ${count} ${count === 1 ? 'session' : 'sessions'} here`;
}

/** "5 sessions · first tried 5 Aug". */
export function trickBlockMeta(count: number, firstTriedOn: string | null): string {
  const n = `${count} ${count === 1 ? 'session' : 'sessions'}`;
  const first = dayKeyDayMonth(firstTriedOn);
  return first ? `${n} · first tried ${first}` : n;
}
