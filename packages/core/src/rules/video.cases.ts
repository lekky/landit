/**
 * The YouTube-link parser's case table, in one place because **two
 * implementations have to agree on it**.
 *
 * `parseYouTubeVideoId` exists twice on purpose (plan §3: rules are defined in
 * `packages/core` and enforced in `pocketbase/hooks`, which runs in a JSVM no
 * bundler can load). This file is what stops the copies drifting:
 *
 * - `video.test.ts` runs the TypeScript one over it.
 * - `pocketbase/tests/video-link-parser.test.ts` loads the hook's
 *   `lib/video.js` with `createRequire` and runs **that** one over the same
 *   table, then asserts the two return identical values for every row.
 *
 * A drift test that compares the two files as *text* would pass on two
 * implementations that happen to contain the same constant and behave
 * differently. This one compares behaviour.
 *
 * Not exported from the package: it is a fixture, not API. Add a row here when
 * you find a shape a rider actually pastes, and both suites cover it at once.
 */

export interface VideoIdCase {
  /** What a rider pastes, or what an attacker sends. */
  readonly input: string;
  /** The 11-character id, or `null` when the link must be refused. */
  readonly expected: string | null;
  /** Why this row is here. Read by nobody at runtime; read by the next session. */
  readonly why: string;
}

/** A real-looking id with every legal character class in it, including `-` and `_`. */
const ID = 'dQw4w9WgXcQ';
const ID_WITH_DASH = 'a-B_c1D2e3F';

export const VIDEO_ID_CASES: readonly VideoIdCase[] = [
  // ---------------------------------------------------------------- accepted --
  { input: ID, expected: ID, why: 'the bare id, which is also the stored form' },
  {
    input: ID_WITH_DASH,
    expected: ID_WITH_DASH,
    why: 'dash and underscore are legal id characters and must survive',
  },
  { input: `  ${ID}  `, expected: ID, why: 'surrounding whitespace is trimmed' },
  {
    input: `https://www.youtube.com/watch?v=${ID}`,
    expected: ID,
    why: 'the canonical desktop link',
  },
  {
    input: `http://www.youtube.com/watch?v=${ID}`,
    expected: ID,
    why: 'plain http is still a YouTube link',
  },
  {
    input: `https://youtube.com/watch?v=${ID}`,
    expected: ID,
    why: 'no www',
  },
  {
    input: `youtube.com/watch?v=${ID}`,
    expected: ID,
    why: 'no scheme — what a rider gets from a mobile address bar',
  },
  {
    input: `https://m.youtube.com/watch?v=${ID}`,
    expected: ID,
    why: 'the mobile host',
  },
  {
    input: `https://music.youtube.com/watch?v=${ID}`,
    expected: ID,
    why: 'music.youtube.com serves the same ids',
  },
  {
    input: `https://www.youtube.com/watch?v=${ID}&t=42s`,
    expected: ID,
    why: 'a timestamp after the id — dropped, not stored',
  },
  {
    input: `https://www.youtube.com/watch?list=PLabc&v=${ID}&index=3`,
    expected: ID,
    why: 'v= is not the first parameter',
  },
  {
    input: `https://www.youtube.com/watch?v=${ID}#anything`,
    expected: ID,
    why: 'a fragment never reaches a server and never reaches the database',
  },
  { input: `https://youtu.be/${ID}`, expected: ID, why: 'the share-sheet short link' },
  {
    input: `https://youtu.be/${ID}?si=Xy9_tracking`,
    expected: ID,
    why: 'the share tracking parameter is dropped',
  },
  { input: `youtu.be/${ID}`, expected: ID, why: 'short link with no scheme' },
  {
    input: `https://www.youtube.com/shorts/${ID}`,
    expected: ID,
    why: 'Shorts, which is what most riders will paste',
  },
  {
    input: `https://youtube.com/shorts/${ID}?feature=share`,
    expected: ID,
    why: 'Shorts with a query string',
  },
  {
    input: `https://www.youtube.com/embed/${ID}`,
    expected: ID,
    why: 'an embed URL copied out of a page, including one of ours',
  },
  {
    input: `HTTPS://WWW.YOUTUBE.COM/watch?v=${ID}`,
    expected: ID,
    why: 'scheme and host are case-insensitive; the id is not',
  },

  // ---------------------------------------------------------------- refused --
  { input: '', expected: null, why: 'an empty box' },
  { input: '   ', expected: null, why: 'whitespace only' },
  {
    input: 'https://www.youtube.com/watch?v=tooshort',
    expected: null,
    why: 'an id of the wrong length is not an id',
  },
  {
    input: `https://www.youtube.com/watch?v=${ID}extra`,
    expected: null,
    why: 'twelve characters is not eleven — no prefix match, no guessing',
  },
  {
    input: 'https://www.youtube.com/watch?v=abcdefghij!',
    expected: null,
    why: 'an illegal character anywhere in the id',
  },
  {
    input: 'https://www.youtube.com/',
    expected: null,
    why: 'the right host with no video on it',
  },
  {
    input: `https://www.youtube.com/results?search_query=${ID}`,
    expected: null,
    why: 'a search page that happens to contain eleven legal characters',
  },
  {
    input: `https://vimeo.com/watch?v=${ID}`,
    expected: null,
    why: 'another host — we embed YouTube and nothing else',
  },
  {
    input: `https://youtube.com.evil.example/watch?v=${ID}`,
    expected: null,
    why: 'a suffix attack on the host: the host is matched whole, never by prefix',
  },
  {
    input: `https://notyoutube.com/watch?v=${ID}`,
    expected: null,
    why: 'a prefix attack on the host',
  },
  {
    input: `https://www.youtube.com@evil.example/watch?v=${ID}`,
    expected: null,
    why: 'credentials in the authority make a hostile host read as a friendly one',
  },
  {
    input: `javascript:/*https://youtu.be/${ID}*/alert(1)`,
    expected: null,
    why: 'a script URL wearing a YouTube link as a comment',
  },
  {
    input: `data:text/html,<a href="https://youtu.be/${ID}">`,
    expected: null,
    why: 'a data URL is not a link to a video',
  },
  {
    input: `//www.youtube.com/watch?v=${ID}`,
    expected: null,
    why: 'a protocol-relative URL is not a shape any share sheet produces',
  },
  {
    input: `https://youtu.be/${ID}/../../evil`,
    expected: null,
    why: 'path traversal after a valid id — the id is the whole path or it is nothing',
  },
  {
    input: `https://www.youtube.com/watch?v=${ID}&v=evil0000000`,
    expected: ID,
    why: 'a duplicated parameter resolves to the first, the same way a browser would',
  },
  {
    input: 'https://www.youtube.com/watch?v=',
    expected: null,
    why: 'an empty v parameter',
  },
  {
    input: 'not a link at all',
    expected: null,
    why: 'a rider typing a sentence into the box',
  },
  {
    input: `<iframe src="https://www.youtube.com/embed/${ID}"></iframe>`,
    expected: null,
    why: 'markup pasted whole — refused rather than unpicked, so nothing extracts an id from HTML',
  },
];
