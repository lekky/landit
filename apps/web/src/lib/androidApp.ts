/**
 * The Android app's half of the domain handshake (Digital Asset Links).
 *
 * ## What this is for
 *
 * The Play Store app is a **Trusted Web Activity**: an Android binary whose
 * entire contents are this site, rendered by the rider's own Chrome. "Trusted"
 * is literal and it is mutual — the app declares it belongs to
 * `landthetrick.com`, and this file is the site saying the same thing back, by
 * naming the app's package and the certificate it was signed with.
 *
 * Android checks both sides on launch. If they disagree — wrong package, wrong
 * fingerprint, file unreachable — it does not refuse to open the app. It opens
 * it **with a URL bar across the top**, which is the one outcome worth
 * designing against: the app still works, so nothing alerts, and every rider
 * who installed it sees a browser pretending to be an app.
 *
 * ## Why it is generated rather than committed
 *
 * The fingerprint does not exist yet — it comes out of a signing key that only
 * the owner can create, in Play Console, and that a build session must never
 * hold. Committing a placeholder would be worse than committing nothing: a
 * *wrong* statement file verifies as loudly as a right one fails, and the
 * failure mode above is silent.
 *
 * So the statement is assembled from two environment values at request time,
 * and **the route 404s while either is unset** — the same shape as
 * `LANDIT_PREVIEW_KEY` and `LANDIT_OWNER_ID`: a missing value switches the
 * feature off rather than half-configuring it. Publishing the app is then a
 * Coolify value and a restart, not a code change and a deploy.
 *
 * ## Why the fingerprints are a list
 *
 * Play App Signing gives an app **two** certificates that both have to be
 * trusted: the upload key, which signs what the owner uploads, and the app
 * signing key, which Google re-signs the delivered binary with. A statement
 * naming only one of them verifies for the owner's own test build and fails for
 * every rider who installs from the store — which is the hardest version of
 * this bug to find, because the person checking it is the one for whom it
 * works.
 */

/** One Digital Asset Links statement, in the shape Android expects. */
export interface AssetLinkStatement {
  readonly relation: readonly string[];
  readonly target: {
    readonly namespace: 'android_app';
    readonly package_name: string;
    readonly sha256_cert_fingerprints: readonly string[];
  };
}

/**
 * A SHA-256 certificate fingerprint as Play Console prints it: 32 bytes as
 * uppercase hex pairs joined by colons, 95 characters in all.
 *
 * Validated rather than trusted because every way this value arrives — copied
 * from a console, pasted into Coolify, split out of one string here — is a way
 * to arrive truncated, and a truncated fingerprint is the silent failure this
 * file's header describes. Better to serve nothing than to serve a statement
 * that cannot match.
 */
const FINGERPRINT = /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/;

/**
 * An Android package name: dot-separated Java-style segments, each starting
 * with a letter. `com.landthetrick.app` and not `landthetrick`, which Android
 * would reject at install time anyway.
 */
const PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;

/**
 * Split the configured fingerprints and normalise their case.
 *
 * Accepts commas, whitespace or both between them, because the two places this
 * value gets typed — a shell export and a Coolify text box — disagree about
 * which is natural, and neither is worth a support round trip. Lowercase hex is
 * accepted and upper-cased: Play Console prints uppercase, `keytool` prints
 * lowercase, and they mean the same certificate.
 */
export function parseFingerprints(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((one) => one.toUpperCase())
    .filter((one) => FINGERPRINT.test(one));
}

/**
 * The statement list to serve, or `null` when this deployment has no Android
 * app — which is every checkout, all of CI, and production until the day the
 * owner makes a signing key.
 *
 * Takes its values rather than reading `process.env` so a test can prove the
 * refusals without a deployment, the same split `isSiteLive` uses.
 */
export function assetLinkStatements({
  packageName,
  fingerprints,
}: {
  packageName: string | undefined;
  fingerprints: string | undefined;
}): AssetLinkStatement[] | null {
  const pkg = packageName?.trim();
  if (!pkg || !PACKAGE.test(pkg)) return null;

  const certs = parseFingerprints(fingerprints);
  if (certs.length === 0) return null;

  return [
    {
      // The one relation a TWA needs: it lets the app take over every URL on
      // this origin. There is deliberately no `common.get_login_creds` here —
      // that relation shares saved passwords between the site and the app, and
      // this app has no native credential store to share them with.
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: certs },
    },
  ];
}

/** The same thing, read off the live environment. Server-only. */
export function assetLinkStatementsFromEnv(): AssetLinkStatement[] | null {
  return assetLinkStatements({
    packageName: process.env.LANDIT_ANDROID_PACKAGE,
    fingerprints: process.env.LANDIT_ANDROID_FINGERPRINTS,
  });
}

/**
 * Whether this request came from an Android device.
 *
 * ## What it is for, and why it is only half an answer
 *
 * Google Play's payments policy governs purchases made **inside an app
 * distributed by Play**. Land The Trick's Play listing is a Trusted Web
 * Activity — the same pages, in the same Chrome — so a rider inside it could
 * otherwise reach the Stripe checkout on `/plans`, which is the one thing the
 * policy forbids (owner's decision, 2026-09-18, in chat: hide the purchase
 * rather than build Play Billing).
 *
 * Nothing a server can read says "this is the Play app". The nearest thing a
 * page can observe is `display-mode: standalone`, and that is true of a
 * home-screen icon as well — but it is a *browser* answer, unavailable here.
 *
 * So the check is split, and each half does what only it can:
 *
 * - **the server** asks whether this is Android at all, which is this function;
 * - **the browser** asks whether it is running standalone
 *   (`plans/AndroidAppGate.tsx`).
 *
 * Purchase is withheld only when both are true. An iPhone, a laptop and an
 * Android tab all keep the checkout exactly as it was, and the gate never runs
 * for them: they are the common case and they pay no cost for this.
 *
 * ## Why user-agent sniffing, which is usually wrong
 *
 * Because the alternatives are worse here. A cookie would be precise and would
 * make `/legal/cookies` — a published promise that reads "one cookie to keep
 * you signed in" — false, for a marketing-adjacent reason, on a product for
 * children. A URL marker survives one navigation. `X-Requested-With`, which
 * Chrome does send from a TWA, is on a deprecation path with a replacement
 * that is not settled.
 *
 * The cost of being wrong is also small in both directions, which is what
 * makes a coarse signal acceptable: a false positive costs one client-side
 * check on an Android phone, and a false negative leaves a non-Android device
 * showing a checkout it is entitled to show.
 */
export function isAndroidRequest(userAgent: string | null | undefined): boolean {
  // Deliberately the crudest possible test. Every Android browser says
  // "Android" in its user agent, and narrowing it further — Chrome, a version,
  // a WebView token — would be a list to maintain against a moving target for
  // no gain: this answer only decides whether a second check runs.
  return /android/i.test(userAgent ?? '');
}
