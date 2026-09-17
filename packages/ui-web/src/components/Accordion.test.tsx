import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Accordion } from './Accordion';

/**
 * What `Accordion` hands the browser — which is the half that has to be right
 * with no JavaScript at all, and the half a server render decides.
 *
 * The behaviour on top of it (the press, the `0fr → 1fr` open, the row a
 * fragment opens, the width past which it stops being a disclosure) needs a
 * real page and a real viewport, and lives in `e2e/library.spec.ts` on the
 * trick page that uses it.
 */

describe('a closed row', () => {
  const html = renderToStaticMarkup(
    <Accordion title="The lowdown" sub="4 common mistakes">
      <p>Body</p>
    </Accordion>,
  );

  it('is a native details, shut', () => {
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).not.toContain('<details class="accordion" open');
  });

  /*
   * The title is a heading, and this is the assertion that notices if it stops
   * being one: a page whose sections are all rows has no outline without it,
   * and a screen-reader rider loses the ability to move between them.
   */
  it('carries its title as a level-2 heading, with the sub-line inside it', () => {
    expect(html).toContain('<h2 class="accordion-title">');
    expect(html).toContain('The lowdown');
    expect(html).toContain('<span class="accordion-sub">4 common mistakes</span>');
  });

  it('renders its body so the open can transition from something', () => {
    expect(html).toContain('accordion-body');
    expect(html).toContain('<p>Body</p>');
    expect(html).not.toContain('is-grown');
  });
});

describe('the props a caller can leave out', () => {
  const html = renderToStaticMarkup(
    <Accordion title="Tips">
      <p>Body</p>
    </Accordion>,
  );

  it('draws no sub-line and takes no id', () => {
    expect(html).not.toContain('accordion-sub');
    expect(html).not.toContain('id="');
  });

  it('is a disclosure at every width until `plainAbove` says otherwise', () => {
    expect(html).not.toContain('accordion-plain');
  });
});

describe('a row that opens on first render', () => {
  const html = renderToStaticMarkup(
    <Accordion title="Your history, notes and videos" id="clips" defaultOpen headingLevel={3}>
      <p>Body</p>
    </Accordion>,
  );

  it('is open, grown, and answers to its fragment', () => {
    expect(html).toContain('open=""');
    expect(html).toContain('is-grown');
    expect(html).toContain('id="clips"');
  });

  it('takes the heading level it was given', () => {
    expect(html).toContain('<h3 class="accordion-title">');
  });
});

/**
 * The server has no width to read, so `plainAbove` answers "phone" there
 * (`useSyncExternalStore`'s server snapshot). That is deliberate — it is what
 * keeps the first client render identical and a hydration mismatch from
 * throwing the tree away — and it is why a caller using it writes the wide
 * form's three declarations into its own media query as well.
 */
describe('a row told to go plain above a width', () => {
  const html = renderToStaticMarkup(
    <Accordion title="Tips" plainAbove={820}>
      <p>Body</p>
    </Accordion>,
  );

  it('still renders as a shut disclosure on the server', () => {
    expect(html).not.toContain('accordion-plain');
    expect(html).not.toContain('open=""');
  });
});
