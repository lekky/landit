import localFont from 'next/font/local';

/**
 * The three Land It typefaces, served from our own origin.
 *
 * Plan §2.5: self-hosted via `next/font`, never the Google Fonts CDN. The
 * audience is children, the cookie policy promises no cross-site tracking, and
 * GDPR case law has gone against CDN font pings. The `.woff2` files in
 * `src/fonts/` are committed; `pnpm --filter @landit/web fonts:sync` refreshes
 * them from the Fontsource packages in `devDependencies`.
 *
 * Each font exposes a CSS variable. `@landit/ui-web`'s tokens read those
 * variables for `--fd` / `--fc` / `--fb`, so the design system stays framework
 * agnostic and this file is the only place that knows about Next.
 *
 * Only the `latin` subset is shipped, so latin-ext and Vietnamese glyphs fall
 * back to the system font.
 */

/** Display. Every heading and every large number. Uppercase. */
export const anton = localFont({
  src: './fonts/anton-latin-400.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-anton',
  fallback: ['Impact', 'sans-serif'],
});

/** Labels and UI chrome — the `.lab` / `.cond` / `.eyebrow` scale. */
export const barlowCondensed = localFont({
  src: [
    { path: './fonts/barlow-condensed-latin-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/barlow-condensed-latin-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/barlow-condensed-latin-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-barlow-condensed',
  fallback: ['sans-serif'],
});

/** Body copy. Variable weight axis, used between 400 and 700. */
export const archivo = localFont({
  src: './fonts/archivo-latin-variable.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-archivo',
  fallback: ['system-ui', 'sans-serif'],
});

/** Put this on `<html>`: it defines all three CSS variables. */
export const fontVariables = `${anton.variable} ${barlowCondensed.variable} ${archivo.variable}`;
