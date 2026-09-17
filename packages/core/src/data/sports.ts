import type { Sport, SportId } from '../types';

/** The three sports, in the order they are offered at onboarding. */
export const SPORT_IDS = ['scooter', 'skate', 'bmx'] as const satisfies readonly SportId[];

/**
 * **The sport colours are the art's colours now** (Rachid, 2026-09-17, in chat:
 * "the colours defined for each type should match the main colour in the image
 * now").
 *
 * Until today a sport borrowed a palette token — scooter `--orange`, skate
 * `--blue`, BMX `--pink` — and the painted equipment that arrived on 2026-09-16
 * was painted to none of them. A cyan scooter sat inside an orange keyline, and
 * the chip read as two unrelated things stuck together. Each sport now takes the
 * main splash colour out of its own illustration, so the chip, the tab and the
 * art agree.
 *
 * The three values are the **median of the strongly saturated pixels** in each
 * master (`s >= 0.6`, `0.25 < l < 0.8`, which excludes the black ink, the
 * die-cut white keyline and the transparent ground), rounded to a clean hex.
 * Measured 2026-09-17 over 1254×1254 masters: cyan #01E0ED from 258,085 pixels,
 * pink #FC047B from 167,733, orange #FD7701 from 202,916, each a single hue
 * band in the histogram. Repainted art means re-sampling, the same way it means
 * re-running `packages/ui-web/scripts/export-sport-art.mjs`.
 *
 * **These are not palette tokens and must not become them.** `--orange`,
 * `--blue`, `--pink` and `--sky` in `tokens.css` are unchanged and keep every
 * job they had: Street is still `--orange`, Park is still `--blue`, link hover
 * is still `--pink`, and the sticker, challenge, feel, level and clip-platform
 * hues all stay where they were. What ended is the *sharing* — a sport colour is
 * now its own value, owned here, and nothing else reads it.
 *
 * All three clear AA against `--on-light` ink, which is what `foregroundFor`
 * picks for each: 11.66:1 on the cyan, 5.01:1 on the pink, 7.14:1 on the
 * orange. That is a gain — skate's old `--blue` cleared nothing either way
 * (4.18 on ink, 4.46 on paper) and was the palette's long-standing AA failure
 * on a sport chip.
 */
export const SPORTS = {
  scooter: {
    id: 'scooter',
    label: 'Scooter',
    short: 'Scooter',
    /** The scooter splash. Ink on it is 11.66:1 — the best of the three. */
    color: '#00E0ED',
    icon: 'scoot',
    kit: "Scooter, helmet, and pads once you're on ramps",
    blurb: 'Whips, bar spins and grinds on a stunt scooter',
  },
  skate: {
    id: 'skate',
    label: 'Skateboard',
    short: 'Skate',
    /**
     * The skateboard splash. Ink on it is 5.01:1, so this is the one place the
     * repaint fixed an accessibility failure rather than only a mismatch: the
     * old `--blue` reached 4.18:1 on ink and 4.46:1 on paper and cleared AA
     * neither way (`contrast.ts`). `--blue` itself is untouched and still
     * misses — it is Park's colour, and that is the owner's call to make
     * separately.
     */
    color: '#FF007B',
    icon: 'board',
    kit: 'Skateboard, helmet, and pads for any transition',
    blurb: 'Flip tricks, ledges, rails and transition',
  },
  bmx: {
    id: 'bmx',
    label: 'BMX',
    short: 'BMX',
    /**
     * The BMX splash. Ink on it is 7.14:1.
     *
     * **This supersedes the 2026-08-16 decision** (Rachid, in chat), which
     * settled BMX on `--pink` (`#FF3D78`) and reasoned that "the palette does
     * not gain a colour" because every token already had a job and BMX should
     * share rather than take, the way `--orange` was scooter *and* Street and
     * `--blue` was skate *and* Park. That is no longer how sport colour works:
     * **Rachid, 2026-09-17, in chat** — "the colours defined for each type
     * should match the main colour in the image now". The sport colours are the
     * art's colours, they are no longer shared with `--orange`, `--blue` or
     * `--pink`, and the palette did not gain a token — these three values live
     * here and nowhere else.
     *
     * What the old note worried about has therefore gone away rather than been
     * solved: link hover is still `--pink`, but `--pink` no longer also means
     * BMX, so there is nothing left to disentangle.
     *
     * Worth knowing, since it is the one thing that looks like a mistake: BMX is
     * orange and Street is orange, and they are **different oranges** (#FF7700
     * against `--orange` #FF5A1F). They are never the same control — a sport
     * chip and a category tag — but anyone matching them by eye should not
     * "correct" one to the other.
     */
    color: '#FF7700',
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
