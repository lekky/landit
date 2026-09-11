/**
 * Every knob the daily social pipeline has. One file to edit.
 *
 * The pipeline posts one card a day to Facebook, Instagram and TikTok. What it
 * cannot do is place the post: Buffer's connector signs in as a person and CI
 * has no browser session, so the workflow renders and queues, and a Claude
 * session with the Buffer connector places the queue (`/social-schedule`).
 * `docs/social-posts.md` explains the split.
 */

export const config = {
  /** The live API. Every figure in a post comes from here, never from prose. */
  api: 'https://api.landthetrick.com',
  site: 'https://landthetrick.com',

  timezone: 'Europe/London',
  /** Local time of day the post goes out — after school, before the evening. */
  postTime: '16:30',

  /**
   * How many days ahead to keep scheduled. Buffer's free plan caps the whole
   * organisation at 10 posts sitting in the queue, and one day costs three (one
   * per channel), so two days ahead is six slots and leaves room to post by
   * hand. Raising this needs a paid Buffer plan, not just a bigger number.
   */
  horizonDays: 2,

  networks: ['facebook', 'instagram', 'tiktok'],

  /**
   * Only Facebook makes a URL in a post clickable. On Instagram and TikTok a
   * tagged link is unclickable clutter that also reads as spam, so they get the
   * clean address and are measured in Buffer's own per-post analytics.
   */
  utmNetworks: ['facebook'],
  utmCampaign: 'daily-post',

  /**
   * 1080×1350 is Instagram's 4:5 exactly, and TikTok's limit is 1080 wide.
   * TikTok rejects `image/png` on a photo post, so the card is written as JPEG.
   */
  image: { width: 1080, height: 1350, quality: 92, type: 'jpeg' },

  /** Anti-repetition, in days. A subject is a trick, spot, event or sticker. */
  cooldown: { key: 400, subject: 30, angle: 3 },

  paths: {
    plates: 'scripts/social/plates',
    out: '.social-out',
    queue: 'data/social/pending.json',
    history: 'data/social/history.json',
  },
};

/**
 * The ten plates, and the band of clear paper each one leaves for text.
 *
 * The plates are painted art: riders, splashes, the skatepark, and the headline
 * that repeats every week ("TRICK OF THE WEEK"). Only the part that changes is
 * rendered over them. Each `band` is [top, bottom] in the 1080×1350 card,
 * measured off the plate rather than guessed — the palms begin around y=900, so
 * there is far less room than the artwork suggests and a layout that ignores
 * this prints text into a tree.
 */
export const PLATES = {
  'challenge-new': { file: '01-new-challenge.jpg', band: [633, 898] },
  'challenge-last-week': { file: '02-last-week.jpg', band: [644, 898] },
  'trick-scooter': { file: '03-trick-scooter.jpg', band: [650, 898] },
  'trick-skate': { file: '04-trick-skate.jpg', band: [630, 896] },
  'trick-bmx': { file: '05-trick-bmx.jpg', band: [673, 898] },
  'spot-of-the-week': { file: '06-spot-of-the-week.jpg', band: [636, 884] },
  'events-weekend': { file: '07-this-weekend.jpg', band: [641, 898] },
  'sticker-drop': { file: '08-sticker-drop.jpg', band: [641, 896] },
  'did-you-know': { file: '09-did-you-know.jpg', band: [638, 898] },
  blank: { file: '10-blank.jpg', band: [459, 898] },
};

/** Brand colours, from the design system. */
export const COLOURS = {
  ink: '#111111',
  paper: '#EFEBE1',
  pink: '#FF2E88',
  teal: '#1FE0C8',
  blue: '#1E8BFF',
};

/** A colour per sport, so a scooter post always reads the same way. */
export const SPORT_COLOUR = { scooter: COLOURS.pink, skate: COLOURS.teal, bmx: COLOURS.blue };

export const SPORT_LABEL = { scooter: 'Scooter', skate: 'Skate', bmx: 'BMX' };
