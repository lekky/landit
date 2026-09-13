import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ClipPoster,
  FEEL_FACES,
  FeelFace,
  FeelSwatch,
  HardCard,
  MetaChip,
  SegmentedPicker,
  StageMove,
  TrickPill,
  VisibilityLabel,
  WEATHER_ICONS,
  WeatherIcon,
} from './sessions';

/**
 * The session primitives as the markup a browser is handed (T36).
 *
 * Two things here are promises rather than looks, and they are the tests that
 * matter most: **the clip poster embeds and fetches nothing** (no iframe, no
 * image, a new tab with no referrer — plan §6.8), and **the feel faces and
 * weather icons render the paths they were given**. That the paths are the
 * design's own was checked by hand against `Session Tracking.dc.html` when they
 * were transcribed (T36); the design pack lives outside this repository, so a
 * test that read it would skip in CI, and a test that can skip is not a
 * guarantee (LESSONS §5).
 */

describe('ClipPoster', () => {
  const html = renderToStaticMarkup(
    <ClipPoster platform="tiktok" href="https://www.tiktok.com/embed/v2/7234567890123456789" />,
  );

  it('is a link out, opened at source, with no referrer', () => {
    expect(html).toContain('href="https://www.tiktok.com/embed/v2/7234567890123456789"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html.toLowerCase()).toContain('referrerpolicy="no-referrer"');
  });

  it('draws its poster locally and contacts nobody', () => {
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<img');
    expect(html).toContain('TikTok');
    expect(html).toContain('background:#3ac0ff');
  });

  it('rings the play mark only on the detail page’s player', () => {
    expect(html).not.toContain('<circle');
    const player = renderToStaticMarkup(
      <ClipPoster
        platform="youtube"
        variant="player"
        href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      />,
    );
    expect(player).toContain('<circle');
    expect(player).toContain('clipposter player');
  });
});

describe('the drawn glyphs', () => {
  it('have five faces and five weather icons, keyed by core’s ids', () => {
    expect(Object.keys(FEEL_FACES)).toEqual(['sent', 'good', 'fine', 'rough', 'hurt']);
    expect(Object.keys(WEATHER_ICONS)).toEqual(['sun', 'cloud', 'rain', 'wind', 'cold']);
  });

  it('render a face and a weather icon in currentColor, hidden unless titled', () => {
    const face = renderToStaticMarkup(<FeelFace feel="hurt" />);
    expect(face).toContain(`d="${FEEL_FACES.hurt.eyes}"`);
    expect(face).toContain('stroke="currentColor"');
    expect(face).toContain('aria-hidden="true"');
    const titled = renderToStaticMarkup(<WeatherIcon weather="rain" title="Rain" />);
    expect(titled).toContain('<title>Rain</title>');
    expect(titled).toContain('role="img"');
  });

  it('puts a 14px face in a 20px swatch of the feel’s colour', () => {
    const swatch = renderToStaticMarkup(<FeelSwatch feel="sent" color="#10a06a" />);
    expect(swatch).toContain('width:20px');
    expect(swatch).toContain('background:#10a06a');
    expect(swatch).toContain('width="14"');
  });
});

describe('SegmentedPicker', () => {
  const html = renderToStaticMarkup(
    <SegmentedPicker
      label="How it felt"
      value="good"
      onChange={() => {}}
      options={[
        { id: 'sent', label: 'Sent it', color: '#10a06a' },
        { id: 'good', label: 'Good', color: '#9ce05b' },
        { id: 'fine', label: 'Fine' },
      ]}
    />,
  );

  it('is a labelled radio group with one checked cell in the tab order', () => {
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="How it felt"');
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/gi)).toHaveLength(1);
  });

  it('fills the chosen cell with that option’s own colour', () => {
    expect(html).toContain('background:#9ce05b');
    expect(html).not.toContain('background:#10a06a');
  });

  it('puts the first cell in the tab order when nothing is chosen', () => {
    const empty = renderToStaticMarkup(
      <SegmentedPicker
        label="Weather"
        value={null}
        onChange={() => {}}
        options={[
          { id: 'sun', label: 'Sun' },
          { id: 'rain', label: 'Rain' },
        ]}
      />,
    );
    expect(empty.match(/tabindex="0"/gi)).toHaveLength(1);
    expect(empty).not.toContain('aria-checked="true"');
  });
});

describe('cards, chips, pills', () => {
  it('sets the hard shadow size and the lift', () => {
    const html = renderToStaticMarkup(
      <HardCard shadow={7} lift as="article">
        x
      </HardCard>,
    );
    expect(html).toContain('<article');
    expect(html).toContain('class="hcard lift"');
    expect(html).toContain('--hcard-sh:7px');
  });

  it('draws a two-part trick pill only when a stage moved', () => {
    expect(renderToStaticMarkup(<TrickPill name="Tailwhip" />)).not.toContain('tp-move');
    const moved = renderToStaticMarkup(
      <TrickPill name="Tailwhip" move="→ Most times" href="/library/tailwhip" />,
    );
    expect(moved).toContain('<a href="/library/tailwhip" class="trickpill">');
    expect(moved).toContain('<span class="tp-move">→ Most times</span>');
  });

  it('follows a chip’s fill with readable text', () => {
    const html = renderToStaticMarkup(<MetaChip background="#10a06a">Sent it</MetaChip>);
    expect(html).toContain('background:#10a06a');
    expect(html).toContain('color:');
  });

  it('shows a stage move with or without a starting stage', () => {
    const both = renderToStaticMarkup(
      <StageMove
        from={{ label: 'Sometimes', color: '#3AC0FF' }}
        to={{ label: 'Most times', color: '#2EC4B6' }}
      />,
    );
    expect(both.match(/class="stagepill"/g)).toHaveLength(2);
    const fromNothing = renderToStaticMarkup(
      <StageMove from={null} to={{ label: 'Sometimes', color: '#3AC0FF' }} />,
    );
    expect(fromNothing.match(/class="stagepill"/g)).toHaveLength(1);
  });

  it('labels visibility with its glyph', () => {
    const html = renderToStaticMarkup(<VisibilityLabel visibility="members" label="Crew" />);
    expect(html).toContain('Crew');
    expect(html).toContain('<path d="M5.5 8a3.5');
  });
});
