import type {
  ClipPlatformId,
  SessionDurationMinutes,
  SessionFeelId,
  SessionVisibilityId,
  SessionWeatherId,
} from '../types';

/**
 * The fixed vocabularies a logged session is made of (T36), as data.
 *
 * Every id here is also a select value in
 * `pocketbase/migrations/1789603200_sessions.js` and a label in
 * `pocketbase/hooks/lib/labels.js`, so a rider's data export reads in the same
 * words the app shows. `pocketbase/tests/session-rules.test.ts` holds the three
 * together. Adding an option is a schema change as well as an edit here.
 *
 * Colours are the design handoff's (`landit-research/session-tracking-2026-09-13`,
 * "Design tokens"). The feel-face and weather **glyphs** are not here: they are
 * drawing, and drawing lives in `@landit/ui-web` (`FEEL_FACES`, `WEATHER_ICONS`),
 * keyed by these same ids.
 */

/** How it felt, best first. The form renders them in this order. */
export const SESSION_FEELS = [
  { id: 'sent', label: 'Sent it', color: '#10a06a' },
  { id: 'good', label: 'Good', color: '#9ce05b' },
  { id: 'fine', label: 'Fine', color: '#ffc23f' },
  { id: 'rough', label: 'Rough', color: '#ff5a1f' },
  { id: 'hurt', label: 'Hurt', color: '#ff3d78' },
] as const satisfies readonly { id: SessionFeelId; label: string; color: string }[];

export const SESSION_FEEL_IDS = SESSION_FEELS.map((f) => f.id) as readonly SessionFeelId[];

/** The weather row. The selected cell is blue, whatever the weather. */
export const SESSION_WEATHER = [
  { id: 'sun', label: 'Sun' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'rain', label: 'Rain' },
  { id: 'wind', label: 'Wind' },
  { id: 'cold', label: 'Cold' },
] as const satisfies readonly { id: SessionWeatherId; label: string }[];

export const SESSION_WEATHER_IDS = SESSION_WEATHER.map((w) => w.id) as readonly SessionWeatherId[];

/** The weather row's selected colour (`#3ac0ff`). */
export const SESSION_WEATHER_SELECTED_COLOR = '#3ac0ff';

/**
 * The four "How long" chips. `180` is "3h+": a rider who rode for five hours is
 * not asked to say so, and the hours total treats it as three.
 */
export const SESSION_DURATIONS = [
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' },
  { minutes: 180, label: '3h+' },
] as const satisfies readonly { minutes: SessionDurationMinutes; label: string }[];

export const SESSION_DURATION_MINUTES = SESSION_DURATIONS.map(
  (d) => d.minutes,
) as readonly SessionDurationMinutes[];

/**
 * Who can see a session, in the order the design lists them (D2, Rachid,
 * 2026-09-13, in chat). The ids are profile privacy's; the labels are the
 * design's, because "Riders only" would be wrong here — on a session `members`
 * reaches crew-mates, not every signed-in rider.
 *
 * `blurb` is the settings-radio line from screenshot 1g. `help` is the longer
 * sentence a form or a detail page can put under the choice, and it says the
 * ceiling out loud: a session is never more visible than the profile.
 */
export const SESSION_VISIBILITIES = [
  {
    id: 'public',
    label: 'Public',
    blurb: 'Anyone on Land The Trick',
    help: 'Anyone can see it — as long as your profile is open to them too.',
  },
  {
    id: 'members',
    label: 'Crew',
    blurb: 'The riders you ride with',
    help: 'Riders in a crew with you — as long as your profile is open to them too.',
  },
  {
    id: 'private',
    label: 'Only me',
    blurb: 'Nobody else, ever',
    help: 'Nobody but you, whatever your profile says.',
  },
] as const satisfies readonly {
  id: SessionVisibilityId;
  label: string;
  blurb: string;
  help: string;
}[];

export const SESSION_VISIBILITY_IDS = SESSION_VISIBILITIES.map(
  (v) => v.id,
) as readonly SessionVisibilityId[];

/**
 * The default for new sessions, and for a profile that has never chosen one:
 * **`private`**, the value itself (D2). A session records a place and a time a
 * rider was there, so being visible is something they turn on.
 */
export const DEFAULT_SESSION_VISIBILITY: SessionVisibilityId = 'private';

/**
 * The three clip platforms (D4) and their badge colours. Order is the order the
 * clip field's hint names them in: "YouTube, Instagram or TikTok URL".
 */
export const CLIP_PLATFORMS = [
  { id: 'youtube', label: 'YouTube', color: '#ff5a1f' },
  { id: 'instagram', label: 'Instagram', color: '#ff3d78' },
  { id: 'tiktok', label: 'TikTok', color: '#3ac0ff' },
] as const satisfies readonly { id: ClipPlatformId; label: string; color: string }[];

export const CLIP_PLATFORM_IDS = CLIP_PLATFORMS.map((p) => p.id) as readonly ClipPlatformId[];

/**
 * The limits a session's free text and lists keep to. The hook repeats them
 * (`pocketbase/hooks/lib/session_rules.js`) and a test holds the two in step.
 *
 * `crewMax` is a sanity bound, not a product number: ten tagged crew-mates is
 * more than a session has ever needed, and a bound stops the field being a way
 * to write a thousand relation ids.
 */
export const SESSION_LIMITS = {
  aimMax: 120,
  notesMax: 2000,
  crewMax: 10,
  tricksMax: 20,
} as const;
