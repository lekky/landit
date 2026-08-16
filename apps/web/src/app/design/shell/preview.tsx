'use client';

import { SPORTS, SPORT_IDS, type SportId } from '@landit/core';
import { Button, Panel, SectionHead, Tabs, type TabItem } from '@landit/ui-web';

import { SportSwitch } from '@/components/shell/SportSwitch';
import { useModal } from '@/providers/modal';
import { useSport } from '@/providers/sport';
import { useToast } from '@/providers/toast';

/**
 * What the shell preview shows. Client-side because every piece of it is a
 * thing you have to press to check.
 */

export function ShellPreview() {
  const { sport, sports } = useSport();
  const { toast } = useToast();
  const { openModal, closeModal } = useModal();

  const realTabs: TabItem[] = sports.map((id: SportId) => ({
    id,
    label: SPORTS[id].label,
    shortLabel: SPORTS[id].short,
    icon: SPORTS[id].icon as TabItem['icon'],
    color: SPORTS[id].color,
    note: '12 landed',
  }));

  return (
    <>
      <span className="eyebrow">Not a rider screen · T5</span>
      <h1 className="d" style={{ fontSize: 'clamp(30px,5vw,44px)', margin: '8px 0 10px' }}>
        App shell
      </h1>
      <p style={{ maxWidth: 640, color: 'var(--ink-2)', margin: '0 0 26px' }}>
        The frame every signed-in screen renders inside: top bar, five-item bottom bar below 860px,
        footer, and the toast and modal hosts. Screens land under <code>app/(app)/</code> and get
        all of it.
      </p>

      <section style={{ marginBottom: 40 }}>
        <SectionHead>Sport switch</SectionHead>
        <p style={{ maxWidth: 640, color: 'var(--ink-2)', margin: '-6px 0 14px', fontSize: 14.5 }}>
          Global state — switching here switches everywhere. Currently on{' '}
          <b>{SPORTS[sport].label}</b>.
        </p>
        <SportSwitch note={() => '12 landed'} />

        <div style={{ marginTop: 26 }}>
          <div className="lab" style={{ marginBottom: 8, color: 'var(--ink-3)' }}>
            The same row, compact
          </div>
          <p style={{ maxWidth: 640, color: 'var(--ink-2)', margin: '0 0 12px', fontSize: 14.5 }}>
            Narrow the window under 520px: the labels shorten and the notes go, so three tabs still
            sit on one line. T5 checked this squeeze against a made-up third entry because BMX was
            not in <code>SPORT_IDS</code> yet; T21 landed the real sport, so this is now the real
            row.
          </p>
          <Tabs
            items={realTabs}
            value={sport}
            onChange={() => undefined}
            label="Sport, three-sport layout check"
            compact
          />
          <p className="cond" style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: 0 }}>
            {SPORT_IDS.length} sports today
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead>Toast host</SectionHead>
        <p style={{ maxWidth: 640, color: 'var(--ink-2)', margin: '-6px 0 14px', fontSize: 14.5 }}>
          Slides up from the bottom centre, clears after 3.2 seconds.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button size="sm" onClick={() => toast('Tailwhip · Every time', 'var(--green)')}>
            Stage toast
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toast('Sticker unlocked · First Land', 'var(--pink)')}
          >
            Sticker toast
          </Button>
        </div>
      </section>

      <section>
        <SectionHead>Modal host</SectionHead>
        <p style={{ maxWidth: 640, color: 'var(--ink-2)', margin: '-6px 0 14px', fontSize: 14.5 }}>
          One at a time, opened from anywhere. Escape or the scrim closes it.
        </p>
        <Button
          size="sm"
          onClick={() =>
            openModal(
              <Panel style={{ padding: 22 }}>
                <div className="d" style={{ fontSize: 24, marginBottom: 8 }}>
                  A modal
                </div>
                <p style={{ margin: '0 0 16px', color: 'var(--ink-2)' }}>
                  Whatever a screen passes in. The scrim, the rise and Escape are the design
                  system&rsquo;s.
                </p>
                <Button size="sm" variant="ghost" onClick={closeModal}>
                  Close
                </Button>
              </Panel>,
              { label: 'Shell preview modal' },
            )
          }
        >
          Open a modal
        </Button>
      </section>
    </>
  );
}
