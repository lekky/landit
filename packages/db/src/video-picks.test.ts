import { TRICKS, parseYouTubeVideoId } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { TRUSTED_CHANNELS, pickStartsHidden } from './video-picks';
import { VIDEO_PICKS } from './video-picks.data';

describe('the automatic picks', () => {
  it('names a trick that exists, once each', () => {
    const slugs = TRICKS.map((t) => t.id);
    const picked = VIDEO_PICKS.map((p) => p.slug);

    for (const slug of picked) expect(slugs).toContain(slug);
    expect(new Set(picked).size).toBe(picked.length);
  });

  it('carries a real eleven-character video id, never a URL', () => {
    // The hook re-parses on the way in, so this is a second opinion rather than
    // the guarantee — but an unparseable id here would mean the whole import is
    // rejected row by row at 3am, which is worth catching in a test instead.
    for (const pick of VIDEO_PICKS) {
      expect(parseYouTubeVideoId(pick.videoId), `${pick.slug}: ${pick.videoId}`).toBe(pick.videoId);
    }
  });

  it('always has a title, because a play button must say what it plays', () => {
    for (const pick of VIDEO_PICKS) {
      expect(pick.title.trim(), pick.slug).not.toBe('');
      // The tricks hook caps a title at 16 words; a longer one would be refused
      // on import and the row silently skipped.
      expect(pick.title.trim().split(/\s+/).length, pick.slug).toBeLessThanOrEqual(16);
    }
  });

  it('only calls a pick high-confidence when a trusted channel published it', () => {
    // The whole safety argument for letting any of these go live unwatched.
    // A `high` pick from an unknown channel would be exactly the failure the
    // T35 measurement warned about — pole dancing on a child's trick page.
    const trusted = new Set(Object.values(TRUSTED_CHANNELS).flat());

    for (const pick of VIDEO_PICKS) {
      if (pick.confidence === 'high') {
        expect(trusted, `${pick.slug} is high but ${pick.channel} is not trusted`).toContain(
          pick.channel,
        );
      }
    }
  });

  it('holds back everything that is not high-confidence', () => {
    for (const pick of VIDEO_PICKS) {
      expect(pickStartsHidden(pick), pick.slug).toBe(pick.confidence !== 'high');
    }
  });

  it('matches the trusted channel to the trick’s own sport', () => {
    // A Braille skateboarding video is a fine tutorial and completely wrong on a
    // BMX page. Cross-sport substitution is the one thing the owner ruled out
    // outright (#464), so it cannot arrive by way of the channel allowlist.
    const sportOf = new Map<string, string>(TRICKS.map((t) => [t.id, t.sport]));

    for (const pick of VIDEO_PICKS) {
      if (pick.confidence !== 'high') continue;
      const sport = sportOf.get(pick.slug) ?? '';
      expect(TRUSTED_CHANNELS[sport], `${pick.slug} (${sport})`).toContain(pick.channel);
    }
  });
});
