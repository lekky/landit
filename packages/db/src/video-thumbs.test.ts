import { describe, expect, it } from 'vitest';

import {
  THUMB_MAX_BYTES,
  needsThumb,
  thumbProblem,
  youtubeThumbSource,
  type ThumbRow,
} from './video-thumbs';

const row = (over: Partial<ThumbRow> = {}): ThumbRow => ({
  id: 'r1',
  slug: 'sk-ollie',
  videoId: 'XLVraCnI5Kc',
  thumb: '',
  ...over,
});

const answer = (over: Partial<Parameters<typeof thumbProblem>[0]> = {}) => ({
  ok: true,
  status: 200,
  contentType: 'image/jpeg',
  bytes: 15_000,
  ...over,
});

describe('where the frame comes from', () => {
  it('asks YouTube’s image host for the medium-quality frame', () => {
    // `mqdefault` rather than `maxresdefault`, which does not exist for every
    // video — "no thumbnail" has to mean one thing, not two.
    expect(youtubeThumbSource('XLVraCnI5Kc')).toBe(
      'https://i.ytimg.com/vi/XLVraCnI5Kc/mqdefault.jpg',
    );
  });

  it('refuses anything that is not an eleven-character id', () => {
    // The id lands in a URL this fetches. It has been through the hook's parser
    // by the time it is stored, so this is a second opinion rather than the
    // guarantee — but a bad value must fail loudly here, not build a URL.
    expect(() => youtubeThumbSource('https://youtu.be/XLVraCnI5Kc')).toThrow();
    expect(() => youtubeThumbSource('../../etc/passwd')).toThrow();
    expect(() => youtubeThumbSource('')).toThrow();
  });
});

describe('which rows want one', () => {
  it('wants a frame for a video that has none', () => {
    expect(needsThumb(row())).toBe(true);
  });

  it('leaves a row that already has one alone', () => {
    expect(needsThumb(row({ thumb: 'XLVraCnI5Kc.jpg' }))).toBe(false);
  });

  it('wants one for a hidden video too', () => {
    // Staff un-hide videos. A preview that only turned up some runs later would
    // be a second thing to wait for after the click that put it back.
    expect(needsThumb(row({ thumb: '' }))).toBe(true);
  });

  it('never wants one for a trick with no video', () => {
    expect(needsThumb(row({ videoId: '', thumb: '' }))).toBe(false);
  });
});

describe('what may be stored', () => {
  it('accepts a normal jpeg', () => {
    expect(thumbProblem(answer())).toBeNull();
  });

  it('refuses a failed request rather than storing nothing', () => {
    expect(thumbProblem(answer({ ok: false, status: 404 }))).toContain('404');
  });

  it('refuses a response that is not an image we store', () => {
    // YouTube answers some missing ids with an HTML page rather than a 404, and
    // that page would otherwise be written into an image column.
    expect(thumbProblem(answer({ contentType: 'text/html' }))).toContain('not an image');
    expect(thumbProblem(answer({ contentType: null }))).toContain('no content-type');
  });

  it('reads a content-type with a charset on it', () => {
    expect(thumbProblem(answer({ contentType: 'image/jpeg; charset=binary' }))).toBeNull();
  });

  it('refuses an empty body and one over the column’s ceiling', () => {
    expect(thumbProblem(answer({ bytes: 0 }))).toContain('empty');
    expect(thumbProblem(answer({ bytes: THUMB_MAX_BYTES + 1 }))).toContain('too large');
    expect(thumbProblem(answer({ bytes: THUMB_MAX_BYTES }))).toBeNull();
  });
});
