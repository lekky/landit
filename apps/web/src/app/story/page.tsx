import { Panel } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';

import siteStyles from '@/components/site/site.module.css';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Wordmark } from '@/components/site/Wordmark';
import {
  STORY,
  STORY_BYLINE,
  STORY_DESCRIPTION,
  STORY_TITLE,
  STORY_UPDATED,
  type StoryBlock,
} from '@/content/story';
import { LandingCta } from '@/app/LandingCta';
import { ROUTES } from '@/lib/routes';

import { StoryPhotos } from './StoryPhotos';
import styles from './story.module.css';

/**
 * Why Land The Trick exists, in the words of the rider whose idea it was.
 *
 * Statically rendered, and every word of it comes from `content/story.ts`,
 * which is also where the note lives about what may and may not be said on a
 * page that names a child, and the rule that the prose here carries no em
 * dashes. Read that file before editing this one.
 *
 * The photos live in `StoryPhotos`, the page's one interactive piece: the
 * frames are small so the page still reads as writing with photographs in it,
 * and pressing one opens it whole. `StoryPhoto.src` stays optional so a photo
 * can be written in before it has been taken, and gets an honest empty frame
 * of the right footprint rather than a broken `<img>` on a live page.
 */

export const metadata: Metadata = {
  title: 'Why we made this · Land The Trick',
  description: STORY_DESCRIPTION,
  alternates: { canonical: ROUTES.story },
  openGraph: {
    title: 'Why we made this · Land The Trick',
    description: STORY_DESCRIPTION,
    url: ROUTES.story,
    type: 'article',
  },
};

function Block({ block }: { block: StoryBlock }) {
  switch (block.kind) {
    case 'lead':
      return <p className={styles.lead}>{block.text}</p>;
    case 'quote':
      return (
        <p className={`d ${styles.quote} ${block.big ? styles.quoteBig : ''}`}>{block.text}</p>
      );
    case 'photos':
      return <StoryPhotos items={block.items} layout={block.layout} />;
    case 'p':
    default:
      return <p className={styles.paragraph}>{block.text}</p>;
  }
}

export default function StoryPage() {
  return (
    <div className={siteStyles.wash}>
      <div className={siteStyles.bar}>
        <Wordmark href={ROUTES.home} />
        <Link className={`btn sm ghost ${siteStyles.barEnd}`} href={ROUTES.home}>
          Back
        </Link>
      </div>

      <div className={styles.body}>
        <span className="eyebrow">Land The Trick · {STORY_UPDATED}</span>
        <h1 className={`d ${styles.title}`}>{STORY_TITLE}</h1>
        <p className={`lab ${styles.byline}`}>{STORY_BYLINE}</p>

        <div className={styles.chapters}>
          {STORY.map((chapter) => (
            <section key={chapter.id} id={chapter.id}>
              {chapter.heading ? (
                <div className={`sechead ${styles.chapterHead}`}>
                  <h2>{chapter.heading}</h2>
                  <span className="rule" />
                </div>
              ) : null}
              <div className={styles.blocks}>
                {chapter.blocks.map((block, i) => (
                  // The index is the key because a chapter's blocks are a fixed
                  // literal in `content/story.ts`: they are never reordered,
                  // filtered or appended to at runtime, and two paragraphs are
                  // allowed to hold identical text.
                  <Block key={`${chapter.id}-${i}`} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/*
          Where the page sends you. `LandingCta` rather than a plain `Link`
          because it is the thing that counts the press, and it counts it into
          the same `landing_cta` funnel the landing page uses, and `place:
          'story'` is what separates them. It and `StoryPhotos` are the only
          client components on this page, so the prose itself ships none.
        */}
        <Panel className={styles.end}>
          <div className={styles.endCopy}>
            <div className={`d ${styles.endTitle}`}>Track your own tricks</div>
            <p className={styles.endText}>
              Every trick, five honest stages, and the next thing to learn. Free to start, and the
              free tier does not expire.
            </p>
          </div>
          <div className={styles.endActions}>
            <LandingCta className="btn" href={ROUTES.signUp} target="signup" place="story">
              Start tracking
            </LandingCta>
            <LandingCta className="btn ghost" href={ROUTES.library} target="library" place="story">
              Browse the tricks
            </LandingCta>
          </div>
        </Panel>
      </div>

      <SiteFooter />
    </div>
  );
}
