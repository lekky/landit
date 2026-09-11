'use client';

import { useEffect, useEffectEvent, useState, type RefObject } from 'react';

/**
 * What an open modal does to the page behind it (issue #372).
 *
 * Until this existed the shared `Modal` added an Escape listener and nothing
 * else, and the mobile audit of 2026-09-08 measured what that costs on a phone:
 * a scroll on the sticker detail moved the page behind from 200 to 600 to
 * 1000, focus stayed on the button that opened the dialog (so a screen reader
 * carried on reading the page under the scrim), and after Done it landed on the
 * skip link. Three things fix that, and every modal needs all three, so they
 * live here once: `Modal` calls `useModalLayer`, and so does the one dialog in
 * the product that renders its own scrim (the events screen's detail modal,
 * which owns its markup because its open state is the URL).
 *
 * - **The page is held still** (`lockPageScroll`).
 * - **The page is made inert** (`inertOutside`), so neither a keyboard nor a
 *   screen reader can wander into it while the dialog is up.
 * - **Focus goes in and comes back**: the panel takes focus when it opens and
 *   the element that opened it gets focus back when it closes.
 */

type HeldStyle = 'position' | 'top' | 'left' | 'right' | 'overflow' | 'paddingRight';

/**
 * The slice of `window` the scroll lock touches. Narrow on purpose, so the
 * lock's arithmetic can be tested without a browser — this package has no DOM
 * test environment, and the lock is the part most worth pinning.
 */
export type PageHost = {
  readonly scrollY: number;
  readonly innerWidth: number;
  scrollTo(x: number, y: number): void;
  readonly document: {
    readonly body: { readonly style: Record<HeldStyle, string> };
    readonly documentElement: { readonly clientWidth: number };
  };
};

/** How many open modals are holding the page, and how to let it go. */
let holders = 0;
let releasePage: (() => void) | null = null;

/**
 * Take the body out of flow at its current scroll offset.
 *
 * **`position: fixed` rather than `overflow: hidden`**, for the reason the
 * spots sheet already gives (`SpotsScreen.tsx`): on iOS Safari `overflow:
 * hidden` on the body does not stop touch scrolling, and taking the body out
 * of flow at a negative offset does. Restoring the offset on the way out is
 * what stops the page jumping to the top when the modal closes. Every property
 * is saved and put back rather than cleared.
 *
 * **Something else may already hold the page** — the spots sheet uses the same
 * technique and does not know about this counter. A body that is already fixed
 * reads `scrollY` as 0, so holding it again would write `top: 0` over the
 * sheet's offset and throw the page to the top. So an already-fixed body is
 * left entirely alone, and whoever fixed it restores it.
 *
 * The scrollbar's width is padded back on, because a desktop that loses its
 * scrollbar widens the page by ~15px and every centred thing on it shifts
 * sideways the moment a staff editor opens. Phones have overlay scrollbars and
 * measure 0 here.
 */
function holdPage(host: PageHost): (() => void) | null {
  const { style } = host.document.body;
  if (style.position === 'fixed') return null;

  const offset = host.scrollY;
  const gutter = Math.max(0, host.innerWidth - host.document.documentElement.clientWidth);
  const held: Record<HeldStyle, string> = {
    position: style.position,
    top: style.top,
    left: style.left,
    right: style.right,
    overflow: style.overflow,
    paddingRight: style.paddingRight,
  };

  style.position = 'fixed';
  style.top = `-${offset}px`;
  style.left = '0';
  style.right = '0';
  style.overflow = 'hidden';
  if (gutter > 0) style.paddingRight = `${gutter}px`;

  return () => {
    Object.assign(style, held);
    // Instant: nothing sets `scroll-behavior: smooth` on the document, and a
    // tweened restore would read as the page running away from the rider.
    host.scrollTo(0, offset);
  };
}

/**
 * Hold the page still until the returned function is called.
 *
 * **Counted, so two modals can stack.** The sticker wall closes its detail
 * modal and opens the share card in the same render, and `ModalProvider` can
 * open over a screen's own modal. Only the first holder fixes the body and only
 * the last release restores it; a modal that restored on its own close would
 * drop the page back to its old offset under a modal that is still open.
 * Releasing twice is harmless, which is what React's development double-run of
 * effects does to every caller.
 */
export function lockPageScroll(host: PageHost = window): () => void {
  if (holders === 0) releasePage = holdPage(host);
  holders += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0) {
      releasePage?.();
      releasePage = null;
    }
  };
}

/** Announcements that must still be heard with a modal up: the toast stack. */
const LIVE_REGION = '[aria-live], [role="status"], [role="alert"], [role="log"]';
/** Children of `<body>` that are not content and gain nothing from `inert`. */
const NOT_CONTENT = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT']);

/**
 * Make everything except `keep` and its ancestors `inert`, until the returned
 * function is called.
 *
 * **Why a walk up the tree rather than "the shell's siblings".** `Modal`
 * renders where its caller renders it — there is no portal. A screen's own
 * modal (the sticker detail, the staff editor, the avatar picker) sits inside
 * `<main>`, inside `.app`; only `ModalProvider`'s sits beside `.app`. Marking
 * the shell inert would therefore make most modals inert along with it. So the
 * walk starts at the dialog and, at every level up to `<body>`, marks the
 * siblings of the path: the rest of the screen, then the top bar, footer and
 * bottom bar around `<main>`, then anything beside `.app`. The dialog and the
 * chain of elements holding it are the only things left live.
 *
 * `inert` rather than `aria-hidden`: it removes the page from the tab order and
 * from pointer events as well as from the accessibility tree, which is what
 * `aria-modal="true"` promises and never enforced. Tab therefore cannot leave
 * the dialog, so there is no hand-written focus trap to keep in step with it.
 *
 * **Live regions are stepped round, not shut.** The toast stack is an
 * `aria-live` region beside the page, and a toast raised from inside a modal —
 * "Caption copied" on the share card — has to be announced. An element that is
 * a live region is skipped; one that merely contains one is walked into, so its
 * other children are still shut.
 *
 * Only what this call changed is restored, so an element something else made
 * inert stays inert, and a second modal stacked over the first restores exactly
 * its own set and leaves the first one's in place.
 */
export function inertOutside(keep: HTMLElement): () => void {
  const { body } = keep.ownerDocument;
  const changed: HTMLElement[] = [];

  const shut = (element: Element) => {
    const node = element as HTMLElement;
    if (NOT_CONTENT.has(node.tagName) || node.inert || node.matches(LIVE_REGION)) return;
    if (node.querySelector(LIVE_REGION)) {
      for (const child of Array.from(node.children)) shut(child);
      return;
    }
    node.inert = true;
    changed.push(node);
  };

  for (let node: HTMLElement = keep; node !== body;) {
    const parent = node.parentElement;
    if (!parent) break;
    for (const sibling of Array.from(parent.children)) if (sibling !== node) shut(sibling);
    node = parent;
  }

  return () => {
    for (const node of changed) node.inert = false;
  };
}

/** Open modal layers, oldest first. Only the newest one answers Escape. */
const layers: object[] = [];

/** What a pointer can press that could have opened a modal. */
const PRESSABLE = 'button, a[href], input, select, textarea, summary, [tabindex]';
/** How recent a press must be to count as the one that opened a modal. */
const PRESS_WINDOW_MS = 2000;
let lastPress: { target: HTMLElement; at: number } | null = null;

/*
 * **Safari does not focus what you tap.** On an iPhone — and on a Mac — a
 * button that is tapped or clicked never takes focus, so a modal opened from
 * one finds focus on `<body>` and has nothing to hand it back to when it
 * closes: VoiceOver's cursor is left wherever the browser puts it. Measured
 * under WebKit on 2026-09-11, focus went back to the opener in no flow at all.
 * So the control a pointer last pressed is remembered, and used as the opener
 * only when focus names nobody and the press was a moment ago.
 *
 * One capture-phase, passive listener for the life of the page, installed when
 * this module first loads in a browser — it has to be listening before the
 * first modal opens, since the press that opens it is the one that matters.
 */
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest(PRESSABLE) : null;
      lastPress = target instanceof HTMLElement ? { target, at: Date.now() } : null;
    },
    { capture: true, passive: true },
  );
}

function recentlyPressed(): HTMLElement | null {
  if (!lastPress || Date.now() - lastPress.at > PRESS_WINDOW_MS) return null;
  return lastPress.target.isConnected ? lastPress.target : null;
}

/**
 * Everything a dialog does to the page while it is open: hold it still, make it
 * inert, take focus, give focus back, and close on Escape.
 *
 * `panel` is the element with `role="dialog"`; give it `tabIndex={-1}` so it
 * can hold focus. `onEscape` is called when Escape is pressed and this is the
 * topmost modal — before this, two stacked modals both closed on one press.
 *
 * **Focus goes to the panel, not to its first control**, and with
 * `preventScroll`. A modal taller than the phone scrolls itself to whatever
 * takes focus, so focusing a Close button at the bottom of the events modal
 * opened it half-way down with its title and date off the top. The panel is the
 * top. A screen reader announces the dialog by its label, and Tab goes to the
 * first control from there. A panel whose content already took focus (an
 * `autoFocus` field) keeps it.
 *
 * **Who opened it is read three ways, first answer wins.** Focus when the
 * effect runs, because a modal that replaces another in one render (sticker
 * detail to share card) was rendered while focus sat on a button inside the
 * one being closed, and by the effect that one has already handed focus back
 * to the sticker on the wall. Focus at render, because a child's `autoFocus`
 * runs before any effect and would otherwise be mistaken for the opener. And
 * the control a pointer pressed a moment ago, for Safari, which focuses
 * nothing on a tap (`recentlyPressed`). Anything inside the panel, or the
 * body, is not an answer. On close, focus goes back to the opener if it is
 * still in the document and focus has not deliberately gone somewhere else.
 */
export function useModalLayer(panel: RefObject<HTMLElement | null>, onEscape: () => void): void {
  const [renderedOver] = useState(() =>
    typeof document === 'undefined' ? null : document.activeElement,
  );
  const escape = useEffectEvent(onEscape);

  useEffect(() => {
    const node = panel.current;
    if (!node) return;

    const layer = {};
    layers.push(layer);

    const opener =
      [document.activeElement, renderedOver, recentlyPressed()].find(
        (el) => el instanceof HTMLElement && el !== document.body && !node.contains(el),
      ) ?? null;

    const unlock = lockPageScroll();
    const reveal = inertOutside(node);
    if (!node.contains(document.activeElement)) node.focus({ preventScroll: true });

    const onKey = (key: KeyboardEvent) => {
      if (key.key !== 'Escape' || key.defaultPrevented || key.isComposing) return;
      if (layers[layers.length - 1] !== layer) return;
      escape();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      layers.splice(layers.indexOf(layer), 1);
      reveal();
      unlock();

      const now = document.activeElement;
      const focusWasOurs = !now || now === document.body || node.contains(now);
      if (focusWasOurs && opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [panel, renderedOver]);
}
