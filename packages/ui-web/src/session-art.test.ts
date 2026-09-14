import { describe, expect, it } from 'vitest';

import {
  FEEL_ART,
  SESSION_ART_FILES,
  SESSION_ART_WIDTHS,
  WEATHER_ART,
  sessionArtSrc,
  sessionArtSrcSet,
} from './session-art';

/**
 * The sticker art keyed by the same ids core's tables use, and the `srcset`
 * that names files `sync-session-icons.mjs` has to have written.
 *
 * This package may not import `@landit/core`, so the ids are spelled out here
 * rather than read from `SESSION_FEELS` / `SESSION_WEATHER`. That is the whole
 * point of the first test: a feel added to core with no art here renders a
 * broken image on a rider's log form, and this is the cheapest place to notice.
 * `apps/web/src/lib/session-art.test.ts` is the other half — it holds these ids
 * against core's real tables and checks a file exists behind each name.
 */

describe('the session sticker art', () => {
  it('covers the five feels and the five weather options', () => {
    expect(Object.keys(FEEL_ART)).toEqual(['sent', 'good', 'fine', 'rough', 'hurt']);
    expect(Object.keys(WEATHER_ART)).toEqual(['sun', 'cloud', 'rain', 'wind', 'cold']);
  });

  it('names ten distinct files', () => {
    expect(SESSION_ART_FILES).toHaveLength(10);
    expect(new Set(SESSION_ART_FILES).size).toBe(10);
  });

  it('serves the master from /session-icons', () => {
    expect(sessionArtSrc(FEEL_ART.sent)).toBe('/session-icons/feel-sent.png');
    expect(sessionArtSrc(WEATHER_ART.cold, '/elsewhere')).toBe('/elsewhere/weather-cold.png');
  });

  it('offers a WebP at every width the sync script writes', () => {
    const set = sessionArtSrcSet(FEEL_ART.good);
    for (const width of SESSION_ART_WIDTHS) {
      expect(set).toContain(`/session-icons/w${width}/feel-good.webp ${width}w`);
    }
  });

  it('offers nothing for a file the script would not resize', () => {
    // A `srcset` candidate that 404s shows a broken image rather than falling
    // back to the `src`, so promising variants for a non-PNG is worse than
    // promising none.
    expect(sessionArtSrcSet('feel-good.svg')).toBeUndefined();
    expect(sessionArtSrcSet('.png')).toBeUndefined();
  });
});
