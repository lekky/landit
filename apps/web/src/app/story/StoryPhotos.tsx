'use client';

import { Slot, cx, useModalLayer } from '@landit/ui-web';
import Image from 'next/image';
import { useRef, useState } from 'react';

import type { StoryPhoto } from '@/content/story';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import styles from './story.module.css';

/**
 * The story page's photos, and the one thing on the page a visitor can press.
 *
 * The frames are deliberately small. A phone photo of a ramp is 901x1600, and
 * a portrait shot set to the full 760px measure is most of a laptop screen
 * holding one picture; at 355px it sits beside the prose it belongs to and the
 * page still reads as writing with photographs in it. Tapping one opens it
 * whole, which is where the detail actually is: the graffiti on the flat, the
 * frame under the plywood, the t-shirt.
 *
 * **This is the only client component on the page besides the two calls to
 * action**, so the story itself still ships almost no JavaScript. It is also
 * the only interactive thing here, which is why it carries its own dialog
 * rather than the shell's `useModal`: `/story` is a signed-out marketing page
 * and sits outside `AppShell`, so there is no `ModalProvider` above it.
 *
 * **What a dialog does to the page behind it comes from `useModalLayer`**, the
 * hook the design system's shared `Modal` runs, so this one behaves like every
 * other (issue #372): the page is held still and made inert, Escape closes it,
 * and focus returns to the frame that was pressed. `EventDetailModal` owns its
 * element on the same terms and for the same kind of reason.
 */

/**
 * One frame. A photo with a `src` is a button; a photo still to be taken keeps
 * the placeholder and is not pressable, because there is nothing to expand.
 */
function Frame({ photo, onOpen }: { photo: StoryPhoto; onOpen: (photo: StoryPhoto) => void }) {
  const caption = photo.caption ? (
    <figcaption className={cx('lab', styles.caption)}>{photo.caption}</figcaption>
  ) : null;

  if (!photo.src) {
    return (
      <figure className={styles.figure}>
        <div className={styles.photo}>
          <Slot className={styles.photoSlot} label={photo.label} />
        </div>
        {caption}
      </figure>
    );
  }

  return (
    <figure className={styles.figure}>
      {/*
        The button carries the description and the image is presentational:
        with the alt text on both, a screen reader reads the photo twice, once
        as the control's name and once as its content.
      */}
      <button
        type="button"
        className={cx(styles.photo, styles.photoButton)}
        aria-label={`Expand photo: ${photo.alt ?? photo.label}`}
        onClick={() => {
          capture(ANALYTICS_EVENTS.storyPhotoOpened, { photo: photo.id });
          onOpen(photo);
        }}
      >
        <Image
          className={styles.photoImg}
          src={photo.src}
          alt=""
          fill
          sizes="(max-width: 620px) 50vw, 355px"
        />
        <span className={cx('lab', styles.expand)} aria-hidden="true">
          Expand
        </span>
      </button>
      {caption}
    </figure>
  );
}

/** The expanded photo: the whole frame, uncropped, with its caption under it. */
function PhotoLightbox({ photo, onClose }: { photo: StoryPhoto; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);

  useModalLayer(panel, onClose);

  return (
    <div className="scrim" onClick={onClose}>
      <div
        ref={panel}
        className={cx('modal', styles.lightbox)}
        role="dialog"
        aria-modal="true"
        aria-label={photo.alt ?? photo.label}
        tabIndex={-1}
        onClick={(clicked) => clicked.stopPropagation()}
      >
        {/*
          `height: auto` as well as `width: auto` in the CSS, both of them: with
          only one set Next warns that the aspect ratio has been changed, and
          with neither the intrinsic 1600px height wins and the panel scrolls.
        */}
        <Image
          className={styles.lightboxImg}
          src={photo.src ?? ''}
          alt={photo.alt ?? photo.label}
          width={photo.width ?? 901}
          height={photo.height ?? 1600}
          sizes="(max-width: 620px) 92vw, 460px"
        />
        <div className={styles.lightboxFoot}>
          <span className={cx('lab', styles.lightboxCaption)}>{photo.caption ?? photo.label}</span>
          <button type="button" className="btn sm ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export type StoryPhotosProps = {
  items: readonly StoryPhoto[];
  /** `pair` stays two abreast on a phone. See `StoryBlock` in `content/story.ts`. */
  layout?: 'pair';
};

export function StoryPhotos({ items, layout }: StoryPhotosProps) {
  const [open, setOpen] = useState<StoryPhoto | null>(null);

  return (
    <>
      <div className={cx(styles.photos, layout === 'pair' && styles.photosPair)}>
        {items.map((photo) => (
          <Frame key={photo.id} photo={photo} onOpen={setOpen} />
        ))}
      </div>
      {open ? <PhotoLightbox photo={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
