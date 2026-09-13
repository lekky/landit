import { describe, expect, it } from 'vitest';

import { CLIP_PLATFORMS } from '../data/sessions';
import { CLIP_LINK_CASES } from './clip-links.cases';
import {
  clipLinkProblem,
  clipPlatformColor,
  clipPlatformLabel,
  clipWatchUrl,
  detectClipPlatform,
  isClipLink,
  parseClipLink,
  parseInstagramId,
  parseTikTokId,
} from './clip-links';

describe('parseClipLink, over the shared case table', () => {
  for (const { input, expected, why } of CLIP_LINK_CASES) {
    it(`${JSON.stringify(input)} — ${why}`, () => {
      expect(parseClipLink(input)).toEqual(expected);
    });
  }

  it('refuses non-string input without throwing', () => {
    for (const value of [null, undefined, 0, {}, [], true]) {
      expect(parseClipLink(value as unknown as string)).toBeNull();
    }
  });
});

describe('the per-platform parsers', () => {
  it('only answer for their own platform', () => {
    const ig = 'https://www.instagram.com/p/C8xYz_1-AbC/';
    const tt = 'https://www.tiktok.com/@a/video/7234567890123456789';
    expect(parseInstagramId(ig)).toBe('C8xYz_1-AbC');
    expect(parseInstagramId(tt)).toBeNull();
    expect(parseTikTokId(tt)).toBe('7234567890123456789');
    expect(parseTikTokId(ig)).toBeNull();
  });
});

describe('the stored form round-trips', () => {
  it('rebuilds a watch URL that parses back to the same clip, for every accepted row', () => {
    for (const { expected } of CLIP_LINK_CASES) {
      if (!expected) continue;
      const url = clipWatchUrl(expected);
      expect(parseClipLink(url), url).toEqual(expected);
    }
  });

  it('never rebuilds from the pasted string: tracking parameters are gone', () => {
    const clip = parseClipLink(
      'https://www.instagram.com/reel/C8xYz_1-AbC/?igsh=tracking&utm_source=x',
    );
    expect(clipWatchUrl(clip!)).toBe('https://www.instagram.com/p/C8xYz_1-AbC/');
  });

  it('refuses to build a URL from anything that is not a clip', () => {
    expect(() => clipWatchUrl({ platform: 'tiktok', id: 'javascript:alert(1)' })).toThrow();
    expect(() =>
      clipWatchUrl({ platform: 'vimeo', id: '123' } as unknown as Parameters<
        typeof clipWatchUrl
      >[0]),
    ).toThrow();
    expect(isClipLink({ platform: 'youtube', id: 'dQw4w9WgXcQ' })).toBe(true);
    expect(isClipLink({ platform: 'youtube', id: 'short' })).toBe(false);
    expect(isClipLink(null)).toBe(false);
  });
});

describe('what the clip box says', () => {
  it('detects the platform for the live badge', () => {
    expect(detectClipPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    expect(detectClipPlatform('https://vm.tiktok.com/ZMabc/')).toBeNull();
  });

  it('treats an empty box as fine, a short link as its own problem, and the rest as unsupported', () => {
    expect(clipLinkProblem('')).toBeNull();
    expect(clipLinkProblem('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(clipLinkProblem('https://vm.tiktok.com/ZMabc1234/')).toBe('shortlink');
    expect(clipLinkProblem('https://vimeo.com/123')).toBe('unsupported');
  });

  it('names and colours each platform from the one table', () => {
    for (const platform of CLIP_PLATFORMS) {
      expect(clipPlatformLabel(platform.id)).toBe(platform.label);
      expect(clipPlatformColor(platform.id)).toBe(platform.color);
    }
    expect(CLIP_PLATFORMS.map((p) => p.color)).toEqual(['#ff5a1f', '#ff3d78', '#3ac0ff']);
  });
});
