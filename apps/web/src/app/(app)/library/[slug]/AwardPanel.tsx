import { stickerCondition, type Sticker } from '@landit/core';
import { StickerBadge, type IconName } from '@landit/ui-web';

import styles from './trick.module.css';

/**
 * The trick's own award badge, where the design pack put a photo placeholder.
 *
 * The handoff specified a photograph here (`design-handoff/README.md`: "every
 * image slot is a hatched placeholder… these need real photography before
 * launch"), and until this shipped the live page showed riders that
 * placeholder — a hatched box captioned "Trick photo: drop a shot of this
 * trick", an instruction addressed to a designer, on a product children use.
 * Photography for ninety-seven tricks never arrived and generated art for them
 * was judged not worth having (owner, 2026-08-30, in chat), so the slot takes
 * the art the product already owns: T24 committed one printed badge per trick
 * in the library, and `tailwhip.png` is a scooter mid-whip. The image problem
 * was solved once already; this only puts the answer on the page.
 *
 * It earns the space twice. It is the picture the column wanted, and it is the
 * only place before the sticker wall where a rider can see what landing this
 * particular trick gets them.
 *
 * **Earned is the server's answer.** The badge is drawn from `rider_stickers`,
 * never from evaluating the rule here — `createRule` is `null` and the award
 * hook is the only thing that can make the row (plan §3), so a page that drew
 * its own conclusion could show a child a badge they do not hold. The locked
 * treatment is the sticker wall's, unchanged: grayscale at 45%, no hover tilt.
 */
export function AwardPanel({
  award,
  earnedLabel,
  accent,
}: {
  /** The live `stickers` record for this trick, mapped for the badge. */
  award: {
    readonly name: string;
    readonly hue: string;
    readonly icon: string | null;
    readonly img: string | null;
    /** Staff copy — "Land the Tailwhip". Shown while it is still to earn. */
    readonly cond: string;
    readonly n: number | null;
  };
  /** "Earned 12 Aug 2026", or null when it is not earned (or nobody is signed in). */
  earnedLabel: string | null;
  /** The category colour, so the label matches "The lowdown" above it. */
  accent: string;
}) {
  const earned = earnedLabel !== null;

  /*
   * `stickerCondition` rather than `award.cond`, so a threshold staff edit
   * reaches this line the way it reaches the wall. A trick award carries no
   * `n` today; using the shared function means it stays right if one ever does
   * (LESSONS §4 — a unit written into a screen is a unit nobody sweeps).
   */
  const asSticker: Sticker = {
    id: '',
    name: award.name,
    sport: null,
    hue: award.hue,
    ico: award.icon ?? '',
    cond: award.cond,
    ...(award.n ? { n: award.n } : {}),
    isLive: true,
  };

  return (
    <div className={styles.award}>
      <div className={styles.awardArt}>
        <StickerBadge
          sticker={{
            name: award.name,
            hue: award.hue,
            ...(award.icon ? { icon: award.icon as IconName } : {}),
            ...(award.img ? { img: award.img } : {}),
          }}
          earned={earned}
        />
      </div>
      <div className={styles.awardText}>
        <div className="lab" style={{ color: accent }}>
          ◆ The award
        </div>
        {/*
          The condition, not the award's name. Every trick award is named after
          its trick, so a name here would be the third "Tailwhip" on one screen
          — the header band has it, and the printed art has it lettered across
          the badge. The condition is the one thing the page does not already
          say, and it is staff copy rather than a sentence written into a
          screen, so a retune reaches it (LESSONS §4).
        */}
        <div className={`d ${styles.awardCond}`}>{stickerCondition(asSticker)}</div>
        {/* Only once it is earned. Unearned, the condition above has said it. */}
        {earned && <p className={styles.awardState}>{earnedLabel}</p>}
      </div>
    </div>
  );
}
