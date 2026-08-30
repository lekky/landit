'use client';

import {
  AVATARS,
  AVATAR_GROUPS,
  Avatar,
  Bar,
  Button,
  Difficulty,
  Empty,
  ICON_NAMES,
  Icon,
  Modal,
  Panel,
  Pill,
  SectionHead,
  SegmentedProgress,
  SkillNode,
  Slot,
  SportChip,
  StageDot,
  StagePicker,
  StickerBadge,
  Tabs,
  Tag,
  Toast,
  TrickCard,
  avatarsInGroup,
} from '@landit/ui-web';
import Image from 'next/image';
import { useState } from 'react';

import { CATEGORIES, COLOUR_TOKENS, SAMPLE_STICKERS, SPORTS, STAGES, TIERS } from './sample';

/**
 * The design gallery: every primitive in `@landit/ui-web`, side by side, so
 * fidelity can be checked against `design-handoff/screenshots/`.
 *
 * This page is a reference sheet, not a screen. It is not part of the rider
 * app's navigation and nothing links to it.
 */

const SECTIONS = [
  ['tokens', 'Tokens'],
  ['type', 'Type'],
  ['buttons', 'Buttons'],
  ['chips', 'Tags & pills'],
  ['surfaces', 'Panels'],
  ['meters', 'Meters'],
  ['tabs', 'Tabs'],
  ['tricks', 'Trick cards'],
  ['stages', 'Stage picker'],
  ['tree', 'Skill tree'],
  ['stickers', 'Stickers'],
  ['icons', 'Icons'],
  ['avatars', 'Avatars'],
  ['overlays', 'Toasts & modal'],
  ['inputs', 'Inputs'],
] as const;

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: 44, scrollMarginTop: 20 }}>
      <SectionHead>{title}</SectionHead>
      {note && (
        <p style={{ margin: '-6px 0 16px', color: 'var(--ink-2)', maxWidth: 660, fontSize: 14.5 }}>
          {note}
        </p>
      )}
      {children}
    </section>
  );
}

const row: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'center',
};

export function Gallery() {
  const [sport, setSport] = useState('scooter');
  const [stage, setStage] = useState<string | null>('most');
  const [filter, setFilter] = useState('all');
  const [step, setStep] = useState(1);
  const [modal, setModal] = useState(false);

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-in">
          <span className="logo">
            {/* The one-line wordmark, as `components/site/Wordmark.tsx` renders it. */}
            <Image
              src="/brand/wordmark-line-720.png"
              alt="Land The Trick"
              width={720}
              height={214}
            />
          </span>
          <span className="lab" style={{ color: '#c9c2b4' }}>
            Design system
          </span>
        </div>
      </div>

      <div className="page">
        <span className="eyebrow">@landit/ui-web</span>
        <h1 className="d" style={{ fontSize: 'clamp(34px,6vw,58px)', margin: '8px 0 10px' }}>
          Every primitive,
          <br />
          side by side.
        </h1>
        <p style={{ maxWidth: 660, color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.5 }}>
          Transcribed from <code>design-handoff/design/Land It.html</code>. Compare against the
          numbered screenshots in <code>design-handoff/screenshots/</code>. Zero border radius, hard
          offset shadows, never blurred.
        </p>

        <nav style={{ ...row, gap: 8, margin: '20px 0 34px' }}>
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="pill" style={{ textDecoration: 'none' }}>
              {label}
            </a>
          ))}
        </nav>

        <Section
          id="tokens"
          title="Tokens"
          note="Colour, structure and the page background pattern."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))',
              gap: 12,
            }}
          >
            {COLOUR_TOKENS.map((t) => (
              <Panel key={t.name} flat>
                <div
                  style={{
                    height: 54,
                    background: `var(${t.name})`,
                    borderBottom: '3px solid var(--ink)',
                  }}
                />
                <div style={{ padding: '9px 11px' }}>
                  <div className="lab">{t.name}</div>
                  <div className="cond" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                    {t.hex}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4 }}>{t.use}</div>
                </div>
              </Panel>
            ))}
          </div>

          <div style={{ ...row, marginTop: 16, alignItems: 'flex-start' }}>
            <Panel style={{ padding: '14px 16px' }}>
              <div className="lab">--sh · 5px 5px 0</div>
            </Panel>
            <Panel flat style={{ padding: '14px 16px' }}>
              <div className="lab">--sh-sm · 3px 3px 0</div>
            </Panel>
            <div
              style={{
                padding: '14px 16px',
                border: '3px solid var(--ink)',
                background: 'var(--paper)',
              }}
            >
              <div className="lab">--bd · 3px solid ink</div>
            </div>
          </div>
        </Section>

        <Section
          id="type"
          title="Type"
          note="Anton for display, Barlow Condensed for chrome, Archivo for body. Self-hosted, never the Google Fonts CDN."
        >
          <Panel style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div className="lab" style={{ color: 'var(--ink-3)' }}>
                .d — Anton
              </div>
              <div className="d" style={{ fontSize: 44 }}>
                Land the trick
              </div>
            </div>
            <div>
              <div className="lab" style={{ color: 'var(--ink-3)' }}>
                .eyebrow — 12px / .22em
              </div>
              <div className="eyebrow">Your progress</div>
            </div>
            <div>
              <div className="lab" style={{ color: 'var(--ink-3)' }}>
                .lab — 11px / .16em
              </div>
              <div className="lab">First landed</div>
            </div>
            <div>
              <div className="lab" style={{ color: 'var(--ink-3)' }}>
                .cond — 600 / .06em
              </div>
              <div className="cond" style={{ fontSize: 16 }}>
                Most times on the tailwhip
              </div>
            </div>
            <div>
              <div className="lab" style={{ color: 'var(--ink-3)' }}>
                body — Archivo 15px / 1.5
              </div>
              <p style={{ margin: 0, maxWidth: 560, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                The foundation under every trick. Crouch, explode upward and pull the bars to your
                hips so both wheels leave the ground at once.
              </p>
            </div>
          </Panel>
        </Section>

        <Section
          id="buttons"
          title="Buttons"
          note="Hover lifts −1px and grows the shadow to 5px. Press pushes 2px,2px and the shadow drops to 1px."
        >
          <div style={row}>
            <Button>Start tracking</Button>
            <Button variant="ghost">I&apos;ve got an account</Button>
            <Button variant="ink">See plans</Button>
            <Button size="sm">Share it</Button>
            <Button size="sm" variant="ghost">
              Close
            </Button>
            <Button disabled>Next</Button>
          </div>
          <div style={{ maxWidth: 320, marginTop: 12 }}>
            <Button wide>Log this week&apos;s challenge</Button>
          </div>
        </Section>

        <Section id="chips" title="Tags, pills and sport chips">
          <div style={row}>
            {Object.entries(CATEGORIES).map(([id, c]) => (
              <Tag key={id} color={c.color}>
                {c.label}
              </Tag>
            ))}
            <Tag color="var(--violet)" tilt>
              Tilted 2.5°
            </Tag>
          </div>
          <div style={{ ...row, marginTop: 14 }}>
            {['all', 'flat', 'street', 'park'].map((id) => (
              <Pill key={id} on={filter === id} onClick={() => setFilter(id)}>
                {id === 'all' ? 'All' : CATEGORIES[id as keyof typeof CATEGORIES].label}
              </Pill>
            ))}
          </div>
          <div style={{ ...row, marginTop: 14 }}>
            <SportChip sport={SPORTS.scooter} />
            <SportChip sport={SPORTS.skate} />
            <SportChip sport={SPORTS.scooter} small />
            <SportChip sport={SPORTS.skate} small />
          </div>
        </Section>

        <Section id="surfaces" title="Panels, section heads, empty states and photo slots">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
              gap: 18,
            }}
          >
            <Panel style={{ padding: 18 }}>
              <SectionHead more="See all">Working on it</SectionHead>
              <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14.5 }}>
                A panel with the 5px shadow, a section head and its rule.
              </p>
            </Panel>
            <Panel flat style={{ padding: 18 }}>
              <Slot label="Trick photo: drop a shot of this trick" minHeight={120} />
            </Panel>
          </div>
          <div style={{ marginTop: 18 }}>
            <Empty
              icon="star"
              title="Nothing here yet"
              sub="Track your first trick and this fills up. Tap any card in the library to get going."
              cta="Open the library"
            />
          </div>
        </Section>

        <Section id="meters" title="Difficulty, progress, steps and stage dots">
          <Panel style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div className="lab" style={{ marginBottom: 8, color: 'var(--ink-3)' }}>
                Difficulty · {TIERS.join(' · ')}
              </div>
              <div style={row}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Difficulty value={n} />
                    <span className="cond" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                      {TIERS[n - 1]}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ ...row, marginTop: 10 }}>
                {[1, 3, 5].map((n) => (
                  <Difficulty key={n} value={n} small />
                ))}
                <span className="cond" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                  small
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 460 }}>
              <div className="lab" style={{ color: 'var(--ink-3)' }}>
                Progress bars
              </div>
              <Bar pct={68} />
              <Bar pct={34} color="var(--sky)" />
              <Bar pct={100} color="var(--green)" height={12} />
            </div>

            <div style={{ maxWidth: 460 }}>
              <div className="lab" style={{ marginBottom: 8, color: 'var(--ink-3)' }}>
                Segmented progress · onboarding
              </div>
              <SegmentedProgress steps={4} current={step} label="Onboarding progress" />
              <div style={{ ...row, marginTop: 10 }}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  Back
                </Button>
                <Button size="sm" onClick={() => setStep((s) => Math.min(3, s + 1))}>
                  Next
                </Button>
                <span className="eyebrow">Step {step + 1} of 4</span>
              </div>
            </div>

            <div>
              <div className="lab" style={{ marginBottom: 8, color: 'var(--ink-3)' }}>
                Stage dots
              </div>
              <div style={row}>
                {STAGES.map((s) => (
                  <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <StageDot color={s.color} ring="var(--ink)" />
                    <span className="cond" style={{ fontSize: 13 }}>
                      {s.label}
                    </span>
                  </span>
                ))}
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <StageDot />
                  <span className="cond" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                    Not tracked
                  </span>
                </span>
              </div>
            </div>
          </Panel>
        </Section>

        <Section
          id="tabs"
          title="Tabs"
          note="Only shown when a rider does both sports. Switching is global state."
        >
          <Tabs
            label="Sport"
            value={sport}
            onChange={setSport}
            items={[
              {
                id: 'scooter',
                label: 'Scooter',
                icon: 'scoot',
                color: SPORTS.scooter.color,
                note: 30,
              },
              {
                id: 'skate',
                label: 'Skateboard',
                icon: 'board',
                color: SPORTS.skate.color,
                note: 31,
              },
            ]}
          />
        </Section>

        <Section
          id="tricks"
          title="Trick cards"
          note="Folded corner in the category colour, footer strip in the current stage's colour. Locked cards hatch, flag the tier in violet and never hide."
        >
          <div className="grid-tricks">
            <TrickCard
              name="Bunny Hop"
              category={CATEGORIES.flat}
              difficulty={1}
              sport={SPORTS.scooter}
              stage={STAGES[4]}
            />
            <TrickCard
              name="Tic Tac"
              category={CATEGORIES.flat}
              difficulty={1}
              sport={SPORTS.scooter}
              stage={STAGES[3]}
            />
            <TrickCard
              name="50-50 Grind"
              category={CATEGORIES.street}
              difficulty={2}
              sport={SPORTS.scooter}
            />
            <TrickCard
              name="Smith Grind"
              category={CATEGORIES.street}
              difficulty={4}
              sport={SPORTS.scooter}
              locked
              lockTier={TIERS[3]}
            />
            <TrickCard
              name="540 McTwist"
              category={CATEGORIES.air}
              difficulty={5}
              sport={SPORTS.skate}
              locked
              lockTier={TIERS[4]}
            />
            <TrickCard
              name="Kickflip"
              category={CATEGORIES.flat}
              difficulty={2}
              sport={SPORTS.skate}
              stage={STAGES[2]}
            />
          </div>

          <div className="lab" style={{ margin: '22px 0 10px', color: 'var(--ink-3)' }}>
            On colour, rotated — the landing page treatment
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 480 }}>
            {(
              [
                ['Bunny Hop', CATEGORIES.flat, 1, '#FFC23F', -1.8],
                ['Kickflip', CATEGORIES.flat, 2, '#FF8FB4', 1.6],
                ['Tailwhip', CATEGORIES.park, 3, '#3AC0FF', -1.8],
                ['50-50 Grind', CATEGORIES.street, 2, '#9CE05B', 1.6],
              ] as const
            ).map(([name, cat, diff, bg, deg], i) => (
              <TrickCard
                key={name}
                name={name}
                category={cat}
                difficulty={diff}
                sport={i % 2 ? SPORTS.skate : SPORTS.scooter}
                stage={i < 2 ? STAGES[4] : null}
                showSport={false}
                background={bg}
                style={{ transform: `rotate(${deg}deg)` }}
              />
            ))}
          </div>
        </Section>

        <Section
          id="stages"
          title="Stage picker"
          note="Picking the selected stage again clears it — that is the untrack path."
        >
          <Panel style={{ padding: 18 }}>
            <div className="lab" style={{ marginBottom: 10 }}>
              Can you do it?
            </div>
            <StagePicker stages={STAGES} value={stage} onPick={setStage} />
            <p style={{ margin: '14px 0 0', color: 'var(--ink-2)', fontSize: 14.5 }}>
              Selected:{' '}
              <strong>{stage ? STAGES.find((s) => s.id === stage)?.label : 'nothing'}</strong>
            </p>
          </Panel>
        </Section>

        <Section
          id="tree"
          title="Skill tree nodes"
          note="Green when landed, hatched-dashed when prerequisites are missing, hatched-violet when behind the paywall."
        >
          <div className="branch">
            <div className="tier-row">
              <SkillNode name="Bunny Hop" difficulty={1} state="done" />
              <SkillNode name="The 180" difficulty={2} state="open" />
              <SkillNode name="Nose Manual" difficulty={3} state="lock" />
              <SkillNode name="Smith Grind" difficulty={4} state="paid" />
            </div>
          </div>
        </Section>

        <Section
          id="stickers"
          title="Stickers"
          note="Drawn entirely in SVG at render time. No image assets."
        >
          <Panel style={{ background: 'var(--ink)', padding: 22 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))',
                gap: 18,
              }}
            >
              {SAMPLE_STICKERS.map((s) => (
                <StickerBadge key={s.name} sticker={s} earned={s.earned} />
              ))}
            </div>
          </Panel>
        </Section>

        <Section id="icons" title="Icons" note="24px grid, stroke width 2.2, round caps and joins.">
          <Panel flat style={{ padding: 18 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(92px,1fr))',
                gap: 14,
              }}
            >
              {ICON_NAMES.map((name) => (
                <div
                  key={name}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                >
                  <Icon name={name} size={26} />
                  <span className="lab" style={{ color: 'var(--ink-3)', fontSize: 9.5 }}>
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </Section>

        <Section
          id="avatars"
          title={`Avatars · ${AVATARS.length}`}
          note="Package assets, copied to public/avatars at build time. Circular — one of the two places with a border radius."
        >
          {AVATAR_GROUPS.map((g) => (
            <div key={g.id} style={{ marginBottom: 18 }}>
              <div className="lab" style={{ marginBottom: 4, color: 'var(--ink-3)' }}>
                {g.id}
              </div>
              <div
                className="cond"
                style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 10 }}
              >
                {g.blurb}
              </div>
              <div style={{ ...row, gap: 10 }}>
                {avatarsInGroup(g.id).map((a) => (
                  <Avatar key={a.id} avatarId={a.id} size={54} title={a.name} />
                ))}
              </div>
            </div>
          ))}
          <div style={{ ...row, marginTop: 4 }}>
            <Avatar name="Nia" size={54} hue="var(--pink)" title="Fallback initial" />
            <span className="cond" style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>
              No picture: the rider&apos;s initial on a flat colour
            </span>
          </div>
        </Section>

        <Section
          id="overlays"
          title="Toasts and modal"
          note="Toasts slide up from the bottom centre and clear after 3.2s. The scrim fades in over 200ms; the panel rises 26px and scales from .96."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 420 }}>
            <Toast color="#2EC4B6">Tailwhip · Most times</Toast>
            <Toast color="#FFC23F">Sticker unlocked · 7 Day Streak</Toast>
            <Toast color="var(--violet)">Progress insights are on Legend</Toast>
          </div>
          <div style={{ marginTop: 16 }}>
            <Button onClick={() => setModal(true)}>Open a modal</Button>
          </div>
          {modal && (
            <Modal onClose={() => setModal(false)} label="Design system modal" width={420}>
              <div style={{ padding: 22 }}>
                <div className="eyebrow">Share it</div>
                <h3 className="d" style={{ fontSize: 28, margin: '7px 0 10px' }}>
                  Landed the Tailwhip
                </h3>
                <p style={{ margin: '0 0 16px', color: 'var(--ink-2)', fontSize: 14.5 }}>
                  Escape closes this, and so does a click on the scrim.
                </p>
                <div style={row}>
                  <Button size="sm" onClick={() => setModal(false)}>
                    Copy caption
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setModal(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </Section>

        <Section
          id="inputs"
          title="Inputs"
          note="Focus draws a 3px yellow hard shadow. Errors are uppercase Barlow Condensed in red."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
              gap: 18,
            }}
          >
            <Panel style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label htmlFor="demo-name">Your name</label>
                <input id="demo-name" defaultValue="Nia" />
              </div>
              <div className="field">
                <label htmlFor="demo-email">Email</label>
                <input id="demo-email" defaultValue="not-an-email" />
                <span className="err">That email doesn&apos;t look right</span>
              </div>
              <div className="field">
                <label htmlFor="demo-notes">Session notes</label>
                <textarea id="demo-notes" rows={3} defaultValue="Nearly had it on the mini ramp." />
              </div>
            </Panel>
            <div>
              <div className="search">
                <Icon name="search" size={19} />
                <input aria-label="Search tricks" placeholder="Search tricks: whip, grind, flip…" />
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
