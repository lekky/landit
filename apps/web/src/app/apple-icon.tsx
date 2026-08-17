import { ImageResponse } from 'next/og';

import { appIcon } from '@/lib/app-icon';

/**
 * The home-screen icon on iOS, which does not read the web manifest's icon list.
 *
 * 180×180 is what Safari asks for, and the plain (non-maskable) drawing is right
 * here: iOS applies its own rounded-rectangle mask, which is far gentler than the
 * circle an Android launcher may cut, so the mark can sit at its normal size.
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(appIcon({ size: size.width }), size);
}
