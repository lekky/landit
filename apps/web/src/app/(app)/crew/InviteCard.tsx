'use client';

import { SITE_URL, formatInviteCode, normaliseInviteCode } from '@landit/core';
import { Button, Icon, Modal } from '@landit/ui-web';
import { useCallback, useEffect, useRef, useState } from 'react';

import { joinHref } from '@/lib/routes';
import { useToast } from '@/providers/toast';

import styles from './crew.module.css';

/**
 * The invite share card: a 1080×1080 image drawn in the browser, handed to the
 * device's own share sheet (`landit-screens-d.jsx`, `InviteCard`/`drawInvite`).
 *
 * **Why a canvas and not a picture of a screen.** The thing being shared is an
 * image, so there has to *be* an image — `navigator.share` will take a `File`,
 * and a square at 1080 is what every messaging app and every story format
 * wants. Drawing it here rather than rendering it on a server keeps the invite
 * code off every log between here and there, and means the card works with no
 * network at all once the page has loaded.
 *
 * **Three fallbacks, in order**, because share support is uneven and a child on
 * a school laptop is exactly who this has to work for: share the file if the
 * browser will take files, share the text and link if it will not, and copy the
 * text to the clipboard if there is no share sheet at all. "Save image" is
 * always there beside it, which is the one that works everywhere.
 *
 * **The card carries a code and nothing about a person.** No avatar, no handle,
 * no rider count — a screenshot of it is going to end up somewhere public, so
 * it says who is inviting only by first name (§6.1: this is an image, not a
 * profile). The code itself is the only thing that grants anything, and it
 * expires.
 */

const CANVAS_SIZE = 1080;

export interface InviteCardProps {
  /** The stored code, in any form. Displayed and drawn as `ABCDE-FGHJK`. */
  code: string;
  crewName: string;
  /** The inviting rider's first name. Never their surname or handle. */
  firstName: string;
  /** "Scooter, skateboard and BMX" — generated, never a hard-coded pair. */
  sportsLine: string;
  onClose: () => void;
}

export function InviteCard({ code, crewName, firstName, sportsLine, onClose }: InviteCardProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const pretty = formatInviteCode(code);
  const url = `${SITE_URL}${joinHref(normaliseInviteCode(code))}`;
  const text = `${firstName} wants you on ${crewName} in Land It. ${sportsLine} tricks, tracked properly. Join with code ${pretty}.`;

  useEffect(() => {
    let dead = false;
    const paint = () => {
      if (!dead && canvas.current) {
        drawInvite(canvas.current, { firstName, crewName, code: pretty, sportsLine });
      }
    };
    paint();
    // The fonts are self-hosted and may not have arrived on first paint; the
    // card would then be drawn in Impact and never corrected.
    if (document.fonts?.ready) void document.fonts.ready.then(paint);
    return () => {
      dead = true;
    };
  }, [firstName, crewName, pretty, sportsLine]);

  const toBlob = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        if (!canvas.current) return resolve(null);
        canvas.current.toBlob(resolve, 'image/png');
      }),
    [],
  );

  const share = async () => {
    setBusy(true);
    try {
      const blob = await toBlob();
      const file = blob ? new File([blob], 'land-it-invite.png', { type: 'image/png' }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Land It', text, url });
      } else if (navigator.share) {
        await navigator.share({ title: 'Land It', text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast('No share sheet here. Link copied instead', 'var(--sky)');
      }
    } catch (error) {
      // Cancelling the share sheet is not a failure, and telling a rider it was
      // would make every "no thanks" look like a bug.
      if ((error as { name?: string })?.name !== 'AbortError') {
        toast("Couldn't open the share sheet", 'var(--red)');
      }
    }
    setBusy(false);
  };

  const save = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = 'land-it-invite.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
    toast('Invite image saved', 'var(--green)');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Invite link copied', 'var(--sky)');
    } catch {
      toast('Copy the code instead: ' + pretty, 'var(--sky)');
    }
  };

  return (
    <Modal onClose={onClose} width={440} label="Invite a mate">
      <div className={styles.invite}>
        <div className="eyebrow">Invite a mate</div>
        <h3 className={`d ${styles.inviteHead}`}>Send them this</h3>
        <p className={`cond ${styles.inviteLede}`}>
          Share opens your phone&rsquo;s own sheet, so it goes straight to wherever you talk to
          them. The code works for {INVITE_DAYS} days.
        </p>

        <canvas
          ref={canvas}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className={styles.inviteCanvas}
          aria-label={`Invite to ${crewName}, join code ${pretty}`}
        />

        <div className={styles.inviteButtons}>
          <Button onClick={share} disabled={busy} className={styles.inviteShare}>
            <span className={styles.inviteShareLabel}>
              <Icon name="plus" size={15} strokeWidth={3} />
              {busy ? 'Opening…' : 'Share'}
            </span>
          </Button>
          <Button variant="ghost" size="sm" onClick={save}>
            Save image
          </Button>
          <Button variant="ghost" size="sm" onClick={copy}>
            Copy link
          </Button>
        </div>

        <div className={styles.inviteFoot}>
          <div>
            <div className="lab" style={{ color: 'var(--ink-3)' }}>
              Join code
            </div>
            <div className={`d ${styles.inviteCode}`}>{pretty}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} style={{ marginLeft: 'auto' }}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Mirrors `INVITE_EXPIRY_DAYS`; the hook is what actually sets the date. */
const INVITE_DAYS = 14;

/* ------------------------------------------------------------ the drawing -- */

/** The design's own family stacks, so the card is drawn in the page's fonts. */
function family(variable: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

/**
 * Draws the square. A direct port of `drawInvite` in `landit-screens-d.jsx`,
 * with one deliberate change: the sports line is passed in rather than being
 * the prototype's hard-coded "SCOOTER AND SKATEBOARD", because Land It ships
 * three sports and the plan forbids a screen that assumes a pair (§7).
 */
function drawInvite(
  canvas: HTMLCanvasElement,
  {
    firstName,
    crewName,
    code,
    sportsLine,
  }: Record<'firstName' | 'crewName' | 'code' | 'sportsLine', string>,
): void {
  const S = CANVAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = S;
  canvas.height = S;

  const ink = '#12100B';
  const paper = '#FFFDF5';
  const yellow = '#FFC23F';
  const orange = '#FF5A1F';
  const display = family('--fd', 'Impact, sans-serif');
  const condensed = family('--fc', 'sans-serif');

  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, S, S);

  // The page's dot pattern, at the card's scale.
  ctx.fillStyle = 'rgba(255,253,245,.07)';
  for (let x = 40; x < S; x += 34) {
    for (let y = 40; y < S; y += 34) {
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The tilted yellow block of the wordmark.
  ctx.save();
  ctx.translate(84, 96);
  ctx.rotate(-0.06);
  ctx.fillStyle = yellow;
  ctx.fillRect(0, 0, 76, 76);
  ctx.strokeStyle = paper;
  ctx.lineWidth = 7;
  ctx.strokeRect(0, 0, 76, 76);
  ctx.restore();

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = paper;
  ctx.font = `400 62px ${display}`;
  ctx.fillText('LAND', 186, 158);
  const landWidth = ctx.measureText('LAND').width;
  ctx.fillStyle = yellow;
  ctx.fillText('IT', 186 + landWidth + 6, 158);

  ctx.fillStyle = orange;
  ctx.save();
  ctx.translate(84, 250);
  ctx.rotate(-0.02);
  ctx.fillRect(0, 0, S - 168, 300);
  ctx.strokeStyle = paper;
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, S - 168, 300);
  ctx.restore();

  ctx.fillStyle = paper;
  ctx.font = `400 118px ${display}`;
  ctx.fillText('RIDE WITH', 130, 400);
  fitText(ctx, crewName.toUpperCase(), 130, 510, S - 260, 118, display);

  ctx.fillStyle = '#C9C2B4';
  ctx.font = `600 40px ${condensed}`;
  ctx.fillText(`${firstName.toUpperCase()} WANTS YOU ON THE BOARD`, 88, 638);

  ctx.fillStyle = paper;
  ctx.font = `400 52px ${display}`;
  fitText(ctx, `${sportsLine.toUpperCase()}`, 88, 748, S - 176, 52, display);
  ctx.font = `400 52px ${display}`;
  ctx.fillText('TRICKS, TRACKED PROPERLY.', 88, 812);

  ctx.fillStyle = yellow;
  ctx.fillRect(88, 872, S - 176, 118);
  ctx.fillStyle = ink;
  ctx.font = `400 56px ${display}`;
  ctx.fillText(`JOIN CODE ${code}`, 120, 950);

  ctx.fillStyle = '#8d8679';
  ctx.font = `600 34px ${condensed}`;
  const domain = SITE_URL.replace(/^https?:\/\//, '').toUpperCase();
  ctx.fillText(domain, S - 88 - ctx.measureText(domain).width, 1030);
}

/**
 * Draw one line, shrinking it until it fits.
 *
 * The prototype truncated a long crew name at 13 characters, which turns "Bay
 * Eight Shredders" into "BAY EIGHT SHR" on a card somebody is about to post.
 * A crew name is 40 characters by the field, the rider chose it, and the card
 * has room to shrink — so it shrinks, and only stops at a size that is still
 * readable at thumbnail scale.
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  fontFamily: string,
): void {
  let px = size;
  ctx.font = `400 ${px}px ${fontFamily}`;
  while (ctx.measureText(text).width > maxWidth && px > size * 0.5) {
    px -= 2;
    ctx.font = `400 ${px}px ${fontFamily}`;
  }
  ctx.fillText(text, x, y, maxWidth);
}
