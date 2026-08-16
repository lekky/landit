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
     * **Placeholder — the owner's call is outstanding** (plan §7, T21).
     *
     * Every other token in the palette already has a job: `--orange` is scooter
     * and Street, `--blue` is skate and Park, `--violet` is the paywall and
     * staff, `--lime` is landed, `--red` is destructive and Air. That leaves
     * `--pink`, the only token the handoff describes as a general accent — so
     * BMX takes it provisionally, or the palette gains a colour. Swapping this
     * hex is the whole of the change either way.
     */
    color: '#FF3D78',
    icon: 'bmx',
    kit: 'BMX bike, helmet, and pads for ramps and rails',
    blurb: 'Bunny hops, grinds, barspins and air',
    // See `Sport.categoryLabels`: "Flat" reads as flatground to a scooter or
    // skate rider, but Flatland is a named BMX discipline.
    categoryLabels: { flat: 'Flatland' },
  },
} as const satisfies Record<SportId, Sport>;
