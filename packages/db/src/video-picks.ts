/**
 * The automatic tutorial curation pass (#462) — its shape and its rules.
 *
 * T35 shipped the "Watch it" panel with an empty catalogue on the assumption
 * that a person would watch all 259 videos and type them in, roughly 10–15
 * hours. The owner asked instead for the pass to be done automatically, with
 * **high-confidence picks live and doubtful ones held back** for a human to
 * check (Rachid, 2026-09-13, in chat). {@link VIDEO_PICKS} in
 * `./video-picks.data.ts` is that pass; this file is what a pick *is*.
 *
 * **Nothing here was watched.** Every pick was matched from a YouTube search
 * result's title and channel, which is a weaker thing than somebody watching a
 * video and deciding, and the data model says so out loud rather than quietly:
 * the importer writes `video_source = 'auto'` on every row, the staff portal
 * shows those as "Not checked" and can filter to exactly them, and a person
 * pressing "Approve and set live" in the review modal is what upgrades one.
 *
 * **Why confidence is a stored judgement and not a score.** The measurement
 * behind T35 found the failure mode is semantic, not statistical: "Pole Tap"
 * returns pole vaulting and pole dancing, "Kickturn" returns moped
 * kick-starting, and neither is fixed by adding "pro scooter" to the query. A
 * number would launder that into false precision. `high` means the channel is
 * one that makes tutorials for this sport *and* the title names this trick;
 * anything else is `low`, goes in hidden, and shows riders nothing until
 * somebody looks.
 */

/** A trusted tutorial channel, per sport (#462) — the allowlist a `high` pick must come from. */
export const TRUSTED_CHANNELS: Record<string, readonly string[]> = {
  scooter: ['Scooter Hut', 'Alli Sports', 'Ryan Williams', 'Tilt Scooters'],
  skate: ['Braille Skateboarding', 'skatedeluxe', 'The Berrics', 'Jonny Giger'],
  bmx: ['TransWorld RideBMX', 'Alli Sports', 'Vital BMX', 'Adam LZ'],
};

/** How much a pick can be trusted without somebody watching it. */
export type PickConfidence = 'high' | 'low';

/** One trick's automatically-matched tutorial. */
export interface VideoPick {
  /** The trick's slug, as `TRICKS` spells it. */
  readonly slug: string;
  /** The eleven-character YouTube id. */
  readonly videoId: string;
  /** The video's own title, as YouTube gives it. */
  readonly title: string;
  /** The channel that published it. */
  readonly channel: string;
  /**
   * `high` goes live on import; `low` is imported switched off and waits for a
   * staff member. There is no third state: "probably fine" is `low`, because
   * the cost of being wrong is a child on a page that is not about their trick.
   */
  readonly confidence: PickConfidence;
}

/** Should this pick be visible to riders the moment it is imported? */
export function pickStartsHidden(pick: VideoPick): boolean {
  return pick.confidence !== 'high';
}
