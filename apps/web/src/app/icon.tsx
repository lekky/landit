import { ImageResponse } from 'next/og';

import { appIcon } from '@/lib/app-icon';

/**
 * The favicon.
 *
 * The site had none at all before this — a browser tab showed Next's default,
 * and a bookmark showed nothing. Next writes the `<link rel="icon">` for this
 * file convention itself, so nothing in `layout.tsx` has to know it exists.
 */
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(appIcon({ size: size.width }), size);
}
