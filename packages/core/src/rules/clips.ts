/**
 * The clip vault, as pure arithmetic (plan §6.6).
 *
 * Every number here is *defined* in this file and *enforced* in
 * `pocketbase/hooks/50_clips.pb.js` — the cap is read off the rider's `plans`
 * record at write time, so a client that lied about how full its vault is gets
 * a 403 rather than a bigger vault. Nothing below is a security boundary; it is
 * what lets the panel say "1.9GB of 2GB" before the server has been asked.
 *
 * The cap is **never** taken from `PLAN[id].clipCapBytes` by a screen. That
 * constant is the seed's copy of the number; the live one lives on the plan
 * record so staff can tune it without a deploy, and a screen reading the
 * constant would make a staff edit invisible (LESSONS §4, and the same reason
 * the library reads tricks from the collection).
 */

/**
 * What one clip may weigh, matching `clips.file`'s `maxSize` in the initial
 * migration. Checked in the browser only so a rider is told before a 200MB
 * upload rather than after it — PocketBase refuses it either way.
 */
export const CLIP_MAX_BYTES = 209715200;

/** The mime types `clips.file` accepts, in the migration's order. */
export const CLIP_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'image/jpeg',
  'image/png',
] as const;

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Enough of a file for the rules below. Deliberately not `File`: `@landit/core` never touches the DOM. */
export interface ClipFileLike {
  readonly size: number;
  readonly type: string;
  readonly name?: string;
}

/**
 * Bytes as a rider reads them: "2GB", "1.9GB", "512MB", "under 1MB".
 *
 * Plain arithmetic and `toFixed`, never `toLocaleString` — this string renders
 * on the server and again in the browser, and anything ICU-derived that renders
 * on both sides of hydration is a mismatch that throws the tree away
 * (LESSONS §3a).
 */
export function formatBytes(bytes: number): string {
  const value = Math.max(0, Math.floor(bytes || 0));
  if (value === 0) return '0MB';
  if (value >= GB) {
    const gb = value / GB;
    // One decimal, but "2GB" rather than "2.0GB" — the cap is quoted in whole
    // gigabytes everywhere else in the product (plan §2.4).
    const rounded = Math.round(gb * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}GB`;
  }
  if (value >= MB) return `${Math.round(value / MB)}MB`;
  return 'under 1MB';
}

/** Is this photo or video? Decided from the mime type, which the server re-decides from the file. */
export function clipKindOf(type: string): 'video' | 'photo' {
  return String(type || '').startsWith('image/') ? 'photo' : 'video';
}

export interface ClipVault {
  /** Does this plan include clips at all? False on Rookie, whose cap is zero. */
  readonly included: boolean;
  readonly capBytes: number;
  readonly usedBytes: number;
  /** Never negative: a rider who was downgraded can be over their new cap. */
  readonly remainingBytes: number;
  /** No room for anything more. Always true when the plan includes no vault. */
  readonly full: boolean;
  /** "1.9GB of 2GB used", or null when there is no vault to describe. */
  readonly usageLabel: string | null;
}

/**
 * What a rider's vault looks like right now.
 *
 * `capBytes` comes from the plan record, `usedBytes` from summing the rider's
 * own clip rows — which is also how the hook measures it, so the panel and the
 * refusal agree.
 */
export function clipVault(input: { usedBytes: number; capBytes: number }): ClipVault {
  const capBytes = Math.max(0, Math.floor(input.capBytes || 0));
  const usedBytes = Math.max(0, Math.floor(input.usedBytes || 0));
  const included = capBytes > 0;
  const remainingBytes = Math.max(0, capBytes - usedBytes);

  return {
    included,
    capBytes,
    usedBytes,
    remainingBytes,
    full: !included || remainingBytes === 0,
    usageLabel: included ? `${formatBytes(usedBytes)} of ${formatBytes(capBytes)} used` : null,
  };
}

/** Would one more file of this size fit? The same sum the upload hook does. */
export function clipFits(vault: ClipVault, bytes: number): boolean {
  return vault.included && vault.usedBytes + Math.max(0, bytes) <= vault.capBytes;
}

/**
 * Why this file cannot be saved, in a sentence a fourteen year old can read —
 * or `null` when it can.
 *
 * Checked in the browser purely so the rider hears it before the upload rather
 * than after it. The server checks all three again and is the one that decides
 * (plan §3, §6.6): this returning `null` is not permission.
 */
export function clipUploadProblem(file: ClipFileLike, vault: ClipVault): string | null {
  if (!vault.included) return 'Saving clips is part of the paid plans.';
  if (!(CLIP_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'That file will not work. Clips can be MP4, MOV or WebM video, or a JPEG or PNG photo.';
  }
  if (file.size > CLIP_MAX_BYTES) {
    return `That file is ${formatBytes(file.size)}. One clip can be up to ${formatBytes(CLIP_MAX_BYTES)}.`;
  }
  if (!clipFits(vault, file.size)) {
    return `That would take you past your ${formatBytes(vault.capBytes)} vault. Delete a clip to make room.`;
  }
  return null;
}
