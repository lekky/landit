import type { Sport, SportId } from '../types';

/** The three sports, in the order they are offered at onboarding. */
export const SPORT_IDS = ['scooter', 'skate', 'bmx'] as const satisfies readonly SportId[];

export const SPORTS = {
  scooter: {
    id: 'scooter',
    label: 'Scooter',
    short: 'Scooter',
    color: '#FF5A1F',
    icon: 'scoot',
    kit: "Scooter, helmet, and pads once you're on ramps",
    blurb: 'Whips, bar spins and grinds on a stunt scooter',
  },
  skate: {
    id: 'skate',
    label: 'Skateboard',
    short: 'Skate',
    color: '#246BFF',
    icon: 'board',
    kit: 'Skateboard, helmet, and pads for any transition',
    blurb: 'Flip tricks, ledges, rails and transition',
  },
  bmx: {
    id: 'bmx',
    label: 'BMX',
    short: 'BMX',
    /**
     * `--pink`. **Confirmed by the owner on 2026-08-16** — no longer
     * provisional, and the palette does not gain a colour.
     *
     * Every token already had a job, so BMX shares rather than takes: `--pink`
     * is also the link-hover colour, the default avatar background, and the hue
     * on the `send` level and two stickers. That is the established pattern
     * rather than a compromise — `--orange` is scooter *and* Street, `--blue`
     * is skate *and* Park.
     *
     * The one worth knowing about is **link hover**, which is different in kind:
     * a global interaction colour rather than a category. If BMX pink ever
     * needs to read as BMX alone, that rule is the thing to move, not this hex.
     */
    color: '#FF3D78',
    icon: 'bmx',
    kit: 'BMX bike, helmet, and pads for ramps and rails',
    blurb: 'Bunny hops, grinds, barspins and air',
    // See `Sport.categoryLabels`. "Flat" reads as flatground to a scooter or
    // skate rider and as **Flatland** to a BMX one — a named BMX discipline,
    // and not the one this category holds. "Flatground" says the thing both
    // readings were reaching for and claims neither.
    categoryLabels: { flat: 'Flatground' },
  },
} as const satisfies Record<SportId, Sport>;
