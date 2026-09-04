import { PLANS, TRICKS } from '@landit/core';
import { Icon, foregroundFor, stickerArtSrc } from '@landit/ui-web';
import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';

import siteStyles from '@/components/site/site.module.css';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Wordmark } from '@/components/site/Wordmark';
import { seasonGrid, seasonLegend } from '@/lib/landingSeason';
import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';
import { sportsList } from '@/lib/sports';

import { HeroSignUp } from './HeroSignUp';
import { LandingCta } from './LandingCta';
import { LandingMotion } from './LandingMotion';
import styles from './landing.module.css';

/**
 * The landing page — "the wall" (design pack `design_handoff_landing_wall`,
 * desktop and mobile screenshots 01–05).
 *
 * It replaced a shorter page whose whole argument was a hero and four feature
 * panels. This one makes the case in one scroll: what the product is, the three
 * steps of using it, what a season ends up looking like, the four questions a
 * parent asks, and a way in. Two of the calls to action go somewhere without an
 * account at all — `/spots` and `/events` both read signed out — which is the
 * point of them: a stranger can see something real before deciding.
 *
 * **A signed-in rider never sees it**, as before. `/` is the sales pitch and a
 * rider who has bought the argument gets their dashboard.
 *
 * ## Three things worth knowing before editing
 *
 * **No counts, deliberately.** The pack forbids stating trick, park or event
 * numbers anywhere: they change, and a page that says "412 tricks" is wrong the
 * week somebody adds one. "Hundreds of tricks", "parks near you", "jams and
 * comps". The only fixed numbers allowed are the five stages and the prices,
 * and the prices below come from `PLANS` rather than being typed out, so the
 * FAQ cannot drift away from what Stripe actually charges.
 *
 * **The sports are generated**, the way the old page did it — `sportsList()`
 * from `SPORT_IDS`. The one hard-coded "three" the pack asked for is gone with
 * it.
 *
 * **What the FAQ does not say.** The pack's fourth answer had Legend "posts
 * your earned stickers out as real vinyl". `PLANS` has no such perk, and issue
 * #181 records that the product does not do it — so the clause is dropped
 * (owner, 2026-09-04, in chat) rather than shipped onto a live page with a live
 * checkout behind it. The old landing page carried the same claim and it goes
 * with this rewrite.
 */

export const metadata: Metadata = {
  title: 'Land The Trick · Track your progress and land the trick',
  description: `A trick tracker for ${sportsList()} riders. Log what you have landed, rate how solid it is, line up what is next.`,
  /*
   * The canonical URL for this page.
   *
   * The app answers on more than one host — `www.landthetrick.com` serves the
   * whole site alongside the apex — and nothing was telling a search engine
   * which of the two to keep, so every public page existed twice with no way to
   * tell which was the original. A canonical says. It also folds away the query
   * strings the app puts on its own URLs, `?mine=1` and `?next=` among them,
   * which are views of a page rather than pages.
   *
   * A path, not an absolute URL: Next resolves it against the `metadataBase`
   * that `app/layout.tsx` takes from `SITE_URL`, so the domain stays one fact
   * in one place. The host redirect is the real fix and is infrastructure
   * rather than code (issue filed); this is what makes the ambiguity harmless
   * in the meantime, and it is worth having either way.
   */
  alternates: { canonical: ROUTES.home },
};

/** Pence to the string the FAQ says, so the copy cannot drift from checkout. */
function price(planId: string): string {
  const plan = PLANS.find((p) => p.id === planId);
  // Canonical data in the same repo: a miss is a rename to follow up here.
  if (!plan) throw new Error(`Landing page references unknown plan "${planId}"`);
  return `£${(plan.priceMonthlyPence / 100).toFixed(2)}`;
}

/**
 * The hero's backdrop: real trick names, rotated and dimmed behind the scrim.
 *
 * Purely cosmetic and `aria-hidden` — 96 tiles of trick names is texture, not
 * content, and a screen reader working through them before reaching the
 * headline would be a worse page than one with no backdrop at all. Taken from
 * the front of `TRICKS` rather than sampled, so the render is deterministic and
 * the server and client markup agree.
 */
const WALL_TILES = 96;
const wallNames = Array.from(
  { length: WALL_TILES },
  (_, i) => TRICKS[i % TRICKS.length]!.name,
) as readonly string[];

const FEATURE_ROWS = [
  {
    eyebrow: 'Step one',
    title: "Tick off what you've already got",
    copy: 'Three libraries, hundreds of tricks, every one with its own page. Start by marking the ones you can already do — most riders find a dozen in the first ten minutes — and the wall starts filling in from there.',
    img: '/marketing/library.png',
    alt: 'The scooter trick library, each trick showing its category, difficulty and tracking status',
    chip: 'No app store — add it to your home screen',
    cap: null,
  },
  {
    eyebrow: 'Step two',
    title: 'Rate it honestly',
    copy: '"Landed it once" and "lands it every single time" are not the same trick. Five stages instead of a percentage: want it, learning it, sometimes, most times, every time. Move up to sometimes and the trick counts as landed, dated, with the sticker to go with it.',
    img: '/marketing/trick-page.png',
    alt: 'A trick page showing the Landed stamp, the five stages and the lowdown',
    chip: null,
    cap: 'Trick page · the stage is the whole score',
  },
  {
    eyebrow: 'Step three',
    title: 'See what opens up next',
    copy: 'Tricks unlock tricks. Every prerequisite is mapped, so landing a manual opens the column behind it and the thing you should be trying tonight is never a guess. No coach, no forum, no scrolling through clips looking for a tutorial.',
    img: '/marketing/skill-tree.png',
    alt: 'The skill tree, showing flat tricks in stage one unlocking the stage behind them',
    chip: null,
    cap: 'Skill tree · flat, street, park and air',
  },
  {
    eyebrow: 'What you end up with',
    title: 'A profile that actually means something',
    copy: 'Not follower counts. Tricks, stages, the date each one landed and the parks they happened at — and you choose who sees it. Surname and email are never shown, and there is no messaging anywhere in the app.',
    img: '/marketing/profile.png',
    alt: 'A rider profile showing landed tricks, the weekly streak, stickers and the privacy control',
    chip: null,
    cap: 'Rider profile · you choose who sees it',
  },
] as const;

export default async function LandingPage() {
  if (await currentRider()) redirect(ROUTES.dashboard);

  const tiles = seasonGrid();
  const legend = seasonLegend();

  return (
    <div className={`${siteStyles.wash} ${styles.page}`}>
      <LandingMotion />

      <header className={siteStyles.bar}>
        <Wordmark href={ROUTES.home} />
        <nav className={styles.nav} aria-label="Main">
          <LandingCta href={ROUTES.library} target="library" place="bar" className={styles.navLink}>
            Trick library
          </LandingCta>
          <LandingCta href={ROUTES.spots} target="spots" place="bar" className={styles.navLink}>
            Spots
          </LandingCta>
          <LandingCta href={ROUTES.events} target="events" place="bar" className={styles.navLink}>
            Events
          </LandingCta>
          <LandingCta href={ROUTES.plans} target="plans" place="bar" className={styles.navLink}>
            Plans
          </LandingCta>
        </nav>
        <span className={styles.barEnd}>
          <LandingCta href={ROUTES.signIn} target="signin" place="bar" className="btn ghost sm">
            Sign in
          </LandingCta>
          <LandingCta href={ROUTES.signUp} target="signup" place="bar" className="btn sm">
            Start free
          </LandingCta>
        </span>
      </header>

      {/* ------------------------------------------------------------- hero */}
      <div className={styles.hero}>
        <div className={styles.wall} aria-hidden="true">
          {wallNames.map((name, i) => (
            // Names repeat by design, so the index is the only stable key.
            <b key={`${name}-${i}`}>{name}</b>
          ))}
        </div>
        <span className={`${styles.splat} ${styles.s1}`} aria-hidden="true" />
        <span className={`${styles.splat} ${styles.s2}`} aria-hidden="true" />
        <span className={`${styles.splat} ${styles.s3}`} aria-hidden="true" />
        <span className={`${styles.splat} ${styles.s4}`} aria-hidden="true" />
        <div className={styles.scrim} aria-hidden="true" />

        <div className={styles.heroIn}>
          <h1 className={styles.headline}>Track your progress and</h1>

          {/*
           * The wordmark is the second half of the headline — the sentence
           * reads "Track your progress and land the trick" — so it carries the
           * alt text rather than being decorative, and `priority` because it is
           * the largest thing above the fold.
           */}
          <span className={styles.lockup}>
            <Image
              src="/brand/wordmark-line-720.png"
              alt="land the trick"
              width={720}
              height={214}
              priority
            />
            <span className={styles.gleam} aria-hidden="true">
              <i />
              <i />
            </span>
          </span>

          <p className={styles.lede}>
            Scooter, skateboard, BMX. Log what you&rsquo;ve landed, rate how solid it is, line up
            what&rsquo;s next. Hundreds of tricks waiting to be ticked off.
          </p>

          <HeroSignUp />

          <div className={styles.trust}>
            <span>
              <Icon name="check" size={15} strokeWidth={3} />
              Free forever tier
            </span>
            <span>
              <Icon name="lock" size={15} strokeWidth={2.6} />
              No messaging, no strangers
            </span>
            <span>
              <Icon name="check" size={15} strokeWidth={3} />
              Works offline at the park
            </span>
          </div>

          {/*
           * The two doors that need no account. Both screens read signed out
           * already, so these are not teasers — they are the product.
           */}
          <div className={styles.peeks}>
            <LandingCta href={ROUTES.spots} target="spots" place="hero" className={styles.peek}>
              <span className={styles.peekIcon} aria-hidden="true">
                <Icon name="map" size={19} strokeWidth={2.4} />
              </span>
              <span className={styles.peekText}>
                <b>Browse the spots</b>
                <span>Parks near you · no sign-up</span>
              </span>
              <span className={styles.peekArrow} aria-hidden="true">
                →
              </span>
            </LandingCta>
            <LandingCta
              href={ROUTES.events}
              target="events"
              place="hero"
              className={`${styles.peek} ${styles.peekEvents}`}
            >
              <span className={styles.peekIcon} aria-hidden="true">
                <Icon name="flag" size={19} strokeWidth={2.4} />
              </span>
              <span className={styles.peekText}>
                <b>What&rsquo;s on</b>
                <span>Jams and comps · no sign-up</span>
              </span>
              <span className={styles.peekArrow} aria-hidden="true">
                →
              </span>
            </LandingCta>
          </div>
        </div>
      </div>

      <div className={styles.stripe} aria-hidden="true">
        <i style={{ background: '#ffc22e' }} />
        <i style={{ background: '#2ec4b6' }} />
        <i style={{ background: '#f5266e' }} />
        <i style={{ background: 'var(--ink)' }} />
      </div>

      <div className={styles.body}>
        {/* ------------------------------------------------- feature rows */}
        {FEATURE_ROWS.map((row, i) => {
          const flipped = i % 2 === 1;
          return (
            <div key={row.title} className={`${styles.row} ${flipped ? styles.rowFlip : ''}`}>
              <div
                className={`${styles.rowText} ${styles.rv} ${flipped ? styles.slideRight : styles.slideLeft}`}
                data-rv
              >
                <span className="eyebrow">{row.eyebrow}</span>
                <h3>{row.title}</h3>
                <p>{row.copy}</p>
                {row.chip ? (
                  <span className={styles.chip}>
                    <Icon name="check" size={15} strokeWidth={3} />
                    {row.chip}
                  </span>
                ) : null}
                {row.cap ? <span className={styles.cap}>{row.cap}</span> : null}
              </div>
              <div
                className={`${styles.shots} ${styles.rv} ${flipped ? styles.slideLeft : styles.slideRight}`}
                data-rv
              >
                <div
                  className={`${styles.phone} ${flipped ? styles.tiltB : styles.tiltA} ${
                    row.img.endsWith('trick-page.png') ? styles.phoneTall : ''
                  }`}
                  data-drift
                >
                  {/*
                   * `sizes` matters more here than the 618px intrinsic width
                   * suggests: the frame draws these at 262px on the desktop
                   * layout and 340px at most on a phone, and without a `sizes`
                   * hint Next serves the 1920px candidate to everybody. That is
                   * the same waste #277 took off the sticker wall, on the one
                   * page where a first-time visitor is paying for it.
                   */}
                  <Image
                    src={row.img}
                    alt={row.alt}
                    width={618}
                    height={1373}
                    sizes="(max-width: 620px) 340px, 262px"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* ------------------------------------------- one rider, one season */}
        <div className={`${styles.section} ${styles.rv}`} data-rv>
          <div className="sechead">
            <h2>One rider, one season</h2>
            <span className="rule" />
          </div>

          <div className={styles.grid}>
            {tiles.map((tile) => {
              const landed = tile.stage !== null;
              return (
                <div
                  key={tile.id}
                  className={`${styles.tile} ${landed ? '' : styles.tileEmpty} ${
                    tile.badge ? styles.tileHasBadge : ''
                  }`}
                  style={
                    landed
                      ? {
                          background: tile.stage!.color,
                          // A fixed stage colour, so the text on it is the pair
                          // that does not follow the theme.
                          color: foregroundFor(tile.stage!.color),
                        }
                      : undefined
                  }
                >
                  <span className={styles.tileName}>{tile.name}</span>
                  <span className={styles.tileStage}>
                    {landed ? tile.stage!.label : 'Not tracked'}
                  </span>
                  {tile.badge?.img ? (
                    <span className={styles.badge}>
                      <Image
                        src={stickerArtSrc(tile.badge.img)}
                        alt={`${tile.badge.name} sticker, earned`}
                        width={34}
                        height={34}
                        sizes="34px"
                      />
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className={styles.legend}>
            {legend.map((entry) => (
              <span key={entry.label}>
                <i
                  className={entry.color ? undefined : styles.legendEmpty}
                  style={entry.color ? { background: entry.color } : undefined}
                />
                {entry.label}
              </span>
            ))}
          </div>

          <p className={styles.gridNote}>
            An example season. Badges are the stickers each trick earned — earned only, never for
            sale, on any plan.
          </p>
        </div>

        {/* ------------------------------------------------------------ FAQ */}
        <div className={`${styles.section} ${styles.rv}`} data-rv>
          <div className={styles.faq}>
            <details open>
              <summary>Is it really free?</summary>
              <p>
                Rookie is free forever. Every Rookie and Easy trick across all three libraries, all
                five stages, the sticker wall, the spots map and your crew. No card, no trial
                countdown, no adverts anywhere in the app.
              </p>
            </details>
            <details>
              <summary>Is there an app to download?</summary>
              <p>
                No app store, no download. Land The Trick runs in the browser and adds to a phone
                home screen in two taps, where it behaves like any other app — full screen, its own
                icon, no address bar. Logging works offline and syncs when you&rsquo;re back on
                data.
              </p>
            </details>
            <details>
              <summary>Can my kid talk to strangers on it?</summary>
              <p>
                No. There is no messaging anywhere in the app and no way to discover other riders.
                Your crew is invite-only, joined with a code from a mate.
              </p>
            </details>
            <details>
              <summary>What do the paid plans add?</summary>
              <p>
                Shredder at {price('shredder')} a month unlocks the Spicy, Gnarly and Pro tricks.
                Legend at {price('legend')} adds the numbers behind your riding — per-category
                trends, personal records and what the skill tree says to try next. Neither plan can
                buy a sticker.
              </p>
            </details>
          </div>
        </div>

        {/* ------------------------------------------------------- CTA band */}
        <div className={`${styles.ctaBand} ${styles.section} ${styles.rv}`} data-rv>
          <div className={styles.ctaText}>
            <h2>Your wall is empty. That&rsquo;s the fun bit.</h2>
            <p>
              Rookie is free forever — every Rookie and Easy trick, all five stages, the whole
              sticker wall.
            </p>
          </div>
          <LandingCta href={ROUTES.signUp} target="signup" place="band" className="btn ink lg">
            Start my wall
          </LandingCta>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
