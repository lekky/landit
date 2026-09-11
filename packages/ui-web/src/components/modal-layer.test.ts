import { describe, expect, it } from 'vitest';

import { inertOutside, lockPageScroll, type PageHost } from './modal-layer';

/**
 * The two halves of `useModalLayer` that do arithmetic on the page, proved
 * without a browser.
 *
 * This package has no DOM test environment, and adding one for two functions
 * would be a dependency bought for a test. So each function takes the narrow
 * slice of the page it touches, and these hand it a fake of exactly that
 * slice. What only a real browser can show — that the page does not move
 * under a finger, that focus lands inside — is `e2e/stickers.spec.ts`.
 */

function page({ scrollY = 480, scrollbar = 0 } = {}) {
  const style = { position: '', top: '', left: '', right: '', overflow: '', paddingRight: '' };
  const scrolls: number[] = [];
  const host: PageHost = {
    scrollY,
    innerWidth: 1200,
    scrollTo: (_x, y) => {
      scrolls.push(y);
    },
    document: { body: { style }, documentElement: { clientWidth: 1200 - scrollbar } },
  };
  return { host, style, scrolls };
}

describe('lockPageScroll', () => {
  it('holds the body at its offset, and puts the rider back where they were', () => {
    const { host, style, scrolls } = page();
    const release = lockPageScroll(host);

    expect(style).toMatchObject({
      position: 'fixed',
      top: '-480px',
      left: '0',
      right: '0',
      overflow: 'hidden',
    });

    release();
    expect(style).toEqual({
      position: '',
      top: '',
      left: '',
      right: '',
      overflow: '',
      paddingRight: '',
    });
    expect(scrolls).toEqual([480]);
  });

  /*
   * The sticker wall swaps its detail modal for the share card in one render,
   * and `ModalProvider` can open over a screen's own modal. A lock that let go
   * on the first close would drop the page under a modal still open.
   */
  it('lets go only when the last of two stacked modals closes', () => {
    const { host, style, scrolls } = page();
    const first = lockPageScroll(host);
    const second = lockPageScroll(host);

    first();
    expect(style.position).toBe('fixed');
    expect(scrolls).toEqual([]);

    second();
    expect(style.position).toBe('');
    expect(scrolls).toEqual([480]);
  });

  // React runs every effect's cleanup twice in development. A count that went
  // negative would leave the next modal unable to hold the page at all.
  it('treats a second release as nothing', () => {
    const { host, style } = page();
    const release = lockPageScroll(host);
    release();
    release();

    const next = lockPageScroll(host);
    expect(style.position).toBe('fixed');
    next();
    expect(style.position).toBe('');
  });

  /*
   * The spots sheet holds the page the same way and does not use this counter.
   * With the body already fixed `scrollY` reads 0, so holding it again would
   * write `top: 0` over the sheet's offset and throw the page to the top.
   */
  it('leaves alone a page something else is already holding', () => {
    const { host, style, scrolls } = page({ scrollY: 0 });
    style.position = 'fixed';
    style.top = '-900px';

    const release = lockPageScroll(host);
    release();

    expect(style.position).toBe('fixed');
    expect(style.top).toBe('-900px');
    expect(scrolls).toEqual([]);
  });

  it('pads a desktop scrollbar back on, so nothing shifts sideways', () => {
    const { host, style } = page({ scrollbar: 15 });
    const release = lockPageScroll(host);
    expect(style.paddingRight).toBe('15px');
    release();
    expect(style.paddingRight).toBe('');
  });

  it('puts back inline styles it found, rather than clearing them', () => {
    const { host, style } = page();
    style.overflow = 'clip';
    const release = lockPageScroll(host);
    release();
    expect(style.overflow).toBe('clip');
  });
});

/**
 * Just enough of an element for `inertOutside`: a tree, `inert`, and the one
 * selector it asks about. `matches` and `querySelector` answer "is this a live
 * region", which is the only question the function puts to them.
 */
class Node {
  readonly tagName: string;
  readonly attrs: Record<string, string>;
  readonly children: Node[] = [];
  parentElement: Node | null = null;
  inert = false;
  ownerDocument: { body: Node } = { body: this };

  constructor(tagName: string, attrs: Record<string, string> = {}) {
    this.tagName = tagName;
    this.attrs = attrs;
  }

  append(...kids: Node[]): this {
    for (const kid of kids) {
      kid.parentElement = this;
      this.children.push(kid);
    }
    return this;
  }

  matches(): boolean {
    return 'aria-live' in this.attrs || ['status', 'alert', 'log'].includes(this.attrs.role ?? '');
  }

  querySelector(): Node | null {
    for (const child of this.children) {
      if (child.matches()) return child;
      const found = child.querySelector();
      if (found) return found;
    }
    return null;
  }
}

/** The signed-in shell with a screen's own modal open inside `<main>`. */
function shell() {
  const panel = new Node('DIV');
  const scrim = new Node('DIV').append(panel);
  const content = new Node('DIV');
  const main = new Node('MAIN').append(content, scrim);
  const skip = new Node('A');
  const topbar = new Node('HEADER');
  const footer = new Node('FOOTER');
  const mobnav = new Node('NAV');
  const app = new Node('DIV').append(skip, topbar, main, footer, mobnav);
  const toasts = new Node('DIV', { role: 'status', 'aria-live': 'polite' });
  const announcer = new Node('DIV', { 'aria-live': 'assertive' });
  const other = new Node('DIV');
  const wrapper = new Node('DIV').append(announcer, other);
  const script = new Node('SCRIPT');
  const body = new Node('BODY').append(app, toasts, wrapper, script);

  const all = [panel, scrim, content, main, skip, topbar, footer, mobnav, app];
  for (const node of [...all, toasts, announcer, other, wrapper, script, body]) {
    node.ownerDocument = { body };
  }
  const el = (node: Node) => node as unknown as HTMLElement;
  // The live regions, the wrapper and the script are reached through `app`'s
  // siblings, which is where they sit in the real document.
  return { el, panel, scrim, content, main, skip, topbar, footer, mobnav, app };
}

describe('inertOutside', () => {
  it('shuts everything but the dialog and the elements holding it', () => {
    const s = shell();
    const reveal = inertOutside(s.el(s.panel));

    // The rest of the screen, and the shell around <main>.
    for (const node of [s.content, s.skip, s.topbar, s.footer, s.mobnav]) {
      expect(node.inert).toBe(true);
    }
    // The path to the dialog stays live, or the dialog would be inert too.
    for (const node of [s.panel, s.scrim, s.main, s.app]) expect(node.inert).toBe(false);

    reveal();
    for (const node of [s.content, s.skip, s.topbar, s.footer, s.mobnav]) {
      expect(node.inert).toBe(false);
    }
  });

  it('steps round live regions, so a toast raised from a modal is still heard', () => {
    const s = shell();
    const body = s.app.parentElement!;
    const [, toasts, wrapper, script] = body.children as [Node, Node, Node, Node];
    const [announcer, other] = wrapper.children as [Node, Node];

    const reveal = inertOutside(s.el(s.panel));
    expect(toasts.inert).toBe(false);
    // A wrapper holding a live region is walked into, not shut whole.
    expect(wrapper.inert).toBe(false);
    expect(announcer.inert).toBe(false);
    expect(other.inert).toBe(true);
    expect(script.inert).toBe(false);
    reveal();
    expect(other.inert).toBe(false);
  });

  it('restores only what it changed', () => {
    const s = shell();
    s.footer.inert = true;
    const reveal = inertOutside(s.el(s.panel));
    reveal();
    expect(s.footer.inert).toBe(true);
    expect(s.topbar.inert).toBe(false);
  });

  it('stacks: a second modal shuts the first, and closing it hands the page back to the first', () => {
    const s = shell();
    const closeFirst = inertOutside(s.el(s.panel));

    // A second modal opened later, beside the first inside <main>.
    const secondPanel = new Node('DIV');
    const secondScrim = new Node('DIV').append(secondPanel);
    s.main.append(secondScrim);
    for (const node of [secondPanel, secondScrim]) node.ownerDocument = s.panel.ownerDocument;

    const closeSecond = inertOutside(s.el(secondPanel));
    expect(s.scrim.inert).toBe(true);
    expect(secondScrim.inert).toBe(false);

    closeSecond();
    expect(s.scrim.inert).toBe(false);
    // Still the first modal's to restore.
    expect(s.content.inert).toBe(true);

    closeFirst();
    expect(s.content.inert).toBe(false);
  });
});
