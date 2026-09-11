/**
 * The words. One composer per angle, each one filling a template from the
 * candidate's data.
 *
 * Nothing here is generated prose, and that is the point: a template with a
 * verified figure in it can go out unattended, where a sentence written fresh
 * each day cannot. If a composer has nothing true to say it says less.
 *
 * What a caption may contain is catalogue facts — an event, a spot, a trick, a
 * challenge, a sticker. Never a rider: no names, no handles, no streaks, no
 * leaderboards, nothing a rider typed. There is no rider data in this pipeline
 * at all, which is the simplest way to keep it that way.
 */

import { config } from './config.mjs';
import { SPORT_LABEL } from './config.mjs';

/**
 * A link, tagged for Facebook only.
 *
 * Instagram and TikTok render a URL as plain text, so a tagged one there is
 * unclickable clutter that also reads as spam. Their traffic is read in
 * Buffer's per-post analytics instead.
 */
export function linkFor(path, network) {
  const url = new URL(path, config.site);
  if (config.utmNetworks.includes(network)) {
    url.searchParams.set('utm_source', network);
    url.searchParams.set('utm_medium', 'social');
    url.searchParams.set('utm_campaign', config.utmCampaign);
  }
  return url.toString();
}

const TAGS = {
  scooter: '#scooter #scootering #skatepark',
  skate: '#skateboarding #skatepark #skatelife',
  bmx: '#bmx #bmxlife #skatepark',
  all: '#scooter #skateboarding #bmx #skatepark',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * 2026-09-14 → "14 Sep".
 *
 * Written out rather than left to `Intl`, which renders September as "Sept" in
 * en-GB — four characters where every other month has three, in a line of a
 * card that is measured to the pixel.
 */
export function shortDate(date) {
  const on = new Date(`${date}T12:00:00Z`);
  return `${on.getUTCDate()} ${MONTHS[on.getUTCMonth()]}`;
}

const COMPOSERS = {
  'challenge-new': ({ title, verb, goal, ends }, network) =>
    [
      `New challenge: ${title}.`,
      ``,
      `${verb}. ${goal} of them, by ${shortDate(ends)}.`,
      `Scooter, skate and BMX each have their own.`,
      ``,
      linkFor('/', network),
      ``,
      TAGS.all,
    ].join('\n'),

  'challenge-last-week': ({ title, verb, goal, ends }, network) =>
    [
      `Last week to log it: ${title}.`,
      ``,
      `${verb}. ${goal} of them, by ${shortDate(ends)}.`,
      ``,
      linkFor('/', network),
      ``,
      TAGS.all,
    ].join('\n'),

  'trick-of-the-week': ({ name, sport, slug, tips }, network) =>
    [
      `Trick of the week: ${name}.`,
      ``,
      tips,
      ``,
      `Track it through five stages on Land The Trick.`,
      linkFor(`/library/${slug}`, network),
      ``,
      TAGS[sport],
    ].join('\n'),

  'spot-of-the-week': ({ name, town, country, type, tags, slug }, network) =>
    [
      `Spot of the week: ${name}, ${town}.`,
      ``,
      [type, tags.slice(0, 3).join(', ')].filter(Boolean).join(' · '),
      ``,
      `Find it, and everywhere else, on the map.`,
      linkFor(`/spots/${slug}`, network),
      ``,
      `${TAGS.all} #${country.replace(/\s+/g, '')}`,
    ].join('\n'),

  'events-weekend': ({ events }, network) =>
    [
      `On this weekend:`,
      ``,
      ...events.map((event) => `${shortDate(event.date)} · ${event.name} · ${event.town}`),
      ``,
      `Every comp, jam and session we know about:`,
      linkFor('/events', network),
      ``,
      TAGS.all,
    ].join('\n'),

  'sticker-drop': ({ name, sport, slug }, network) =>
    [
      `Sticker drop: ${name}.`,
      ``,
      `Every trick in the library has its own sticker, and they are never for sale. You earn them.`,
      ``,
      linkFor(`/library/${slug}`, network),
      ``,
      TAGS[sport],
    ].join('\n'),

  feature: ({ headline, line, countLabel }, network) =>
    [
      `${headline}.`,
      ``,
      line,
      ...(countLabel ? [``, countLabel] : []),
      ``,
      linkFor('/', network),
      ``,
      TAGS.all,
    ].join('\n'),
};

/** The caption for one network. */
export function captionFor(candidate, network) {
  const composer = COMPOSERS[candidate.angle];
  if (!composer) throw new Error(`no caption composer for angle "${candidate.angle}"`);
  return composer(candidate.data, network);
}

/** Every angle a card can carry must have words to go with it. */
export const composedAngles = Object.keys(COMPOSERS);

/**
 * TikTok wants a short title of its own, and cuts it off at 90 characters
 * rather than wrapping. Trimmed on a word so it never ends mid-name.
 */
export function tiktokTitleFor(candidate) {
  const first = captionFor(candidate, 'tiktok').split('\n')[0];
  if (first.length <= 90) return first;
  return `${first.slice(0, 87).replace(/\s+\S*$/, '')}…`;
}

/**
 * Alt text. Plain and literal: a screen reader announcing the card should hear
 * what it says, not an advert for it.
 */
export function altFor(candidate) {
  const { angle, data } = candidate;
  switch (angle) {
    case 'challenge-new':
    case 'challenge-last-week':
      return `Land The Trick challenge card: ${data.title}. ${data.verb}, ${data.goal} of them, ${shortDate(data.starts)} to ${shortDate(data.ends)}.`;
    case 'trick-of-the-week':
      return `Land The Trick card: trick of the week, ${data.name}, a ${SPORT_LABEL[data.sport]} trick.`;
    case 'spot-of-the-week':
      return `Land The Trick card: spot of the week, ${data.name} in ${data.town}, ${data.country}.`;
    case 'events-weekend':
      return `Land The Trick card listing ${data.events.length} skatepark events this weekend: ${data.events.map((event) => `${event.name} in ${event.town}`).join('; ')}.`;
    case 'sticker-drop':
      return `Land The Trick card showing the ${data.name} sticker.`;
    default:
      return `Land The Trick card: ${data.headline}. ${data.line}`;
  }
}
