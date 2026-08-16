'use client';

import { clipUploadProblem, clipVault, formatBytes } from '@landit/core';
import { Button, Icon, Modal, Panel, Slot } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { clipPlaybackAction, deleteClipAction, uploadClipAction } from './clip-actions';
import styles from './trick.module.css';

/**
 * "Your clips" (screenshot 09, plan §6.6).
 *
 * Four states, and every one of them is decided by two numbers the *server*
 * produced — the cap off the rider's `plans` record and the bytes off their own
 * clip rows:
 *
 * 1. **No vault** (cap zero, i.e. Rookie). The upsell, which is a statement of
 *    what a plan includes: no countdown, no "you're missing out", no number
 *    going the wrong way (plan §6.4, standard 13). A rider who *downgraded*
 *    sees their existing clips above it and can still watch and delete them —
 *    retention default, plan §6.6: dropping to Rookie blocks new saves, it does
 *    not take away what is already there.
 * 2. **Room left.** Usage line and "Add a clip".
 * 3. **Full, with a bigger plan to point at.** Usage, and the offer.
 * 4. **Full at the top plan.** Usage, and delete-to-make-room — explicitly *no*
 *    upsell, because there is nothing honest left to sell.
 *
 * Nothing here is a boundary. The cap, the ownership and the consent gate are
 * enforced in `pocketbase/hooks/50_clips.pb.js` and the collection's owner-only
 * rules on every write path, including one made with a superuser token
 * (plan §3, guarantee 2). `clipUploadProblem` runs before the upload only so a
 * rider hears "that would take you past your 2GB vault" before sending 40MB
 * over a phone connection, not after.
 *
 * A clip's bytes are never in this page. Tiles are drawn from the metadata; the
 * URL is minted on the press, against a token that lives for minutes.
 */

export interface ClipView {
  readonly id: string;
  readonly kind: 'video' | 'photo';
  /** Formatted on the server — anything locale-derived on both sides is a hydration risk. */
  readonly dateLabel: string;
}

export interface ClipUpgrade {
  readonly name: string;
  readonly capLabel: string;
}

export interface ClipsPanelProps {
  readonly trickId: string;
  readonly slug: string;
  readonly clips: readonly ClipView[];
  /** Across every trick, not just this one — the vault is the account's. */
  readonly usedBytes: number;
  /** From the `plans` record, so a staff retune needs no deploy. */
  readonly capBytes: number;
  /** The rider's plan, by the name on its record. */
  readonly planName: string;
  /** The cheapest live plan with a bigger vault, or `null` at the top of the range. */
  readonly upgrade: ClipUpgrade | null;
}

export function ClipsPanel({
  trickId,
  slug,
  clips,
  usedBytes,
  capBytes,
  planName,
  upgrade,
}: ClipsPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, startTransition] = useTransition();
  const [viewing, setViewing] = useState<{ url: string; kind: 'video' | 'photo' } | null>(null);

  const vault = clipVault({ usedBytes, capBytes });

  const pick = (file: File) => {
    const problem = clipUploadProblem({ size: file.size, type: file.type, name: file.name }, vault);
    if (problem) {
      toast(problem, 'var(--red)');
      return;
    }

    const form = new FormData();
    form.set('file', file);
    form.set('trickId', trickId);
    form.set('slug', slug);

    startTransition(async () => {
      const result = await uploadClipAction(form);
      if (!result.ok) {
        toast(result.message, 'var(--red)');
        return;
      }
      toast('Clip saved.', 'var(--green)');
      router.refresh();
    });
  };

  const remove = (clipId: string) => {
    startTransition(async () => {
      const result = await deleteClipAction({ clipId, slug });
      if (!result.ok) {
        toast(result.message, 'var(--red)');
        return;
      }
      router.refresh();
    });
  };

  const play = (clipId: string) => {
    startTransition(async () => {
      const result = await clipPlaybackAction(clipId);
      if (!result.ok) {
        toast(result.message, 'var(--red)');
        return;
      }
      setViewing({ url: result.url, kind: result.kind });
    });
  };

  return (
    <Panel flat className={styles.sidePanel}>
      <div className={styles.panelHead}>
        <div className="lab">Your clips</div>
        <span
          className={`lab ${styles.panelHeadEnd}`}
          style={{ color: vault.included ? 'var(--ink-3)' : 'var(--violet)' }}
        >
          {vault.included ? planName : (upgrade?.name ?? 'Shredder')}
        </span>
      </div>

      {clips.length > 0 ? (
        <div className={styles.clipGrid}>
          {clips.map((clip) => (
            <div key={clip.id} className={styles.clipTile}>
              <button
                type="button"
                className={styles.clipOpen}
                onClick={() => play(clip.id)}
                disabled={busy}
                aria-label={`Play the clip from ${clip.dateLabel}`}
              >
                <Icon
                  name={clip.kind === 'photo' ? 'cam' : 'play'}
                  size={22}
                  fill={clip.kind === 'photo' ? 'none' : 'var(--yellow)'}
                />
              </button>
              <span className={`lab ${styles.clipDate}`}>{clip.dateLabel}</span>
              <button
                type="button"
                className={styles.clipDelete}
                onClick={() => remove(clip.id)}
                disabled={busy}
                aria-label={`Delete the clip from ${clip.dateLabel}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        vault.included && <Slot label="No clips yet: film the attempt" minHeight={90} />
      )}

      {vault.included ? (
        <>
          <p className={`cond ${styles.clipUsage}`}>{vault.usageLabel}</p>

          {!vault.full && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png"
                className={styles.clipInput}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) pick(file);
                }}
              />
              <Button
                variant="ink"
                size="sm"
                wide
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className={styles.clipAdd}
              >
                <span className={styles.clipAddLabel}>
                  <Icon name="cam" size={15} /> Add a clip
                </span>
              </Button>
            </>
          )}

          {vault.full &&
            (upgrade ? (
              <div className={styles.clipFull} style={{ borderColor: 'var(--violet)' }}>
                <p className={styles.clipFullCopy}>
                  Your {formatBytes(vault.capBytes)} vault is full. {upgrade.name} comes with{' '}
                  {upgrade.capLabel}, or delete a clip to make room.
                </p>
                <Button size="sm" wide disabled style={{ background: 'var(--violet)' }}>
                  See plans
                </Button>
                <p className={`cond ${styles.clipNote}`}>Upgrading is not switched on yet.</p>
              </div>
            ) : (
              <div className={styles.clipFull}>
                <p className={styles.clipFullCopy}>
                  Your {formatBytes(vault.capBytes)} vault is full. Delete a clip to make room for
                  the next one.
                </p>
              </div>
            ))}
        </>
      ) : (
        <>
          <div className={`slot ${styles.clipSlot}`}>
            <span style={{ color: 'var(--ink-2)' }}>
              Filming your attempts is part of {upgrade?.name ?? 'Shredder'}
            </span>
          </div>
          <Button size="sm" wide disabled style={{ background: 'var(--violet)' }}>
            See plans
          </Button>
          <p className={`cond ${styles.clipNote}`} style={{ marginTop: 10 }}>
            {clips.length > 0
              ? 'Clips you already saved stay yours to watch. New ones need a paid plan.'
              : 'Upgrading is not switched on yet.'}
          </p>
        </>
      )}

      {viewing && (
        <Modal onClose={() => setViewing(null)} width={880} label="Your clip">
          {viewing.kind === 'photo' ? (
            /*
             * A one-off private URL with a minutes-long token on it. `next/image`
             * would fetch it through the optimiser and cache the result under a
             * key the token is not part of — a cached copy of a clip, outliving
             * the token that guards it, served from our own domain. Guarantee 2
             * says the bytes move only against a live token, so this one stays a
             * plain `<img>`.
             */
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewing.url} alt="Your clip" className={styles.clipPlayer} />
          ) : (
            <video src={viewing.url} controls autoPlay className={styles.clipPlayer} />
          )}
        </Modal>
      )}
    </Panel>
  );
}
