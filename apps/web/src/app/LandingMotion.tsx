'use client';

import { useEffect } from 'react';

/**
 * The landing page's two pieces of motion: the scroll reveal and the phone
 * drift. Renders nothing.
 *
 * **The reveal is additive and fail-open**, which the design pack states as a
 * hard requirement and which matters most on this page: it is the first thing a
 * stranger sees, and it is the page the whole product's funnel starts on. The
 * resting CSS is visible (`.rv { opacity: 1 }`). The hidden state lives under
 * `html.anim`, and this component is the only thing that adds that class — so
 * a JS bundle that fails to load, an old browser, or a hydration error all
 * leave a page that reads perfectly rather than a blank one. Never move the
 * hidden state out from under `.anim`.
 *
 * Three ways an element gets revealed, because the observer alone has been
 * enough to strand content on real browsers: the observer itself; a 1.2s
 * timeout that force-reveals everything if nothing has fired by then; and a
 * passive scroll listener that reveals anything above 92% of the viewport.
 * Belt, braces and a second pair of braces, for the reason above.
 *
 * Under `prefers-reduced-motion` neither the class nor the drift loop starts,
 * so the page is simply static.
 */
export function LandingMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const root = document.documentElement;
    const revealables = [...document.querySelectorAll<HTMLElement>('[data-rv]')];
    if (revealables.length === 0) return;

    root.classList.add('anim');
    // A data attribute, not a class: CSS Modules would hash a class name here and
    // the stylesheet would never match what this writes. See landing.module.css.
    const reveal = (el: HTMLElement) => {
      el.dataset.rv = 'in';
    };

    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          reveal(entry.target as HTMLElement);
          observer.unobserve(entry.target);
        }),
      { threshold: 0.14, rootMargin: '0px 0px -6% 0px' },
    );
    revealables.forEach((el) => observer.observe(el));

    const failsafe = window.setTimeout(() => {
      if (!revealables.some((el) => el.dataset.rv === 'in')) revealables.forEach(reveal);
    }, 1200);

    const onScroll = () => {
      const h = window.innerHeight;
      revealables.forEach((el) => {
        if (el.getBoundingClientRect().top < h * 0.92) reveal(el);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    /*
     * The phone frames drift against the scroll, about ±12px.
     *
     * Written to `translate` rather than `transform` on purpose: the frames
     * carry a ±1.6° tilt in `transform` from the stylesheet, and writing the
     * offset into the same property would either drop the tilt or force this
     * loop to know about it. The two properties compose.
     */
    const phones = [...document.querySelectorAll<HTMLElement>('[data-drift]')];
    let frame = 0;
    const drift = () => {
      const h = window.innerHeight;
      for (const phone of phones) {
        const rect = phone.getBoundingClientRect();
        // Off-screen frames cost nothing: no read is used, no write is made.
        if (rect.bottom < -160 || rect.top > h + 160) continue;
        const mid = (rect.top + rect.height / 2 - h / 2) / h;
        phone.style.translate = `0 ${(-mid * 24).toFixed(1)}px`;
      }
      frame = requestAnimationFrame(drift);
    };
    if (phones.length > 0) frame = requestAnimationFrame(drift);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove('anim');
    };
  }, []);

  return null;
}
