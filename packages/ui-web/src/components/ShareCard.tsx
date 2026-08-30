'use client';

import { useState, type CSSProperties } from 'react';

import { Button, Tag } from './buttons';
import { Difficulty } from './meters';
import { Modal } from './overlays';
import { StickerBadge, type StickerLook } from './StickerBadge';

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
 */

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
   * Told whether the clipboard accepted it. The app toasts; this component
   * does not know what a toast is.
   */
  onCopied?: (ok: boolean) => void;
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

export function ShareCard(props: ShareCardProps) {
  const { headline, meta, dateLabel, caption, onCopied, onClose } = props;
  const isTrick = props.kind === 'trick';
  const hue = isTrick ? props.trick.hue : props.sticker.hue;
  const [copying, setCopying] = useState(false);

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
            <img
              src="/brand/wordmark-line-720.png"
              alt="Land The Trick"
              style={{ height: 26, width: 'auto' }}
            />
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

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <Button size="sm" onClick={copy} disabled={copying}>
            Copy caption
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} style={{ marginLeft: 'auto' }}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
