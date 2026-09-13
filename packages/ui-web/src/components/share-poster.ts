/**
 * The share poster: the card a rider sends, drawn as a real image.
 *
 * `ShareCard` renders a card worth posting and, until now, gave a rider no way
 * to post it — "Copy caption" put words on the clipboard and the picture stayed
 * on the screen (owner, 2026-09-13, in chat). The only route out was a
 * screenshot, with the browser's URL bar across the top of it.
 *
 * **Why a canvas and not a picture of the DOM.** The same argument the crew
 * invite already settled (`apps/web/.../crew/InviteCard.tsx`): the thing being
 * shared is an image, so there has to *be* an image — `navigator.share` takes a
 * `File`, and a canvas produces one with no dependency, no network and no
 * server round trip. Rasterising the live DOM instead would keep one source of
 * truth, at the price of a library that renders self-hosted fonts and hard
 * offset shadows unreliably.
 *
 * **Why 1080×1920 and not the invite's square.** Stories and Reels are where a
 * landed trick goes (owner, 2026-09-13, in chat). A tall poster fills those
 * full-bleed and letterboxes in a feed; a square does the reverse, and the feed
 * is the cheaper loss.
 *
 * **The cost, named.** The card now exists twice — once as DOM in the modal,
 * once as pixels here — and the two can drift. That is the same debt
 * `drawInvite` already carries. It is paid down by keeping every value below
 * read from the same tokens the card's CSS uses, so a change to the palette
 * moves both.
 */

import { stickerArtSrc } from '../sticker-art';
import type { StickerLook } from './StickerBadge';

/** The poster's pixel size. Tall, for Stories and Reels. */
export const SHARE_POSTER_WIDTH = 1080;
export const SHARE_POSTER_HEIGHT = 1920;

/** What the coloured block shows for a landed trick. */
export type ShareTrickLook = {
  name: string;
  /** "Street", "Flatground" — already resolved for the sport. */
  categoryLabel: string;
  /** "Scooter", "Skateboard", "BMX". */
  sportLabel: string;
  /** 1–5. */
  difficulty: number;
  /** The category colour. Fills the block. */
  hue: string;
};

export type SharePosterSpec = {
  /** "Landed the Tailwhip", "Earned Gnarly". */
  headline: string;
  /** "Sam · 14 tricks landed · 3 week streak". Formatted by the caller. */
  meta: string;
  /** "16 Aug" — formatted by the caller, never by ICU in the browser. */
  dateLabel: string;
  /** The line under the headline, and the text the share sheet carries. */
  caption: string;
  /** The wordmark the app serves. Skipped, not faked, if it will not load. */
  wordmarkSrc: string;
  /** "landthetrick.com", drawn small in the footer. */
  domain: string;
} & ({ kind: 'trick'; trick: ShareTrickLook } | { kind: 'sticker'; sticker: StickerLook });

/* --------------------------------------------------------------- tokens -- */

/**
 * A design token, read from the page so the poster is drawn in the product's
 * own palette and fonts rather than a second copy of them.
 *
 * The fallbacks are the values in `tokens.css`, and they are what a canvas
 * drawn before the stylesheet lands gets — not a guess at the brand.
 */
function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

const INK = () => token('--ink', '#12100b');
const PAPER = () => token('--paper', '#fffdf5');
const INK_SOFT = () => token('--ink-soft', '#c9c2b4');
const INK_MUTE = () => token('--ink-mute', '#8d8679');
const DISPLAY = () => token('--fd', 'Impact, sans-serif');
const CONDENSED = () => token('--fc', 'sans-serif');

/* ---------------------------------------------------------------- layout -- */

/**
 * The poster's one margin. Everything is placed against it, so the whole
 * composition moves together rather than in pieces.
 */
const PAD = 88;
const INNER = SHARE_POSTER_WIDTH - PAD * 2;

/* ----------------------------------------------------------------- text -- */

/**
 * Set `ctx.font`, in the one order canvas accepts it.
 *
 * Anton has a single weight and ignores the number; Barlow Condensed does not,
 * and the card's labels are 700. Passing it always is what keeps the two calls
 * looking the same at the call site.
 */
function font(ctx: CanvasRenderingContext2D, weight: number, px: number, family: string): void {
  ctx.font = `${weight} ${px}px ${family}`;
}

/**
 * The largest size at or below `px` that fits `text` into `maxWidth`.
 *
 * Never truncates. A rider chose the crew name the invite card shrinks, and
 * they did not choose the trick name here — but a poster that prints "TAILWHIP
 * TO FAKI" is worse than one that prints it two points smaller either way.
 */
function fittedSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  px: number,
  weight: number,
  family: string,
  floor = 0.45,
): number {
  let size = px;
  font(ctx, weight, size, family);
  while (ctx.measureText(text).width > maxWidth && size > px * floor) {
    size -= 2;
    font(ctx, weight, size, family);
  }
  return size;
}

/**
 * Break `text` into at most `maxLines` lines that each fit `maxWidth`.
 *
 * A word too long for a line of its own is left over-long rather than cut: the
 * caller shrinks to fit afterwards, and a mid-word break in a trick name reads
 * as a bug.
 */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines.length ? lines : [text];
}

/** The design's hard offset shadow, under one line of display type. */
function shadowed(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  offset: number,
  fill: string,
  shadow: string,
): void {
  ctx.fillStyle = shadow;
  ctx.fillText(text, x + offset, y + offset);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/* ---------------------------------------------------------------- pieces -- */

/**
 * One `.tag`: uppercase condensed on a hard-edged block, no radius. Returns the
 * width it took, so a row of them can be laid out left to right.
 */
function drawTag(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  background: string,
  foreground: string,
): number {
  const label = text.toUpperCase();
  const size = 30;
  const tracking = size * 0.13;
  const padX = 22;
  const height = 60;

  font(ctx, 700, size, CONDENSED());
  const width = ctx.measureText(label).width + tracking * label.length + padX * 2;

  ctx.fillStyle = background;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = foreground;
  ctx.textBaseline = 'middle';
  let cursor = x + padX;
  for (const character of label) {
    ctx.fillText(character, cursor, y + height / 2 + 2);
    cursor += ctx.measureText(character).width + tracking;
  }
  ctx.textBaseline = 'alphabetic';

  return width;
}

/**
 * The five skewed parallelograms of `.diff`, at poster scale: 13×10 with a 2px
 * ink border and a −16° skew, multiplied up.
 */
function drawDifficulty(
  ctx: CanvasRenderingContext2D,
  value: number,
  x: number,
  y: number,
  scale: number,
): void {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  const width = 13 * scale;
  const height = 10 * scale;
  const gap = 3 * scale;
  const border = 2 * scale;
  const skew = Math.tan((16 * Math.PI) / 180);

  for (let index = 0; index < 5; index += 1) {
    const left = x + index * (width + gap);
    ctx.save();
    ctx.transform(1, 0, -skew, 1, left + height * skew, y);
    ctx.fillStyle = index < filled ? INK() : `${PAPER()}b3`;
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = border;
    ctx.strokeStyle = INK();
    ctx.strokeRect(0, 0, width, height);
    ctx.restore();
  }
}

/** The page's dot pattern, at the poster's scale. */
function drawDots(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = `${PAPER()}12`;
  for (let x = 40; x < SHARE_POSTER_WIDTH; x += 34) {
    for (let y = 40; y < SHARE_POSTER_HEIGHT; y += 34) {
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Load an image for the canvas, or resolve `null`.
 *
 * Everything drawn here is served by the app itself, so nothing taints the
 * canvas and `toBlob` keeps working. A failure is a missing piece of a poster,
 * never a poster that will not save — so it resolves rather than rejects.
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/**
 * `color-mix(in oklab, hue 42%, #fff)` — the tint `StickerBadge` fills its disc
 * with — done by hand, because canvas has no `color-mix`.
 *
 * Mixed in sRGB rather than oklab: the difference is a shade, and the thing
 * that matters is that the disc is lighter than the block behind it, which is
 * the same hue. Anything this cannot parse is returned untouched, which is the
 * old behaviour and merely flat, not broken.
 */
function tint(hue: string, amount = 0.42): string {
  const hex = hue.trim().replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return hue;

  const channel = (at: number) => {
    const value = parseInt(full.slice(at, at + 2), 16);
    return Math.round(value * amount + 255 * (1 - amount));
  };
  return `rgb(${channel(0)}, ${channel(2)}, ${channel(4)})`;
}

/**
 * The sticker disc, for a record with no printed art (T24 gave most of them
 * one; the drawn SVG in `StickerBadge` is the fallback for the rest).
 *
 * The badge's curved lettering is the one thing not transcribed: an arc of text
 * is a great deal of canvas for a case the catalogue has almost none of, and
 * the name is already the poster's headline. So the disc keeps its rings and
 * its tint, and the name is set straight across it.
 */
function drawStickerDisc(
  ctx: CanvasRenderingContext2D,
  sticker: StickerLook,
  cx: number,
  cy: number,
  radius: number,
): void {
  const ink = INK();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.93, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.82, 0, Math.PI * 2);
  ctx.fillStyle = tint(sticker.hue);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.76, 0, Math.PI * 2);
  ctx.setLineDash([radius * 0.085, radius * 0.062]);
  ctx.lineWidth = radius * 0.026;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.restore();

  const name = sticker.name.toUpperCase();
  const size = fittedSize(ctx, name, radius * 1.3, radius * 0.34, 400, DISPLAY());
  ctx.textAlign = 'center';
  font(ctx, 400, size, DISPLAY());
  ctx.fillStyle = ink;
  ctx.fillText(name, cx, cy + size * 0.34);
  ctx.textAlign = 'left';
}

/* --------------------------------------------------------------- drawing -- */

/**
 * Draw the whole poster. Resolves once every image it needs has landed or
 * failed, so the caller can take a blob straight after awaiting it.
 *
 * Fonts are the caller's problem in one respect only: a canvas painted before
 * the self-hosted faces arrive is painted in the fallback and never corrects
 * itself, so `ShareCard` waits on `document.fonts.ready` and draws again.
 */
export async function drawSharePoster(
  canvas: HTMLCanvasElement,
  spec: SharePosterSpec,
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = SHARE_POSTER_WIDTH;
  canvas.height = SHARE_POSTER_HEIGHT;

  const ink = INK();
  const paper = PAPER();
  const display = DISPLAY();
  const condensed = CONDENSED();

  const art = spec.kind === 'sticker' && spec.sticker.img ? stickerArtSrc(spec.sticker.img) : null;
  const [wordmark, badge] = await Promise.all([
    loadImage(spec.wordmarkSrc),
    art ? loadImage(art) : Promise.resolve(null),
  ]);

  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, SHARE_POSTER_WIDTH, SHARE_POSTER_HEIGHT);
  drawDots(ctx);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  /* -- the header: wordmark left, date right ----------------------------- */

  const markHeight = 96;
  if (wordmark) {
    const markWidth = (wordmark.naturalWidth / wordmark.naturalHeight) * markHeight;
    ctx.drawImage(wordmark, PAD, 120, markWidth, markHeight);
  }

  const date = spec.dateLabel.toUpperCase();
  font(ctx, 700, 36, condensed);
  ctx.fillStyle = INK_MUTE();
  ctx.textAlign = 'right';
  ctx.fillText(date, SHARE_POSTER_WIDTH - PAD, 120 + markHeight * 0.66);
  ctx.textAlign = 'left';

  /* -- the coloured block ------------------------------------------------ */

  const blockTop = 300;
  const blockHeight = 1080;
  const blockPad = 56;
  const hue = spec.kind === 'trick' ? spec.trick.hue : spec.sticker.hue;

  ctx.fillStyle = hue;
  ctx.fillRect(PAD, blockTop, INNER, blockHeight);
  ctx.lineWidth = 10;
  ctx.strokeStyle = paper;
  ctx.strokeRect(PAD + 5, blockTop + 5, INNER - 10, blockHeight - 10);

  if (spec.kind === 'trick') {
    const { trick } = spec;
    const left = PAD + blockPad;
    const width = INNER - blockPad * 2;

    const tagWidth = drawTag(ctx, trick.categoryLabel, left, blockTop + blockPad, ink, paper);
    drawTag(ctx, trick.sportLabel, left + tagWidth + 18, blockTop + blockPad, paper, ink);

    const diffTop = blockTop + blockHeight - blockPad - 46;
    const bandTop = blockTop + blockPad + 60 + 48;
    const bandHeight = diffTop - 48 - bandTop;

    /*
     * The name grows as well as shrinks.
     *
     * A poster sized for "Double Whip to Fakie Manual" leaves "Fakie" floating
     * in a third of a green field, which reads as a rendering fault rather than
     * as the loud type the design asks for. So the size starts above anything
     * that will fit and comes down until the longest line is inside the block
     * and the whole stack is inside the band between the tags and the
     * difficulty — which is to say, it is the block that decides the size, not
     * a number chosen for the longest name in the catalogue.
     */
    const name = trick.name.toUpperCase();
    let size = 270;
    let lines: string[] = [];
    for (;;) {
      font(ctx, 400, size, display);
      lines = wrap(ctx, name, width, 3);
      const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
      const stack = lines.length * size * 0.92;
      if ((widest <= width && stack <= bandHeight) || size <= 64) break;
      size -= 4;
    }

    const lineHeight = size * 0.92;
    const nameTop =
      bandTop + bandHeight / 2 - (lines.length * lineHeight) / 2 + size * 0.34 + lineHeight * 0.12;
    font(ctx, 400, size, display);
    lines.forEach((line, index) => {
      shadowed(ctx, line, left, nameTop + index * lineHeight, size * 0.075, '#fff', ink);
    });

    drawDifficulty(ctx, trick.difficulty, left, diffTop, 3.6);
  } else {
    const cx = SHARE_POSTER_WIDTH / 2;
    const cy = blockTop + blockHeight / 2;
    const size = Math.min(INNER - blockPad * 2, blockHeight - blockPad * 2);

    if (badge) {
      ctx.drawImage(badge, cx - size / 2, cy - size / 2, size, size);
    } else {
      drawStickerDisc(ctx, spec.sticker, cx, cy, size / 2);
    }
  }

  /* -- the headline, the meta and the caption ---------------------------- */

  const headline = spec.headline.toUpperCase();
  const headlineSize = fittedSize(ctx, headline, INNER, 96, 400, display);
  font(ctx, 400, headlineSize, display);
  ctx.fillStyle = paper;
  ctx.fillText(headline, PAD, 1530);

  font(ctx, 700, 40, condensed);
  ctx.fillStyle = INK_SOFT();
  ctx.fillText(spec.meta.toUpperCase(), PAD, 1600);

  font(ctx, 600, 36, condensed);
  ctx.fillStyle = INK_MUTE();
  wrap(ctx, spec.caption, INNER, 2).forEach((line, index) => {
    ctx.fillText(line, PAD, 1682 + index * 46);
  });

  /* -- the footer -------------------------------------------------------- */

  font(ctx, 700, 34, condensed);
  ctx.fillStyle = INK_MUTE();
  ctx.textAlign = 'right';
  ctx.fillText(spec.domain.toUpperCase(), SHARE_POSTER_WIDTH - PAD, SHARE_POSTER_HEIGHT - 90);
  ctx.textAlign = 'left';
}
