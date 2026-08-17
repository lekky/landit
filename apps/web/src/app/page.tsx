import { CATS, SPORT_IDS, STAGE, TRICKS, type Trick } from '@landit/core';
import { Icon, Panel, Tag, TrickCard, type IconName } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';

import siteStyles from '@/components/site/site.module.css';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Wordmark } from '@/components/site/Wordmark';
import { ROUTES } from '@/lib/routes';
import { SPORT_LOOKS, countWord, sentenceCase, sportsChoicePhrase, sportsList } from '@/lib/sports';

import styles from './landing.module.css';

/**
 * The landing page (screenshots 01 and 02).
 *
 * Signed out. The two calls to action and the top bar's Sign in were disabled
 * buttons until T6 built the pages they point at; they are ordinary links now,
 * and `AUTH_ROUTES_LIVE` is gone with them (`lib/routes.ts`).
 *
 * Every sentence that names the sports is generated from `SPORT_IDS`
 * (`lib/sports.ts`). It reads exactly as the screenshots do while there are
 * two, and says three the day T21 lands BMX — this page needs no BMX edit.
 */

export const metadata: Metadata = {
  title: 'Land The Trick · Every trick you can do, proven',
  description: `A trick tracker for ${sportsList()} riders. Log what you're learning, what you want next, and how well you have actually got it.`,
};

/** The four cards in the hero, from the design pack. */
const SAMPLE_TRICK_IDS = ['bunny-hop', 'sk-kickflip', 'tailwhip', 'sk-50-50'];
const SAMPLE_HUES = ['#FFC23F', '#FF8FB4', '#3AC0FF', '#9CE05B'];

function sampleTrick(id: string): Trick {
  const trick = TRICKS.find((t) => t.id === id);
  // Canonical data lives in the same repo, so a miss is a rename that needs
  // following up here, not a runtime condition to paper over.
  if (!trick) throw new Error(`Landing page references unknown trick "${id}"`);
  return trick;
}

const FEATURES: readonly { icon: IconName; hue: string; title: string; copy: string }[] = [
  {
    icon: 'grid',
    hue: 'var(--sky)',
    title: `${sentenceCase(countWord(SPORT_IDS.length))} full libraries`,
    copy: `${sentenceCase(sportsList())}, side by side. Every trick with the lowdown, tips and a fact worth repeating.`,
  },
  {
    icon: 'chart',
    hue: 'var(--lime)',
    title: 'Five honest stages',
    copy: 'Want it, learning it, sometimes, most times, every time. No fake progress bars.',
  },
  {
    icon: 'star',
    hue: 'var(--pink)',
    title: 'Stickers you earn',
    copy: 'Hit a milestone, unlock the sticker. Paid riders get the real vinyl posted out.',
  },
  {
    icon: 'users',
    hue: 'var(--orange)',
    title: 'Your crew',
    copy: "See what your mates just landed and who's on the longest streak.",
  },
];

export default function LandingPage() {
  const landed = STAGE.every;

  return (
    <div className={siteStyles.wash}>
      <div className={siteStyles.bar}>
        <Wordmark />
        <span className={siteStyles.barEnd}>
          <Link href={ROUTES.signIn} className="btn ghost sm">
            Sign in
          </Link>
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.hero}>
          <div>
            <Tag color="var(--violet)" style={{ fontSize: 12 }}>
              {sportsList()} · free forever tier
            </Tag>
            <h1 className={`d ${styles.headline}`}>
              Every trick
              <br />
              you can do.
              <br />
              <span className={styles.proven}>Proven.</span>
            </h1>
            <p className={styles.lede}>
              {sportsChoicePhrase()}. Log what you&rsquo;re learning, what you want next, and how
              well you&rsquo;ve actually got it. Earn stickers you can hold. Beat your crew.
            </p>
            <div className={styles.ctas}>
              <Link href={ROUTES.signUp} className={`btn ${styles.cta}`}>
                Start tracking, free
              </Link>
              <Link href={ROUTES.signIn} className={`btn ghost ${styles.cta}`}>
                I&rsquo;ve got an account
              </Link>
            </div>
          </div>

          <div className={styles.cards}>
            {SAMPLE_TRICK_IDS.map((id, i) => {
              const trick = sampleTrick(id);
              const isLanded = i < 2;
              return (
                <TrickCard
                  key={trick.id}
                  name={trick.name}
                  category={{ label: CATS[trick.cat].label, color: CATS[trick.cat].color }}
                  difficulty={trick.diff}
                  sport={SPORT_LOOKS[trick.sport]}
                  showSport={false}
                  stage={
                    isLanded ? { id: landed.id, label: landed.label, color: landed.color } : null
                  }
                  background={SAMPLE_HUES[i]}
                  style={{ transform: `rotate(${i % 2 ? 1.6 : -1.8}deg)`, cursor: 'default' }}
                />
              );
            })}
          </div>
        </div>

        <div className={styles.features}>
          {FEATURES.map((feature, i) => (
            <Panel
              key={feature.title}
              flat
              className={styles.feature}
              style={{ background: i === 1 ? 'var(--paper-2)' : 'var(--paper)' }}
            >
              <div className={styles.featureIcon} style={{ background: feature.hue }}>
                <Icon name={feature.icon} size={21} strokeWidth={2.4} />
              </div>
              <div className={`d ${styles.featureTitle}`}>{feature.title}</div>
              <p className={styles.featureCopy}>{feature.copy}</p>
            </Panel>
          ))}
        </div>
      </div>

      <SiteFooter compact />
    </div>
  );
}
