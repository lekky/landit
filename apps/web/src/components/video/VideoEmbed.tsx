'use client';

import { youtubeEmbedUrl, youtubeWatchUrl } from '@landit/core';
import { Icon } from '@landit/ui-web';
import { useState } from 'react';

import styles from './video.module.css';

/**
 * One rider's video: a poster we draw, and an iframe that appears when asked.
 *
 * **Nothing here contacts Google until the rider clicks.** That is a
 * requirement, not a nicety. Plan §6.8 deliberately runs Land The Trick with **no
 * consent banner** — cookie-less analytics, self-hosted fonts, no cross-site
 * anything — because the audience is children and a cookie wall is the wrong
 * thing to put in front of them. An `<iframe>` rendered on page load would send
 * a request to a Google host before the rider had chosen anything, and
 * `youtube-nocookie.com` does not change that: the hostname is a promise about
 * *cookies*, not about *requests*, and it is the request that would put a
 * consent banner back on the roadmap.
 *
 * So three things are true of the render below, and all three are load-bearing:
 *
 * 1. **No iframe until `playing`.** The frame is mounted by the click, not
 *    hidden by CSS — a hidden iframe still loads.
 * 2. **The poster is drawn from design tokens, never fetched.**
 *    `img.youtube.com/vi/<id>/hqdefault.jpg` is the obvious thumbnail and it is
 *    exactly the request this component exists to avoid; using it would
 *    reintroduce the page-load ping while looking like it had been avoided,
 *    which is the worst of the three options. What a rider sees instead is a
 *    hard-shadowed ink panel with a play mark on it, which is the design
 *    language anyway (`design-handoff/README.md`: zero radius, hard offset
 *    shadows).
 * 3. **`youtubeEmbedUrl` is the only URL builder**, and it throws on anything
 *    that is not an eleven-character id. There is no string concatenation here
 *    for an attacker-supplied value to land in — and the stored value has been
 *    through the hook's parser anyway (plan §3 guarantee 2).
 *
 * `e2e/video-links.spec.ts` asserts the first point by counting requests to
 * Google hosts on load, because a comment claiming it is not a test.
 */
export function VideoEmbed({
  videoId,
  label,
  onPlay,
  posterSrc,
}: {
  /** Eleven characters. Anything else throws, by design. */
  videoId: string;
  /** What this video is of, for the play button's accessible name. */
  label: string;
  /**
   * A real preview frame to draw behind the play mark (2026-09-13).
   *
   * Optional and additive: a rider's own video links pass nothing and get the
   * drawn poster exactly as before. **It must be a URL on our own host** — the
   * staff tutorial passes one from `tricks.video_thumb`, fetched once
   * server-side, precisely so the page does not ask `i.ytimg.com` for a
   * thumbnail on load. Point 2 below is the rule this prop implements rather
   * than the exception to it: what changed is *where the image comes from*, not
   * that the page may now talk to Google before the press.
   */
  posterSrc?: string;
  /**
   * Fired once, on the press that mounts the iframe (T35).
   *
   * Optional and additive: a rider's own video links pass nothing and behave
   * exactly as they did. The trick page's staff-picked tutorial passes an
   * analytics capture, because the press *is* the event — this component's
   * whole design means there is no earlier moment when a video can be said to
   * have been watched.
   */
  onPlay?: () => void;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className={styles.frame}>
        <iframe
          className={styles.iframe}
          src={youtubeEmbedUrl(videoId)}
          title={label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={styles.frame}>
      <button
        type="button"
        className={styles.poster}
        onClick={() => {
          onPlay?.();
          setPlaying(true);
        }}
        aria-label={`Play ${label}`}
      >
        {/*
          A plain `<img>` rather than `next/image`: the source is a PocketBase
          host that differs between a laptop, CI and the box, so `next/image`
          would need `remotePatterns` kept in step with three deployments to
          optimise a 320×180 thumbnail. `alt=""` because the button already
          names what it plays — a description here would be read out twice.
        */}
        {posterSrc && (
          <>
            {/*
              A plain `<img>`, and the rule is silenced rather than satisfied:
              `next/image` would need `remotePatterns` listing every PocketBase
              host this runs against — a laptop, CI and the box — kept in step
              by hand, and a mismatch renders a *broken* image rather than an
              unoptimised one. The file is a ~15KB 320×180 JPEG our own backend
              already serves, so the optimiser has almost nothing to save.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.posterShot} src={posterSrc} alt="" loading="lazy" />
            <span className={styles.posterScrim} />
          </>
        )}
        <span className={styles.playMark}>
          <Icon name="play" size={22} />
        </span>
        <span className={`lab ${styles.posterLabel}`}>Watch on YouTube</span>
      </button>
      {/*
       * The way out, for a rider who would rather open it where it lives — and
       * the honest statement of where that is. `rel="noreferrer"` so the page
       * they came from is not handed to YouTube along with them.
       */}
      <a
        className={`cond ${styles.posterOut}`}
        href={youtubeWatchUrl(videoId)}
        target="_blank"
        rel="noreferrer noopener"
      >
        Open on YouTube
      </a>
    </div>
  );
}
