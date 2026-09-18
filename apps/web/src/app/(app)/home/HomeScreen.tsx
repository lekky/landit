'use client';

import { Avatar, Bar, Empty, Panel, SectionHead, TrickCard } from '@landit/ui-web';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ROUTES, eventHref, libraryHref, spotHref, trickHref } from '@/lib/routes';
import { sessionsHref } from '@/lib/sessionRoutes';
import { useSport } from '@/providers/sport';

import { AnnouncementBanner } from './AnnouncementBanner';
import { LinkCard } from './LinkCard';
import { StreakCard } from './StreakCard';
import { WorkingTrick } from './WorkingTrick';
import type { HomeView, TrickCardView } from './view';

import styles from './home.module.css';

/**
 * The dashboard, as a rider meets it after the app shell rethink (§3.4).
 *
 * **What changed, and why it is not a reshuffle.** Folding nine destinations
 * into four groups (D8) took Progress, Sessions, Stickers and the Challenge off
 * both bars. They are under Home now, and the four **record cards** are the
 * whole of how a rider gets to them — which makes this screen navigation as
 * much as a summary, and is why the cards sit directly under the streak rather
 * than below two grids of trick art. The order the owner agreed on the canvas
 * is: greeting → streak → the four cards → Your tricks → crew activity →
 * Next up → Your spots.
 *
 * **The sport tab row is gone** (D5). The sport is chosen once, in the top
 * bar's chip, and every number on this screen follows it through `useSport`
 * exactly as it followed the row — one switcher in the product rather than one
 * per screen. The greeting's four stat blocks go on the phone, because the four
 * cards carry those numbers there and saying them twice costs a screen; they
 * stay on desktop, where the rail has the room.
 *
 * Still a client component only because the sport is client state: everything
 * it renders was computed on the server and handed over as plain data
 * (`view.ts`), so switching sport is a re-render rather than a fetch and
 * nothing on the page is produced by ICU on one side of hydration and not the
 * other (LESSONS §3a).
 */
export function HomeScreen({ view }: { view: HomeView }) {
  const { sport } = useSport();
  const router = useRouter();
  const current = view.bySport[sport] ?? view.bySport[view.sports[0] as string];

  if (!current) return null;

  /*
   * One question now, where there used to be two (Rachid, 2026-09-18, in chat).
   *
   * The heading has been "Your tricks" either way since 2026-09-17 and the link
   * has followed `tracked` since the same change — but the grid under them was
   * still the `trying` slice, so a rider with two landed and one being learned
   * read "All 3 of yours" over a single card. The cards follow `tracked` too
   * now: has this rider tracked anything at all? Yes means their own tricks,
   * learning first; no means suggestions from the library, which is also where
   * the link then points.
   */
  const mine = current.tracked > 0;
  const primary = mine ? current.trackedTricks : current.startHere;

  /*
   * The four record cards (§3.4), in the owner's order: Stickers, Sessions,
   * Challenge, Progress (Rachid, 2026-09-17, in chat, replacing the canvas
   * order the spec was written from — §3.4 records it).
   *
   * Sessions is dropped rather than disabled when the preview is not open to
   * this rider (T41): a card that leads to a screen they would be refused is
   * worse than no card. Three is the ordinary case today, and `.cards` fills
   * the row either way — see `home.module.css`.
   */
  const cards = (
    <div className={styles.cards}>
      <LinkCard
        href={ROUTES.stickers}
        to="stickers"
        title="Stickers"
        icon="star"
        hue="var(--pink-soft)"
        value={String(current.stickerCount)}
        /*
          Both values are the chip's sport — the wall this card opens, scoped
          "<sport> and shared" exactly as `/stickers` scopes it. The desktop
          greeting's Stickers block reads `current.stickerCount` too, so the two
          can never disagree.
        */
        sub={
          current.newestSticker
            ? `Newest: ${current.newestSticker}`
            : 'None yet — the first is close'
        }
      />
      {view.sessionsCard && (
        <LinkCard
          href={sessionsHref()}
          to="sessions"
          title="Sessions"
          icon="clock"
          hue="var(--sky)"
          value={view.sessionsCard.value}
          sub={view.sessionsCard.sub}
        />
      )}
      <LinkCard
        href={ROUTES.challenge}
        to="challenge"
        title="Challenge"
        icon="flag"
        hue="var(--yellow)"
        value={current.challenge ? `${current.challenge.logged}/${current.challenge.goal}` : '—'}
        sub={
          current.challenge
            ? `${current.challenge.title} · ${current.challenge.endsLabel}`
            : 'Nothing running this week'
        }
      />
      <LinkCard
        href={ROUTES.progress}
        to="progress"
        title="Progress"
        icon="chart"
        hue="var(--lime)"
        value={String(current.landed)}
        /*
          "landed" first, because this is the one card whose number is not
          self-evident from its title: Sessions counts sessions, Stickers counts
          stickers, Challenge shows a fraction, and Progress shows — a rider had
          to infer it. §3.4 calls it "landed count · learning · want to", and
          this is that, said.
        */
        sub={`landed · ${current.working} learning · ${current.wanted} want to`}
      />
    </div>
  );

  return (
    <div className={styles.page}>
      {current.announcement && <AnnouncementBanner notice={current.announcement} />}

      <div className={styles.top}>
        <Panel className={styles.greeting}>
          <span className="eyebrow">{view.dateLabel}</span>
          <h1 className={`d ${styles.hello}`}>Alright, {view.firstName}.</h1>
          <p className={styles.summary}>
            {current.summary}
            {current.acrossSports && <span className={styles.across}>{current.acrossSports}</span>}
          </p>

          {/*
            Desktop only (§3.4). The four cards below carry Landed, Learning,
            Want to and Stickers on a phone, and a dashboard that says each
            number twice in the first screenful is a dashboard a thumb has to
            scroll past to reach anything it can act on.
          */}
          <div className={styles.stats}>
            <StatBlock n={current.landed} label="Landed" hue="var(--lime)" />
            <StatBlock n={current.working} label="Learning" hue="var(--yellow)" />
            <StatBlock n={current.wanted} label="Want to" hue="#C9B8FF" />
            <StatBlock n={current.stickerCount} label="Stickers" hue="var(--pink-soft)" />
          </div>

          <div className={styles.library}>
            <div className={styles.libraryHead}>
              <span className="lab">{current.libraryLabel}</span>
              <span className="lab">
                {current.landed} / {current.total}
              </span>
            </div>
            <Bar pct={current.pct} />
          </div>
        </Panel>

        <div className={styles.side}>
          <StreakCard streak={view.streak} sessionsEnabled={view.sessionsEnabled} />

          {current.challenge && (
            /*
              The week's challenge in full, and **desktop only** (§3.4: "greeting
              + streak/challenge rail as today").

              On a phone the Challenge record card below carries it — "1/3 ·
              Switch week · Ends Sunday" is the same three facts in a card a
              thumb reaches without scrolling, and drawing both would spend a
              quarter of the first screenful saying one thing twice. On desktop
              the rail is beside the greeting rather than under it, so the fuller
              card costs nothing and the blurb is worth reading.
            */
            <Link
              href={ROUTES.challenge}
              className={`panel ${styles.challenge}`}
              style={{ background: current.challenge.hue }}
              onClick={() =>
                capture(ANALYTICS_EVENTS.navClicked, { to: 'challenge', where: 'home-card' })
              }
            >
              <div className={styles.challengeHead}>
                <span className="tag" style={{ background: 'var(--ink)' }}>
                  {current.challenge.week}
                </span>
                <span className="lab">{current.challenge.stateLabel}</span>
              </div>
              <div className={`d ${styles.challengeTitle}`}>{current.challenge.title}</div>
              <p className={styles.challengeBlurb}>{current.challenge.blurb}</p>
              <Bar pct={current.challenge.pct} color="var(--ink)" height={13} />
              <div className="lab" style={{ marginTop: 7 }}>
                {current.challenge.logged} of {current.challenge.goal} logged
              </div>
            </Link>
          )}
        </div>
      </div>

      {cards}

      <section>
        {/*
          The way into "My tricks" (T22). For a rider who tracks anything this
          section is the front of their own list, so the link out goes to the
          whole of it rather than to the library at large — and it says how many
          are there, which is the reason to follow it. For a rider who tracks
          nothing it is suggestions from the library, and the library is where
          it should still point.

          **One heading either way: "Your tricks"** (Rachid, 2026-09-17, in
          chat, replacing "Working on it" / "Start here"). The section moved
          under the rider either way, and a heading that renamed itself on a
          state the rider cannot see made the same place look like two.
        */}
        <SectionHead
          more={mine ? `All ${current.tracked} of yours →` : 'Library →'}
          onMore={() => router.push(mine ? libraryHref({ mine: true }) : ROUTES.library)}
        >
          Your tricks
        </SectionHead>
        {primary.length ? (
          /*
            Four on desktop, the first two on a phone — the cut is
            `.gridPrimary`'s, not a slice, because a width measured in the
            browser is a width the server guessed differently and the grid would
            be thrown away on hydration (LESSONS §3a).

            **The stage row is on every one of the rider's own cards**, not only
            the ones at `trying` (Rachid, 2026-09-18, in chat). It is what makes
            the widened section worth widening: a trick bumped off Learning
            moves down this grid rather than out of it (#190), and a trick a
            rider has lost is bumped back down without leaving the screen.
            Suggestions get a plain card — there is no stage to move yet, and
            `WorkingTrick` needs a `recordId` only a tracked trick has.
          */
          <div className={`grid-tricks ${styles.gridPrimary}`}>
            {primary.map((t) =>
              mine ? (
                <WorkingTrick
                  key={t.slug}
                  trick={t}
                  onOpen={() => router.push(trickHref(t.slug))}
                />
              ) : (
                <HomeTrickCard
                  key={t.slug}
                  trick={t}
                  onOpen={() => router.push(trickHref(t.slug))}
                />
              ),
            )}
          </div>
        ) : (
          <Empty
            icon="grid"
            title="Nothing to show yet"
            sub="Find a trick in the library and mark it as one you are learning."
            cta="Find a trick"
            onCta={() => {
              /*
                The one Home empty state that was never counted, and the one a
                first-day account is most likely to press. `empty_state_action`
                fired from the Stickers panel before the rethink; that panel is
                a card now, so the value would have gone quiet altogether —
                which is the shape of a screen going invisible rather than a
                screen going away.
              */
              capture(ANALYTICS_EVENTS.emptyStateAction, { screen: 'home', action: 'library' });
              router.push(ROUTES.library);
            }}
          />
        )}
      </section>

      <div className={styles.bottom}>
        <section>
          {/*
            The crew's activity, not its board (§3.4).

            Three sentences, each one written by `crewActivityLine` in
            `@landit/core` from catalogue facts — a kind, a trick name, a
            sticker name. Nothing a rider typed is here and nothing can be,
            which is what keeps "no rider-to-rider messaging" (plan §6.1) true
            of the shape and not merely of the intent. The board it replaces is
            what `/crew` is for.
          */}
          <SectionHead more="Crew →" onMore={() => router.push(ROUTES.crew)}>
            Your crew
          </SectionHead>
          {view.crewActivity.length ? (
            <Panel flat className={styles.feed}>
              {view.crewActivity.map((item, i) => (
                <div
                  key={item.id}
                  className={styles.feedRow}
                  data-last={i === view.crewActivity.length - 1 || undefined}
                >
                  <Avatar avatarId={item.avatarKey || null} name={item.name} size={32} />
                  <div className={styles.feedBody}>
                    {/*
                      **The name, then the line.** `crewActivityLine` returns a
                      *predicate* — "earned the Crewed Up sticker", "landed
                      Bunny Hop" — and the screen supplies the subject, exactly
                      as `/crew` does (`CrewScreen.tsx`). Without it the panel
                      read as three headless fragments under a heading saying
                      "Your crew", with a 32px avatar the only clue to whose.

                      And in **sentence case**: `.cond` uppercases, and these
                      are sentences the product wrote to be read as sentences.
                      `/crew` renders the same six in body type, so drawing them
                      in caps here would be one feed in two voices.
                    */}
                    <p className={styles.feedLine}>
                      <span className={styles.feedWho}>{item.name}</span> {item.line}
                    </p>
                    <div className={`lab ${styles.feedWhen}`}>{item.when}</div>
                  </div>
                </div>
              ))}
            </Panel>
          ) : (
            <Empty
              icon="users"
              title="No crew yet"
              sub="Crews are invite-only — start one and send a mate the code, or wait for theirs."
              cta="Start a crew"
              onCta={() => {
                capture(ANALYTICS_EVENTS.emptyStateAction, { screen: 'home', action: 'crew' });
                router.push(ROUTES.crew);
              }}
            />
          )}
        </section>

        <section>
          {/*
            "Next up" — the next event this rider said yes to, and nobody
            else's. `event_attendance` is `OWN`, so the read behind this cannot
            return another rider's plans however it is asked.
          */}
          <SectionHead more="Find →" onMore={() => router.push(ROUTES.find)}>
            Next up
          </SectionHead>
          {view.nextEvent ? (
            <Link href={eventHref(view.nextEvent.slug)} className={`panel ${styles.next}`}>
              <span className={styles.nextStripe} style={{ background: view.nextEvent.hue }} />
              <span className={styles.nextBody}>
                <span className="lab">{view.nextEvent.dateLabel}</span>
                <span className={`cond ${styles.nextName}`}>{view.nextEvent.name}</span>
                <span className={`lab ${styles.nextTown}`}>{view.nextEvent.town}</span>
              </span>
            </Link>
          ) : (
            <Empty
              icon="flag"
              title="Nothing in the diary"
              sub="Jams, comps and clinics near you are on the events calendar."
              cta="Find something on"
              onCta={() => {
                capture(ANALYTICS_EVENTS.emptyStateAction, { screen: 'home', action: 'events' });
                router.push(ROUTES.events);
              }}
            />
          )}
        </section>
      </div>

      <section>
        <SectionHead more="Spots →" onMore={() => router.push(ROUTES.spots)}>
          Your spots
        </SectionHead>
        {view.faveSpots.length ? (
          <div className={styles.spots}>
            {view.faveSpots.map((spot) => (
              <Link key={spot.slug} href={spotHref(spot.slug)} className={`panel ${styles.spot}`}>
                <span className={`cond ${styles.spotName}`}>{spot.name}</span>
                <span className={`lab ${styles.spotTown}`}>{spot.town}</span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            icon="map"
            title="No faves yet"
            // The control is a **star** (`spots/FaveButton.tsx`), and a child
            // following this sentence goes looking for the heart it names.
            sub="Tap the star on a spot and it lands here, ready for next time."
            cta="Find a spot"
            onCta={() => {
              capture(ANALYTICS_EVENTS.emptyStateAction, { screen: 'home', action: 'spots' });
              router.push(ROUTES.spots);
            }}
          />
        )}
      </section>
    </div>
  );
}

function StatBlock({ n, label, hue }: { n: number; label: string; hue: string }) {
  return (
    <div className={styles.stat} style={{ background: hue }}>
      <div className={`d ${styles.statNumber}`}>{n}</div>
      <div className={`lab ${styles.statLabel}`}>{label}</div>
    </div>
  );
}

/** A trick card that opens the trick page T7 landed. */
function HomeTrickCard({ trick, onOpen }: { trick: TrickCardView; onOpen: () => void }) {
  return (
    <TrickCard
      name={trick.name}
      category={trick.category}
      difficulty={trick.difficulty}
      sport={trick.sport}
      stage={trick.stage}
      locked={trick.locked}
      onOpen={onOpen}
      {...(trick.lockTier ? { lockTier: trick.lockTier } : {})}
    />
  );
}
