import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Modal } from './overlays';

/**
 * What `Modal` hands the browser. The behaviour behind it — the page held,
 * focus in and back — needs a real page and is in `e2e/stickers.spec.ts`;
 * this pins the markup that behaviour depends on, and that a caller who passes
 * none of the new props gets exactly the modal they had.
 */

const noop = () => {};

describe('a modal with only the props it always had', () => {
  const html = renderToStaticMarkup(
    <Modal onClose={noop} label="Kickflip" width={400}>
      <p>Body</p>
    </Modal>,
  );

  it('is a labelled modal dialog', () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Kickflip"');
    expect(html).toContain('width:min(400px,100%)');
  });

  // The panel takes focus on open, which it can only do with a tabindex.
  it('can hold focus without joining the tab order', () => {
    expect(html).toContain('tabindex="-1"');
  });

  it('grows no title bar and no footer', () => {
    expect(html).not.toContain('modal-head');
    expect(html).not.toContain('modal-foot');
    expect(html).not.toContain('aria-labelledby');
  });
});

describe('a modal with a title and a footer', () => {
  const html = renderToStaticMarkup(
    <Modal onClose={noop} title="Edit trick" footer={<button type="button">Save</button>}>
      <p>Body</p>
    </Modal>,
  );

  it('is named by its title when it has no label', () => {
    const id = /<h2 id="([^"]+)" class="d modal-title">Edit trick<\/h2>/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`aria-labelledby="${id}"`);
  });

  it('puts a Close a thumb can hit in the title bar', () => {
    expect(html).toMatch(/class="modal-head".*aria-label="Close"/);
    expect(html).toContain('class="modal-close"');
  });

  it('puts the footer after the body, where a sticky bottom bar belongs', () => {
    expect(html.indexOf('<p>Body</p>')).toBeLessThan(html.indexOf('class="modal-foot"'));
  });

  it('keeps an explicit label over the title', () => {
    const labelled = renderToStaticMarkup(
      <Modal onClose={noop} label="Staff edit" title="Edit trick">
        <p>Body</p>
      </Modal>,
    );
    expect(labelled).toContain('aria-label="Staff edit"');
    expect(labelled).not.toContain('aria-labelledby');
  });
});
