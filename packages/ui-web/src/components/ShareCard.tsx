'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

import { Button, Tag } from './buttons';
import { Difficulty } from './meters';
import { Modal } from './overlays';
import { StickerBadge, type StickerLook } from './StickerBadge';
import {
  SHARE_POSTER_HEIGHT,
  SHARE_POSTER_WIDTH,
  drawSharePoster,
  type ShareTrickLook,
  type SharePosterSpec,
} from './share-poster';

/**
 * The share card — the one modal that renders a thing worth screenshotting
 * (`ShareCard` in `design-handoff/design/landit-ui.jsx`).
 *
 * It takes a `kind`, and that is the whole reason it is one component rather
 * than two: the trick page and the sticker wall share a card, a caption and a
 * copy button, and differ only in what sits in the coloured block. T7 shipped
 * the trick page without its "Share it" button on purpose so this stayed one
 * thing (plan §7, T7; issue #51).
 *
 * **Everything it renders is handed to it already formatted.** The prototype
 * built its own date with `toLocaleDateString` and wrote "N day streak" into
 * the footer. Both are traps here: ICU output differs between Node and the
 * browser, and a hydration mismatch throws the client tree away (LESSONS §3a),
 * and the streak stopped counting days on 2026-08-16 (plan §1) — a unit written
 * into a component is a unit nobody sweeps when the rule moves (LESSONS §4).
 * So the caller formats; this draws.
 *
 * **`poster` is what makes it shareable** (owner, 2026-09-13, in chat). Given
 * one, the card draws itself as a 1080×1920 PNG on a hidden canvas and offers
 * Share and Save image beside Copy caption; without one it renders exactly as
 * it always has. It is optional for that reason and no other — `packages/ui-web`
 * is additive-only once merged, and a card that grew two buttons for every
 * existing caller would be a change to one, not an addition to it.
 */

export type { ShareTrickLook };

/** How a share actually left the device. Reported for the analytics event. */
export type ShareMethod = 'file' | 'text' | 'clipboard' | 'save';

export type SharePoster = {
  /** The page the share sheet carries beside the image. */
  url: string;
  /** `landed-the-tailwhip.png` — what a saved file is called. */
  fileName: string;
  /** Where the app serves the one-line wordmark from. */
  wordmarkSrc?: string;
};

export type ShareCardProps = {
  /** The headline under the block: "Landed the Tailwhip", "Earned Gnarly". */
  headline: string;
  /** "Sam · 14 tricks landed · 3 week streak". Formatted by the caller. */
  meta: string;
  /** "16 Aug" — formatted by the caller, never by ICU in the browser. */
  dateLabel: string;
  /** The text the copy button puts on the clipboard, and the line shown below the card. */
  caption: string;
  /**
   * Turns the card into an image a rider can send. Omit it and the card is
   * exactly what it was before: a picture on a screen and a caption to copy.
   */
  poster?: SharePoster;
  /**
   * Told whether the clipboard accepted it. The app toasts; this component
   * does not know what a toast is.
   */
  onCopied?: (ok: boolean) => void;
  /**
   * Told how the image left, once it has. Never fired for a share sheet the
   * rider dismissed — a cancelled share is not a share.
   */
  onShared?: (method: ShareMethod) => void;
  /** Told when the share sheet itself failed, so the app can say so. */
  onShareFailed?: () => void;
  onClose: () => void;
} & ({ kind: 'trick'; trick: ShareTrickLook } | { kind: 'sticker'; sticker: StickerLook });

const CARD: CSSProperties = {
  background: 'var(--ink)',
  border: '3px solid var(--ink)',
  marginTop: 12,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

/**
 * The canvas is rendered, not hidden with `display: none`, and parked off the
 * side of the page. A canvas holds its bitmap either way; what it must not do
 * is take part in the layout of a modal that has to fit a phone, or be read out
 * as a second copy of a card the rider is already looking at.
 */
const OFFSCREEN: CSSProperties = {
  position: 'absolute',
  left: -99999,
  top: 0,
  width: 1,
  height: 1,
  overflow: 'hidden',
  pointerEvents: 'none',
};

const DEFAULT_WORDMARK = '/brand/wordmark-line-720.png';

export function ShareCard(props: ShareCardProps) {
  const { headline, meta, dateLabel, caption, poster, onCopied, onShared, onShareFailed, onClose } =
    props;
  const isTrick = props.kind === 'trick';
  const hue = isTrick ? props.trick.hue : props.sticker.hue;
  const [copying, setCopying] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  const wordmarkSrc = poster?.wordmarkSrc ?? DEFAULT_WORDMARK;
  const posterUrl = poster?.url;

  /*
   * Both callers build their `trick`/`sticker` object inline, so it is a new
   * object on every render and useless as a dependency — the effect below would
   * redraw the poster, and reload its images, every time the modal re-rendered.
   * The contents are what decide whether a redraw is owed, so the contents are
   * the dependency and the object itself is read through a ref.
   */
  const look = isTrick ? props.trick : props.sticker;
  const lookKey = JSON.stringify(look);
  const lookRef = useRef(look);
  lookRef.current = look;

  useEffect(() => {
    if (!posterUrl) return;
    let dead = false;

    const current = lookRef.current;
    const spec: SharePosterSpec = {
      headline,
      meta,
      dateLabel,
      caption,
      wordmarkSrc,
      domain: domainOf(posterUrl),
      ...(isTrick
        ? { kind: 'trick', trick: current as ShareTrickLook }
        : { kind: 'sticker', sticker: current as StickerLook }),
    };

    const paint = () => {
      if (!dead && canvas.current) void drawSharePoster(canvas.current, spec);
    };
    paint();
    // The fonts are self-hosted and may not have arrived on the first paint;
    // the poster would otherwise be drawn in Impact and never corrected.
    if (document.fonts?.ready) void document.fonts.ready.then(paint);

    return () => {
      dead = true;
    };
  }, [posterUrl, headline, meta, dateLabel, caption, wordmarkSrc, isTrick, lookKey]);

  const toBlob = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        if (!canvas.current) return resolve(null);
        canvas.current.toBlob(resolve, 'image/png');
      }),
    [],
  );

  // `navigator.clipboard.writeText` rejects rather than throwing — an insecure
  // context, a denied permission, or a document that is not focused. The
  // prototype's synchronous try/catch caught none of those and reported every
  // failure as a success.
  const copy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(caption);
      onCopied?.(true);
    } catch {
      onCopied?.(false);
    } finally {
      setCopying(false);
    }
  };

  /**
   * Three fallbacks, in order, because share support is uneven and a child on a
   * school laptop is exactly who this has to work for: send the image if the
   * browser will take files, send the caption and the link if it will not, and
   * copy the caption if there is no share sheet at all. "Save image" sits
   * beside it, which is the one that works everywhere.
   */
  const share = async () => {
    if (!poster) return;
    setBusy(true);
    try {
      const blob = await toBlob();
      const file = blob ? new File([blob], poster.fileName, { type: 'image/png' }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: headline, text: caption, url: poster.url });
        onShared?.('file');
      } else if (navigator.share) {
        await navigator.share({ title: headline, text: caption, url: poster.url });
        onShared?.('text');
      } else {
        await navigator.clipboard.writeText(`${caption} ${poster.url}`);
        onShared?.('clipboard');
      }
    } catch (error) {
      // Dismissing the share sheet is not a failure, and telling a rider it was
      // would make every "no thanks" look like a bug.
      if ((error as { name?: string })?.name !== 'AbortError') onShareFailed?.();
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!poster) return;
    setBusy(true);
    try {
      const blob = await toBlob();
      if (!blob) return;
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = poster.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
      onShared?.('save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={420} label={headline}>
      <div style={{ padding: 20 }}>
        <div className="eyebrow">Share it</div>

        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {/*
             * The one-line wordmark (2026-08-30 header pack), served by the web
             * app. This card drew "LandIt" with the scooter glyph until the
             * owner spotted it still wearing the pre-rename mark — the last
             * place in the product that did.
             */}
            <img src={wordmarkSrc} alt="Land The Trick" style={{ height: 26, width: 'auto' }} />
            <span className="lab" style={{ marginLeft: 'auto', color: '#8d8679' }}>
              {dateLabel}
            </span>
          </div>

          <div
            style={{
              background: hue,
              border: '3px solid var(--paper)',
              padding: '20px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              alignItems: isTrick ? 'flex-start' : 'center',
            }}
          >
            {props.kind === 'trick' ? (
              <>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  <Tag color="var(--ink)">{props.trick.categoryLabel}</Tag>
                  <Tag color="var(--paper)" style={{ color: 'var(--ink)' }}>
                    {props.trick.sportLabel}
                  </Tag>
                </div>
                <div
                  className="d"
                  style={{
                    fontSize: 38,
                    color: '#fff',
                    textShadow: '3px 3px 0 var(--ink)',
                    lineHeight: 0.92,
                  }}
                >
                  {props.trick.name}
                </div>
                <Difficulty value={props.trick.difficulty} />
              </>
            ) : (
              <div style={{ width: 130 }}>
                <StickerBadge sticker={props.sticker} earned />
              </div>
            )}
          </div>

          <div>
            <div className="d" style={{ fontSize: 22, color: 'var(--paper)' }}>
              {headline}
            </div>
            <div className="lab" style={{ color: '#C9C2B4', marginTop: 6 }}>
              {meta}
            </div>
          </div>
        </div>

        <p
          className="cond"
          style={{
            margin: '14px 0 12px',
            fontSize: 13.5,
            color: 'var(--ink-2)',
            letterSpacing: '.03em',
          }}
        >
          {caption}
        </p>

        {/*
          Two rows, not one that wraps. Four buttons fit neither the modal on a
          phone nor the 420 it is drawn at above the breakpoint, and left to
          wrap they put Close alone on a line of its own — which reads as a
          layout fault rather than a decision. So: sending it on the top row,
          and leaving on the bottom one, the same shape at every width.
        */}
        {poster ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <Button size="sm" onClick={share} disabled={busy}>
                {busy ? 'Opening…' : 'Share'}
              </Button>
              <Button size="sm" variant="ghost" onClick={save} disabled={busy}>
                Save image
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <Button size="sm" variant="ghost" onClick={copy} disabled={copying}>
                Copy caption
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose} style={{ marginLeft: 'auto' }}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <Button size="sm" onClick={copy} disabled={copying}>
              Copy caption
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} style={{ marginLeft: 'auto' }}>
              Close
            </Button>
          </div>
        )}

        {poster && (
          <div style={OFFSCREEN} aria-hidden="true">
            <canvas ref={canvas} width={SHARE_POSTER_WIDTH} height={SHARE_POSTER_HEIGHT} />
          </div>
        )}
      </div>
    </Modal>
  );
}

/** "landthetrick.com" from the share URL, so the footer never hard-codes it. */
function domainOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
}
