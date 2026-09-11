/**
 * The card, as HTML.
 *
 * The painted plate is the whole background. Everything this file draws goes
 * into the one band of clear paper the plate leaves — see `PLATES` in
 * `config.mjs` for why that band is much shorter than the artwork suggests.
 *
 * Text is laid out in a flex column centred in the band rather than at measured
 * offsets, so a long trick name pushes its own line around instead of landing
 * on a palm tree. Anything that could still overflow is shrunk to fit by the
 * script at the bottom, after the fonts have loaded.
 */

import { COLOURS, PLATES, SPORT_COLOUR, SPORT_LABEL } from './config.mjs';
import { shortDate } from './caption.mjs';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

/** A rough-edged block, the way every filled shape in the brand looks. */
const block = (fill, seed = 4) =>
  `<svg class="fill" viewBox="0 0 200 60" preserveAspectRatio="none"><rect x="2" y="2" width="196" height="56" fill="${fill}" filter="url(#rough${seed})"/></svg>`;

/** The pink brush underline that sits beneath a headline. */
const underline = `<svg class="rule" viewBox="0 0 500 22" preserveAspectRatio="none"><path d="M6 13 C 150 5, 350 3, 494 8 L 493 16 C 345 12, 160 15, 8 20 Z" fill="${COLOURS.pink}" filter="url(#rough4)"/></svg>`;

const pin = `<svg class="pin" viewBox="0 0 17 22"><path d="M8.5 0C3.8 0 0 3.8 0 8.5 0 15 8.5 22 8.5 22S17 15 17 8.5C17 3.8 13.2 0 8.5 0zm0 11.8a3.3 3.3 0 110-6.6 3.3 3.3 0 010 6.6z" fill="${COLOURS.pink}"/></svg>`;

/** Sport chips, one per sport the thing belongs to. */
const chips = (sports) =>
  `<div class="chips">${sports
    .map(
      (sport) =>
        `<div class="chip">${block(SPORT_COLOUR[sport], 5)}<span>${escape(SPORT_LABEL[sport])}</span></div>`,
    )
    .join('')}</div>`;

const LAYOUTS = {
  'challenge-new': ({ title, verb, goal, starts, ends }) => `
    <div class="title">${escape(title)}</div>
    ${underline}
    <div class="line">${escape(verb)}. ${escape(goal)} of them.</div>
    ${chips(['scooter', 'skate', 'bmx'])}
    <div class="meta">${escape(shortDate(starts))}–${escape(shortDate(ends))} · two weeks to log it</div>`,

  'challenge-last-week': ({ title, verb, goal, ends }) => `
    <div class="title">${escape(title)}</div>
    ${underline}
    <div class="line">${escape(verb)}. ${escape(goal)} of them.</div>
    ${chips(['scooter', 'skate', 'bmx'])}
    <div class="meta">Ends ${escape(shortDate(ends))}</div>`,

  'trick-of-the-week': ({ name, sport, cat, diff, tips }) => `
    <div class="title">${escape(name)}</div>
    ${underline}
    <div class="line clamp">${escape(tips)}</div>
    <div class="chips">
      <div class="chip">${block(SPORT_COLOUR[sport], 5)}<span>${escape(SPORT_LABEL[sport])}</span></div>
      <div class="chip">${block(COLOURS.ink, 6)}<span>${escape(cat)}</span></div>
      <div class="chip">${block(COLOURS.ink, 7)}<span>Level ${escape(diff)}</span></div>
    </div>`,

  'spot-of-the-week': ({ name, town, country, type, tags, sports }) => `
    <div class="title">${escape(name)}</div>
    ${underline}
    <div class="line">${pin}${escape(town)}, ${escape(country)}${type ? ` · ${escape(type)}` : ''}</div>
    ${chips(sports)}
    <div class="meta">${escape(tags.slice(0, 4).join(' · '))}</div>`,

  'events-weekend': ({ events }) => `
    <div class="rows">
      ${events
        .map(
          (event) => `
        <div class="row">
          <div class="day">${block(SPORT_COLOUR[event.sports?.[0]] ?? COLOURS.pink, 5)}<span>${escape(shortDate(event.date))}</span></div>
          <div class="what">
            <b>${escape(event.name)}</b>
            <i>${pin}${escape(event.town)}, ${escape(event.country)}</i>
          </div>
          <div class="kind">${block(COLOURS.ink, 6)}<span>${escape(event.kind)}</span></div>
        </div>`,
        )
        .join('')}
    </div>`,

  'sticker-drop': ({ name, sport, stickerDataUrl }) => `
    <div class="sticker">
      <img src="${stickerDataUrl}" alt="">
      <div class="stickerText">
        <div class="title small">${escape(name)}</div>
        ${underline}
        <div class="chips left">
          <div class="chip">${block(SPORT_COLOUR[sport], 5)}<span>${escape(SPORT_LABEL[sport])}</span></div>
        </div>
      </div>
    </div>`,

  feature: ({ headline, line, countLabel }) => `
    <div class="title">${escape(headline)}</div>
    ${underline}
    <div class="line">${escape(line)}</div>
    ${countLabel ? `<div class="meta">${escape(countLabel)}</div>` : ''}`,
};

/** Every angle that can be drawn. Asserted against the caption composers. */
export const drawnAngles = Object.keys(LAYOUTS);

/**
 * The full page for one card.
 *
 * `plateUrl` is a URL the renderer can load — a `file://` path in CI, so a card
 * never depends on a CDN being up at build time. Fonts do come from Google
 * Fonts; if that is ever a problem the faces can be vendored the way f1gures
 * vendors its own.
 */
export function cardHtml(candidate, { plateUrl }) {
  const layout = LAYOUTS[candidate.angle];
  if (!layout) throw new Error(`no card layout for angle "${candidate.angle}"`);

  const plate = PLATES[candidate.plate];
  if (!plate) throw new Error(`no plate registered as "${candidate.plate}"`);
  const [top, bottom] = plate.band;

  return `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Knewave&family=Archivo:wght@600;800&display=block" rel="stylesheet">
<style>
:root{--ink:${COLOURS.ink};--pink:${COLOURS.pink};--paper:${COLOURS.paper}}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;overflow:hidden;position:relative;font-family:Archivo,system-ui,sans-serif;color:var(--ink)}
.plate{position:absolute;inset:0;width:1080px;height:1350px}
.band{position:absolute;left:60px;right:60px;top:${top + 6}px;height:${bottom - top - 12}px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center}
/* Nothing in the band may be shrunk to make room: a flex child that loses
   height clips its own text mid-line, which is how a trick tip ended up half
   hidden behind the chips below it. */
.band > *{flex:none}
.title{font-family:Knewave,cursive;font-size:84px;line-height:1;white-space:nowrap}
.title.small{font-size:62px}
.rule{width:420px;height:18px;flex:none}
.line{font-weight:800;font-size:30px;line-height:1.25;display:flex;align-items:center;gap:8px;justify-content:center}
.line.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:600;font-size:27px}
.meta{font-weight:800;font-size:24px;letter-spacing:.06em;text-transform:uppercase}
.chips{display:flex;gap:14px;justify-content:center}
.chips.left{justify-content:flex-start}
.chip{position:relative;padding:8px 20px 10px;color:#fff;font-family:Knewave,cursive;font-size:28px;line-height:1}
/* Every label that sits on a painted block needs a stacking context of its own:
   the block is an absolutely positioned SVG, so a plain text node next to it
   paints underneath and the chip comes out empty. */
.chip span,.day span,.kind span{position:relative}
.fill{position:absolute;inset:0;width:100%;height:100%}
.pin{width:15px;height:20px;flex:none}
.rows{display:flex;flex-direction:column;gap:8px;width:100%}
.row{display:flex;align-items:stretch;gap:12px;height:54px}
.day{position:relative;width:118px;flex:none;display:flex;align-items:center;justify-content:center;
  font-family:Knewave,cursive;font-size:26px;color:var(--ink)}
.what{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;text-align:left;padding-left:4px}
.what b{font-family:Knewave,cursive;font-weight:400;font-size:27px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.what i{font-style:normal;font-weight:800;font-size:17px;display:flex;align-items:center;gap:6px;opacity:.75}
.kind{position:relative;flex:none;width:104px;display:flex;align-items:center;justify-content:center;
  color:#fff;font-weight:800;font-size:16px;letter-spacing:.08em;text-transform:uppercase}
.sticker{display:flex;align-items:center;gap:26px;width:100%}
.sticker img{width:190px;height:190px;object-fit:contain;flex:none}
.stickerText{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left}
.stickerText .rule{width:320px}
</style></head>
<body>
<svg width="0" height="0" style="position:absolute"><defs>
  ${[4, 5, 6, 7]
    .map(
      (seed) => `<filter id="rough${seed}" x="-5%" y="-20%" width="110%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.04 0.6" numOctaves="3" seed="${seed}"/>
    <feDisplacementMap in="SourceGraphic" scale="10"/></filter>`,
    )
    .join('')}
</defs></svg>

<img class="plate" src="${plateUrl}" alt="">
<div class="band">${layout(candidate.data)}</div>

<script>
  // Fonts first: measuring before they load shrinks against the fallback face.
  document.fonts.ready.then(() => {
    const fit = (el, max, min) => {
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > max && size > min) el.style.fontSize = --size + 'px';
    };
    const band = document.querySelector('.band');
    document.querySelectorAll('.title, .what b').forEach((el) => {
      fit(el, el.classList.contains('title') ? band.clientWidth - 20 : el.parentElement.clientWidth, 20);
    });
    document.querySelectorAll('.chip span').forEach((el) => fit(el, 220, 14));
  });
</script>
</body></html>`;
}
