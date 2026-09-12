import { describe, expect, it } from 'vitest';

import { snapshotResponse, spotTag } from './spotsSnapshotResponse';

/**
 * The conditional-request half of the spots snapshot routes.
 *
 * Worth its own tests because both ways of getting it wrong are silent. Too
 * strict a match and every visit re-downloads 437 KB that the browser already
 * has, which is the cost this whole change exists to remove and which nothing
 * on screen would report. Too loose a match and a browser is told "you already
 * have this" about a body it has never seen — the names answered with the
 * points' tag, or one snapshot's list labelled with another's names.
 */

const ask = (ifNoneMatch?: string) =>
  new Request('https://landthetrick.com/api/spots/points', {
    headers: ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {},
  });

const VERSION = 'a1b2c3d4e5f60718';
const POINTS = spotTag('points', VERSION);
const NAMES = spotTag('names', VERSION);

describe('the tag for a half of a snapshot', () => {
  it('tells the two halves of one snapshot apart', () => {
    expect(POINTS).not.toBe(NAMES);
  });

  /*
   * The reason `spotTag` puts the half's letter in front rather than behind:
   * `core()` throws away everything after the first dash, so a `-n` suffix
   * would be eaten and the names would answer to the points' tag.
   */
  it('carries no dash, which a proxy suffix would be confused with', () => {
    expect(POINTS).not.toContain('-');
    expect(NAMES).not.toContain('-');
  });
});

describe('serving a snapshot body', () => {
  it('sends the body, the tag and a public cache window to a first caller', async () => {
    const response = snapshotResponse(ask(), '{"version":"x","points":[]}', POINTS);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"version":"x","points":[]}');
    expect(response.headers.get('etag')).toBe(POINTS);
    expect(response.headers.get('cache-control')).toContain('public');
    expect(response.headers.get('cache-control')).toContain('max-age=300');
  });

  it('answers 304 with no body when the caller already has this snapshot', async () => {
    const response = snapshotResponse(ask(POINTS), '{"points":[]}', POINTS);

    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
    // The tag still has to be there, or the browser cannot refresh its own copy.
    expect(response.headers.get('etag')).toBe(POINTS);
  });

  it('sends the body when the caller holds an older snapshot', () => {
    const older = spotTag('points', 'ffffffffffffffff');
    expect(snapshotResponse(ask(older), '{"points":[]}', POINTS).status).toBe(200);
  });

  /*
   * The failure this is really guarding: the names route reached with the
   * points' tag. Both describe the same snapshot and differ by one letter, so
   * a comparison that normalised too hard would hand back a 304 and leave the
   * screen pairing coordinates with nothing.
   */
  it('never mistakes one half of a snapshot for the other', () => {
    expect(snapshotResponse(ask(POINTS), '{"names":[]}', NAMES).status).toBe(200);
    expect(snapshotResponse(ask(NAMES), '{"points":[]}', POINTS).status).toBe(200);
  });

  it('matches through the forms a proxy leaves behind', () => {
    // Traefik and nginx both append a suffix when they compress.
    expect(snapshotResponse(ask(`"p${VERSION}-gzip"`), 'body', POINTS).status).toBe(304);
    // A weak tag, which a transforming cache is entitled to produce.
    expect(snapshotResponse(ask(`W/"p${VERSION}"`), 'body', POINTS).status).toBe(304);
  });

  it('matches when the browser offers several tags', () => {
    const header = `"pdeadbeefdeadbeef", ${POINTS}`;
    expect(snapshotResponse(ask(header), 'body', POINTS).status).toBe(304);
  });

  it('treats * as the caller saying it has whatever there is', () => {
    expect(snapshotResponse(ask('*'), 'body', POINTS).status).toBe(304);
  });

  it('sends the body when the caller offers no tag at all', () => {
    expect(snapshotResponse(ask(), 'body', POINTS).status).toBe(200);
  });
});
