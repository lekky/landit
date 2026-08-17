import { CONTACT } from '@landit/core';
import { Panel } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import siteStyles from '@/components/site/site.module.css';
import { Wordmark } from '@/components/site/Wordmark';
import { LEGAL_DOCS, LEGAL_DRAFT_NOTICE, legalDoc } from '@/content/legal';
import { ROUTES, legalHref } from '@/lib/routes';

import styles from '../legal.module.css';

/**
 * One legal document (screenshot 03): the index down the left, the document on
 * the right, and the "Something not right?" panel at the end.
 *
 * The prototype held the whole set in one component and swapped it with state.
 * Five real URLs is what the footer, a search engine and a parent following a
 * link all need — and it is what makes the copy quotable.
 *
 * The copy itself is in `content/legal.ts`, along with why parts of it are a
 * rewrite rather than a transcription.
 */

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ doc: d.id }));
}

export async function generateMetadata(props: PageProps<'/legal/[doc]'>): Promise<Metadata> {
  const { doc: id } = await props.params;
  const doc = legalDoc(id);
  if (!doc) return {};
  return { title: `${doc.title} · Land The Trick`, description: doc.intro };
}

export default async function LegalDocPage(props: PageProps<'/legal/[doc]'>) {
  const { doc: id } = await props.params;
  const doc = legalDoc(id);
  if (!doc) notFound();

  return (
    <div className={siteStyles.wash}>
      <div className={siteStyles.bar}>
        <Wordmark href={ROUTES.home} />
        <Link className={`btn sm ghost ${siteStyles.barEnd}`} href={ROUTES.home}>
          Back
        </Link>
      </div>

      <div className={styles.body}>
        <div className={styles.grid}>
          <Panel flat className={styles.index} aria-label="The small print">
            <div className={`lab ${styles.indexTitle}`}>The small print</div>
            <nav className={styles.indexLinks}>
              {LEGAL_DOCS.map((entry) => {
                const on = entry.id === doc.id;
                return (
                  <Link
                    key={entry.id}
                    href={legalHref(entry.id)}
                    className={`cond ${styles.indexLink} ${on ? styles.indexLinkOn : ''}`}
                    aria-current={on ? 'page' : undefined}
                  >
                    {entry.title}
                  </Link>
                );
              })}
            </nav>
          </Panel>

          <div>
            <span className="eyebrow">Land The Trick · {doc.updated}</span>
            <h1 className={`d ${styles.title}`}>{doc.title}</h1>
            <p className={styles.intro}>{doc.intro}</p>

            <Panel flat className={styles.notice}>
              <span className={`lab ${styles.noticeText}`}>{LEGAL_DRAFT_NOTICE}</span>
            </Panel>

            <div className={styles.sections}>
              {doc.sections.map((section) => (
                <section key={section.h}>
                  <div className={`sechead ${styles.sectionHead}`}>
                    <h2>{section.h}</h2>
                    <span className="rule" />
                  </div>
                  <div className={styles.paragraphs}>
                    {section.p.map((line) => (
                      <p key={line} className={styles.paragraph}>
                        {line}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <Panel className={styles.contact}>
              <div className={styles.contactCopy}>
                <div className={`d ${styles.contactTitle}`}>Something not right?</div>
                <p className={styles.contactText}>
                  Tell us and we will fix it. {CONTACT.hello}, or {CONTACT.safeguarding} if it is
                  about a rider&rsquo;s safety.
                </p>
              </div>
              {/*
                T18. The reporting route has to be *easy* to be the one the OSA
                codes ask for, and the legal pages are where somebody looking for
                it ends up. No account needed on the other side of this link.
              */}
              <Link className="btn" href={ROUTES.report}>
                Report something
              </Link>
              <Link className="btn ghost" href={ROUTES.home}>
                Back to Land The Trick
              </Link>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
