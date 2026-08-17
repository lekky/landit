import { describe, expect, it } from 'vitest';

import { PLAN, PLAN_IDS } from '../data/plans';
import {
  DEFAULT_VIDEO_VISIBILITY,
  NO_VIDEO_LINKS,
  SHREDDER_VIDEO_LINK_CAP,
  VIDEO_VISIBILITY_IDS,
  YOUTUBE_ID_PATTERN,
  canAddVideoLink,
  normaliseVideoVisibility,
  parseYouTubeVideoId,
  videoLinkAllowance,
  videoLinkAllowanceLabel,
  videoLinksRemaining,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from './video';
import { VIDEO_ID_CASES } from './video.cases';

describe('parseYouTubeVideoId', () => {
  // The table is shared with `pocketbase/tests/video-link-parser.test.ts`, which
  // runs the hook's copy of this function over the same rows and asserts the two
  // agree. See `video.cases.ts`.
  for (const { input, expected, why } of VIDEO_ID_CASES) {
    const verb = expected === null ? 'refuses' : 'accepts';
    it(`${verb} ${JSON.stringify(input)} — ${why}`, () => {
      expect(parseYouTubeVideoId(input)).toBe(expected);
    });
  }

  it('never returns anything that is not an id', () => {
    // The property behind every row above: whatever comes out either is a
    // YouTube id or is null. There is no third outcome, so no caller has to
    // check the shape of what it was handed.
    for (const { input } of VIDEO_ID_CASES) {
      const result = parseYouTubeVideoId(input);
      if (result !== null) expect(result).toMatch(YOUTUBE_ID_PATTERN);
    }
  });

  it('is idempotent: parsing its own output returns it unchanged', () => {
    // Load-bearing. The hook re-parses `video_id` on every write, including the
    // update that only changes visibility — and the value it re-parses is one it
    // wrote itself. If parsing an id were not the identity, changing a video's
    // visibility would refuse its own row.
    for (const { input } of VIDEO_ID_CASES) {
      const once = parseYouTubeVideoId(input);
      if (once === null) continue;
      expect(parseYouTubeVideoId(once)).toBe(once);
    }
  });

  it('survives being handed something that is not a string', () => {
    // The hook reads `record.getString('video_id')`, so this should not happen —
    // but a parser that throws on bad input is a parser that turns a refusal
    // into a 500, and a 500 is not a refusal.
    for (const value of [null, undefined, 0, {}, [], true]) {
      expect(parseYouTubeVideoId(value as unknown as string)).toBe(null);
    }
  });

  it('drops everything after the id, so nothing attacker-controlled is stored', () => {
    // Guarantee 2, as a property rather than a rule: what is persisted is
    // eleven characters, so there is no query string, fragment or redirect
    // target in the database to be replayed into a browser later.
    const hostile = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&next=https://evil.example',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ#"><script>alert(1)</script>',
      'https://youtu.be/dQw4w9WgXcQ?si=" onload="alert(1)',
    ];
    for (const input of hostile) {
      expect(parseYouTubeVideoId(input)).toBe('dQw4w9WgXcQ');
    }
  });
});

describe('the embed URL', () => {
  it('is youtube-nocookie, so a play sets no third-party cookie', () => {
    // Plan §6.8: no consent banner, deliberately, which is only honest while
    // nothing contacts a third party without the rider asking. The *no request
    // on page load* half is the surface's job (click-to-play) and is asserted in
    // `e2e/video-links.spec.ts`; this is the host half.
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toContain('https://www.youtube-nocookie.com/embed/');
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).not.toContain('//www.youtube.com/');
  });

  it('autoplays, because the click that mounted the frame was the play button', () => {
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toContain('autoplay=1');
  });

  it('refuses to build a URL out of anything that is not an id', () => {
    for (const bad of ['', 'dQw4w9WgXc', 'https://evil.example', '../../etc/passwd']) {
      expect(() => youtubeEmbedUrl(bad)).toThrow();
      expect(() => youtubeWatchUrl(bad)).toThrow();
    }
  });

  it('sends the watch link to the video on YouTube', () => {
    expect(youtubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});

describe('video visibility', () => {
  it('has two states and neither of them is public', () => {
    // Owner's decision, 2026-08-17: a rider-supplied video is never reachable
    // by a signed-out visitor, so the state that would make it reachable does
    // not exist. Profile privacy is still three-way; this deliberately is not.
    expect(VIDEO_VISIBILITY_IDS).toEqual(['private', 'members']);
    expect(VIDEO_VISIBILITY_IDS).not.toContain('public');
  });

  it('defaults to private — the value, not merely "not public"', () => {
    // Children's code standard 7 (plan §6.4). The same sentence that says
    // `members` does not clear the bar for a profile.
    expect(DEFAULT_VIDEO_VISIBILITY).toBe('private');
  });

  it('reads anything it does not recognise as private', () => {
    expect(normaliseVideoVisibility('members')).toBe('members');
    expect(normaliseVideoVisibility('private')).toBe('private');
    for (const junk of ['', null, undefined, 'public', 'Members', 'everyone', 'MEMBERS']) {
      expect(normaliseVideoVisibility(junk)).toBe('private');
    }
  });
});

describe('the per-plan allowance', () => {
  it('gives Rookie none, Shredder a capped number and Legend unlimited', () => {
    expect(videoLinkAllowance(PLAN.rookie)).toEqual({ cap: 0, unlimited: false });
    expect(videoLinkAllowance(PLAN.shredder)).toEqual({
      cap: SHREDDER_VIDEO_LINK_CAP,
      unlimited: false,
    });
    expect(videoLinkAllowance(PLAN.legend).unlimited).toBe(true);
  });

  it('fails closed on a missing plan record', () => {
    // The property `planFor` has in the hook: an unseeded `plans` collection or
    // an unknown slug grants nothing, never everything (plan §2.4).
    expect(videoLinkAllowance(null)).toEqual(NO_VIDEO_LINKS);
    expect(videoLinkAllowance(undefined)).toEqual(NO_VIDEO_LINKS);
    expect(canAddVideoLink(videoLinkAllowance(null), 0)).toBe(false);
  });

  it('fails closed on a plan record with the fields unset', () => {
    // What a half-migrated or half-seeded database looks like: a `number` field
    // reads 0 and a `bool` reads false on every row nobody updated. That has to
    // mean "no links", which is why unlimited is a boolean rather than a
    // sentinel a zero could be mistaken for.
    const unset = { ...PLAN.legend, videoLinkCap: 0, videoLinksUnlimited: false };
    expect(canAddVideoLink(videoLinkAllowance(unset), 0)).toBe(false);
  });

  it('does not read a negative or fractional cap as a grant', () => {
    const odd = { ...PLAN.shredder, videoLinkCap: -5, videoLinksUnlimited: false };
    expect(videoLinkAllowance(odd).cap).toBe(0);
    const fractional = { ...PLAN.shredder, videoLinkCap: 2.9, videoLinksUnlimited: false };
    expect(videoLinkAllowance(fractional).cap).toBe(2);
  });

  it('lets a rider add up to the cap and not past it', () => {
    const allowance = { cap: 3, unlimited: false };
    expect(canAddVideoLink(allowance, 0)).toBe(true);
    expect(canAddVideoLink(allowance, 2)).toBe(true);
    expect(canAddVideoLink(allowance, 3)).toBe(false);
    expect(canAddVideoLink(allowance, 400)).toBe(false);
  });

  it('never stops an unlimited rider, whatever the count', () => {
    expect(canAddVideoLink({ cap: 0, unlimited: true }, 9_999)).toBe(true);
    expect(videoLinksRemaining({ cap: 0, unlimited: true }, 9_999)).toBe(null);
  });

  it('counts down, and never below zero', () => {
    expect(videoLinksRemaining({ cap: 10, unlimited: false }, 4)).toBe(6);
    expect(videoLinksRemaining({ cap: 10, unlimited: false }, 10)).toBe(0);
    expect(videoLinksRemaining({ cap: 10, unlimited: false }, 12)).toBe(0);
  });

  it('reads zero as "none" and says so', () => {
    // The encoding, asserted: `0` is a count that means none, and "unlimited"
    // is a different field. Nothing has to know that some number is magic.
    expect(videoLinkAllowanceLabel({ cap: 0, unlimited: false })).toBe('No video links');
    expect(videoLinkAllowanceLabel({ cap: 0, unlimited: true })).toBe('Unlimited video links');
    expect(videoLinkAllowanceLabel({ cap: 1, unlimited: false })).toBe('1 video link');
    expect(videoLinkAllowanceLabel({ cap: 10, unlimited: false })).toBe('10 video links');
  });

  it('is what the plan cards advertise, on every plan', () => {
    // The number on the card is rendered from the number the hook enforces
    // (`VIDEO_LINKS` in `data/plans.ts`), so a card cannot promise a cap that
    // does not exist. This is the test that notices if somebody types one in.
    for (const id of PLAN_IDS) {
      const plan = PLAN[id];
      const label = videoLinkAllowanceLabel(videoLinkAllowance(plan));
      const lines = [...plan.perks, ...plan.missing];
      expect(lines.some((line) => line.includes(label))).toBe(true);
    }
  });

  it('mentions no vault, no clip and no byte figure anywhere', () => {
    // The regression `data.test.ts` already holds, restated here because this
    // is the file that adds copy to those arrays. Riders add a *link*; we do not
    // host the video and nothing on a card may suggest we do (plan §6.6).
    for (const id of PLAN_IDS) {
      for (const line of [...PLAN[id].perks, ...PLAN[id].missing, PLAN[id].pitch]) {
        expect(line).not.toMatch(/vault|clip|\bGB\b|upload/i);
      }
    }
  });
});
