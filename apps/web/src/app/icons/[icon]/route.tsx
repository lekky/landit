import { ImageResponse } from 'next/og';

import { appIcon } from '@/lib/app-icon';

/**
 * The install icons, at the sizes a manifest has to name.
 *
 * Generated rather than committed as PNGs, from the same `appIcon` the favicon
 * and the iOS icon use, so the mark is one drawing in one file. The URLs are
 * fixed and readable (`/icons/icon-512.png`) because `app/manifest.ts` has to
 * write them down — Next's own `icon.tsx` convention emits a hashed path it
 * chooses itself, which is fine for a `<link>` tag it also writes and no use to
 * a manifest.
 *
 * `dynamicParams = false` with the three names below means anything else is a
 * 404 at the routing layer: the size is never taken from the URL, so nobody can
 * ask this route for a 16000px image.
 *
 * These sit outside the pre-launch gate for the same reason the favicon does —
 * `proxy.ts` matches nothing with a file extension — which is correct: an icon
 * is not the product.
 */

const ICONS = {
  'icon-192.png': { size: 192 },
  'icon-512.png': { size: 512 },
  /**
   * The one a launcher may crop to a circle. Same drawing, more ink around it —
   * see `appIcon`'s note on the 80% safe zone.
   */
  'icon-maskable-512.png': { size: 512, maskable: true },
} as const;

type IconName = keyof typeof ICONS;

export const dynamicParams = false;

export function generateStaticParams(): { icon: IconName }[] {
  return (Object.keys(ICONS) as IconName[]).map((icon) => ({ icon }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ icon: string }> }) {
  const { icon } = await params;
  const spec = ICONS[icon as IconName];

  if (!spec) return new Response('Not found', { status: 404 });

  return new ImageResponse(appIcon(spec), { width: spec.size, height: spec.size });
}
