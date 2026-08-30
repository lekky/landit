import {
  CATS,
  DEFAULT_TIMEZONE,
  PRIVACY,
  STAGE,
  STANCES,
  categoryLabel,
  currentWeeklyStreak,
  firstLanded,
  normaliseHandle,
  type PrivacyId,
  type SportId,
  type StageId,
} from '@landit/core';
import {
  getCrewBoard,
  getRiderByHandle,
  listCrews,
  listPlans,
  listRiderStickers,
  listStickers,
  listTrickLog,
  listTrickProgress,
  listTricks,
  listVideoLinks,
  trickLogEntries,
  videoLinksFromRecords,
} from '@landit/db';
import { Avatar, Panel, SportChip, StickerBadge, Tag } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';

import { VideoWall } from '@/components/video/VideoWall';
import { shortDate } from '@/lib/dates';
import { ROUTES, reportHref, riderHref, signInHref } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';
import { anonymousClient, currentRider } from '@/lib/session';

import styles from './profile.module.css';

export const metadata: Metadata = {
  title: 'Rider · Land The Trick',
  // Profiles default to private and most will stay that way. Nothing about a
  // rider belongs in a search index (plan §6.4).
  robots: { index: false, follow: false },
};

/**
 * One rider's public profile (`landit-screens-d.jsx`, screenshot 16).
 *
 * **The gate is the API rule, and this screen is only its face.** There is no
 * `if (privacy === 'private')` anywhere below deciding whether to render the
 * tricks. `users.listRule` already applies the three-way test — own record
 * always, `public` to anyone, `members` to a signed-in consented rider, and
 * `private` to nobody — so a profile that may not be seen simply does not
 * resolve, and there is nothing here to get wrong or to forget on the next
 * screen. Everything under the header is fetched *after* that read succeeds.
 *
 * **The prototype's "viewing as" toggle is gone.** It was two radio buttons
 * pretending to be a signed-out visitor. What replaces it is the real thing:
 * whoever is looking is whoever is looking, and on your own profile a strip
 * says what a signed-out visitor would actually get, read from your own
 * setting. A toggle that simulates a permission is the sort of thing that
 * agrees with the rules right up until they change.
 *
 * **A refusal never says more than it has to.** A handle that does not resolve
 * is either a rider who does not exist or one who is not visible to you, and
 * this page cannot tell the two apart — `getRiderByHandle` says so in as many
 * words. The single exception is a crewmate: if the handle is on a board you
 * are already on, you were told their name by the board route, so the page may
 * use it to explain the refusal (plan §3 guarantee 1).
 */
export default async function RiderProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const handle = normaliseHandle(decodeURIComponent((await params).handle));
  const session = await currentRider();
  const client = session?.client ?? anonymousClient();

  const rider = await getRiderByHandle(client, handle);

  if (!rider) return <NotVisible handle={handle} signedIn={Boolean(session)} />;

  const isSelf = session?.rider.id === rider.id;
  const timezone = session?.rider.timezone || DEFAULT_TIMEZONE;

  const [trickRecords, progress, log, earned, stickerRecords, plans, videoRecords] =
    await Promise.all([
      listTricks(client),
      listTrickProgress(client, rider.id),
      listTrickLog(client, rider.id),
      listRiderStickers(client, rider.id),
      listStickers(client),
      listPlans(client),
      // Read with the **viewer's** client, so what comes back is what the `clips`
      // rule allows them — the profile-privacy ceiling included. A signed-out
      // visitor gets an empty list from the API, not a filtered one from here.
      // This page does not filter the result and must not start (guarantee 2).
      listVideoLinks(client, { userId: rider.id }),
    ]);

  const trickById = new Map(trickRecords.map((t) => [t.id, t]));
  const stickerById = new Map(stickerRecords.map((s) => [s.id, s]));

  // Legend flair is read off the plan record, never by comparing a plan id to
  // the string `legend` (plan §2.4; the same shape as `includes_insights`).
  const flairPlans = new Set(plans.filter((p) => p.includes_flair).map((p) => p.slug));
  const flair = flairPlans.has(rider.plan ?? '');

  const landedDates = firstLanded(trickLogEntries(log, trickRecords));

  const stageOf: {
    slug: string;
    name: string;
    sport: SportId;
    cat: string;
    stage: StageId;
    at: number | null;
  }[] = [];
  for (const row of progress) {
    const record = trickById.get(row.trick);
    if (!record || !record.is_live) continue;
    stageOf.push({
      slug: record.slug,
      name: record.name,
      sport: record.sport as SportId,
      cat: record.cat,
      stage: row.stage,
      at: landedDates[record.slug]?.at ?? null,
    });
  }

  const LANDED: readonly StageId[] = ['some', 'most', 'every'];
  const landed = stageOf.filter((t) => LANDED.includes(t.stage));
  landed.sort((a, b) => (b.at ?? 0) - (a.at ?? 0) || (a.name < b.name ? -1 : 1));

  const weeks = currentWeeklyStreak(
    {
      streak: rider.streak ?? 0,
      lastQualifyingWeek: rider.last_qualifying_week || null,
      weekStart: rider.week_start || null,
      ridesThisWeek: rider.rides_this_week ?? 0,
      lastRide: rider.last_ride || null,
    },
    { timezone },
  );

  const privacy = (rider.privacy || 'private') as PrivacyId;
  const rule = PRIVACY.find((p) => p.id === privacy);
  const stance = STANCES.find((s) => s.id === rider.stance);
  const sports = ((rider.sports ?? []) as SportId[]).filter((s) => SPORT_LOOKS[s]);
  const firstName = (rider.name || 'This rider').split(' ')[0] || 'This rider';

  return (
    <div>
      <Link className={`cond ${styles.back}`} href={ROUTES.crew}>
        ← Crew
      </Link>

      <Panel className={styles.card}>
        <div className={styles.banner}>
          <Avatar
            avatarId={rider.avatar_key}
            name={rider.name}
            size={72}
            ringWidth={4}
            ring="var(--paper)"
          />
          <div className={styles.bannerText}>
            <div className={`d ${styles.name}`}>
              {rider.name || 'Rider'}
              {isSelf ? ' (you)' : ''}
            </div>
            <div className={`lab ${styles.meta}`}>
              @{rider.handle}
              {rider.town ? ` · ${rider.town}` : ''}
              {stance ? ` · ${stance.label}` : ''}
            </div>
            <div className={styles.sports}>
              {sports.map((sport) => (
                <SportChip key={sport} sport={SPORT_LOOKS[sport]} />
              ))}
            </div>
          </div>
          <div className={styles.bannerTags}>
            {flair ? (
              <Tag color="var(--violet)" tilt>
                Legend
              </Tag>
            ) : null}
            {isSelf && rule ? (
              <Tag
                tilt
                color={
                  privacy === 'public'
                    ? 'var(--green)'
                    : privacy === 'members'
                      ? 'var(--sky)'
                      : 'var(--ink-3)'
                }
              >
                {rule.short}
              </Tag>
            ) : null}
          </div>
        </div>

        <div className={styles.stats}>
          {[
            [landed.length, 'Landed'],
            [weeks, weeks === 1 ? 'Week streak' : 'Weeks streak'],
            [earned.length, 'Stickers'],
          ].map(([value, label]) => (
            <div key={String(label)} className={styles.stat}>
              <div className={`d ${styles.statValue}`}>{value}</div>
              <div className="lab">{label}</div>
            </div>
          ))}
        </div>
      </Panel>

      {isSelf && rule ? (
        <Panel flat className={styles.viewing}>
          <span className="lab">Who sees this</span>
          <span className={styles.viewingBody}>{rule.blurb}</span>
          <Link className="btn sm ghost" href={ROUTES.account}>
            Change it
          </Link>
        </Panel>
      ) : null}

      <div className={styles.grid}>
        <Panel className={styles.panel}>
          <div className={styles.panelHead}>
            <span className="lab">{isSelf ? "What you've landed" : "What they've landed"}</span>
          </div>
          {landed.length === 0 ? (
            <p className={styles.panelEmpty}>Nothing landed yet.</p>
          ) : (
            <div className={styles.landedList}>
              {landed.slice(0, 12).map((t) => (
                <div key={t.slug} className={styles.landedRow}>
                  <span
                    className={styles.swatch}
                    style={{ background: CATS[t.cat as keyof typeof CATS]?.color }}
                    title={categoryLabel(t.cat as never, t.sport)}
                  />
                  <span className={`cond ${styles.landedName}`}>{t.name}</span>
                  <SportChip sport={SPORT_LOOKS[t.sport]} small />
                  <span className={styles.landedRule} />
                  {t.at ? (
                    <span className={`lab ${styles.landedDate}`}>{shortDate(t.at, timezone)}</span>
                  ) : null}
                  <Tag color={STAGE[t.stage].color}>{STAGE[t.stage].short}</Tag>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className={styles.side}>
          <Panel className={styles.sidePanel}>
            <div className="lab">Stickers</div>
            {isSelf ? (
              earned.length ? (
                <div className={styles.stickerGrid}>
                  {earned.slice(0, 6).map((row) => {
                    const sticker = stickerById.get(row.sticker);
                    if (!sticker) return null;
                    return (
                      <StickerBadge
                        key={row.id}
                        earned
                        sticker={{
                          name: sticker.name,
                          hue: sticker.hue,
                          ...(sticker.ico ? { icon: sticker.ico as never } : {}),
                          ...(sticker.img ? { img: sticker.img } : {}),
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className={styles.sideBody}>None yet. Log a trick and the first one drops.</p>
              )
            ) : (
              <div className={styles.stickerCount}>
                <span className="d">{earned.length}</span>
                <span className="cond">earned on their wall</span>
              </div>
            )}
          </Panel>

          {isSelf ? (
            <Panel className={styles.sidePanel}>
              <div className="lab">Crew</div>
              <p className={styles.sideBody}>
                Your crews and your board live on the crew screen. Nobody can find them from here.
              </p>
              <Link className="btn sm ghost" href={ROUTES.crew}>
                Open your crew
              </Link>
            </Panel>
          ) : (
            <Panel className={styles.sidePanel}>
              <div className="lab">Getting in touch</div>
              <p className={styles.sideBody}>
                There is no messaging on Land The Trick — not here and not anywhere. If something
                about {firstName}&rsquo;s profile is wrong, tell us and a person will look at it.
              </p>
              {/*
                T18. This paragraph promised a route and did not have one until
                now. It is a plain link rather than a modal so it works from any
                profile, signed in or not, which is the OSA duty (plan §6.1) —
                and it goes to us, never to the rider, which is what keeps the
                no-stranger-contact position intact.
              */}
              <Link
                className="btn sm ghost"
                href={reportHref({ type: 'profile', id: rider.id })}
                prefetch={false}
              >
                Report this profile
              </Link>
            </Panel>
          )}
        </div>
      </div>

      {/*
        Videos (T15b). Full width below the grid, and it draws itself only if the
        API returned something — a panel saying "this rider has videos you cannot
        see" would be information about a choice they made not to share.
      */}
      <VideoWall
        videos={videoLinksFromRecords(videoRecords)}
        isSelf={isSelf}
        firstName={firstName}
      />
    </div>
  );
}

/**
 * The refusal.
 *
 * It says as little as it can and still be useful. To a signed-out visitor it
 * cannot say whether the handle exists, because saying so would turn this page
 * into a way of testing whether a child has an account. To a signed-in rider it
 * can name a crewmate — the board already told them that name — and that is the
 * only case where the copy gets more specific.
 */
async function NotVisible({ handle, signedIn }: { handle: string; signedIn: boolean }) {
  const crewmate = signedIn ? await crewmateNamed(handle) : null;

  return (
    <div className={styles.refusal}>
      <Link className={`cond ${styles.back}`} href={ROUTES.crew}>
        ← Crew
      </Link>
      <Panel flat className={styles.refusalPanel}>
        <span className="eyebrow">@{handle}</span>
        <h1 className={`d ${styles.refusalHead}`}>
          {crewmate ? `${crewmate} keeps their profile closed` : 'Nothing to show here'}
        </h1>
        <p className={styles.refusalBody}>
          {crewmate
            ? `They still hold their place on your crew board, by name and score. That much is always visible to a crewmate; the rest is theirs to open.`
            : signedIn
              ? 'Either there is no rider with that handle, or they have not opened their profile to you. Profiles on Land The Trick start private.'
              : 'Either there is no rider with that handle, or they only show their profile to riders signed in to Land The Trick. Profiles on Land The Trick start private.'}
        </p>
        <div className={styles.refusalActions}>
          <Link className="btn sm" href={signedIn ? ROUTES.crew : signInHref(riderHref(handle))}>
            {signedIn ? 'Back to your crew' : 'Sign in'}
          </Link>
        </div>
      </Panel>
    </div>
  );
}

/** The name a crew board already gave us for this handle, if any. */
async function crewmateNamed(handle: string): Promise<string | null> {
  const session = await currentRider();
  if (!session) return null;

  try {
    const crews = await listCrews(session.client);
    for (const crew of crews) {
      const board = await getCrewBoard(session.client, crew.id);
      const row = board.riders.find((r) => normaliseHandle(r.handle) === handle);
      if (row) return (row.name || 'That rider').split(' ')[0] || 'That rider';
    }
  } catch {
    // A board that will not load just means the plainer message.
  }
  return null;
}
