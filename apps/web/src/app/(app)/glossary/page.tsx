import { GLOSSARY, SPORT_IDS, TRICKS, type SportId } from '@landit/core';
import type { Metadata } from 'next';

import { publicTricks } from '@/lib/publicTricks';
import { ROUTES } from '@/lib/routes';

import { GlossaryScreen } from './GlossaryScreen';

export const metadata: Metadata = {
  title: 'Glossary · Land The Trick',
  description: `The ${GLOSSARY.length} words riders use — kerb, fakie, coping, whip and the rest — explained for scooter, skateboard and BMX, with the tricks to see them in.`,
  alternates: { canonical: ROUTES.glossary },
};

/**
 * The glossary (plan §7, T29; handoff `Glossary.dc.html`, screenshots
 * 01–02-glossary).
 *
 * **Readable signed out, like the library.** The words are catalogue copy from
 * `@landit/core`, so there is nothing private on the page and nothing a rider
 * has to be to read it. The one thing read from the database is the trick
 * *names* behind the "See it in" pills, so a trick staff renamed reads the way
 * the library does and a trick staff hid gets no pill. That read is
 * `publicTricks`, which never throws: a glossary that cannot reach the
 * database falls back to the canonical names rather than answering 500 —
 * same rule the sitemap keeps, and for the same reason.
 *
 * **The filter and the way back are in the address.** `?sport=skate` narrows
 * the list so it can be linked and bookmarked (`/library?mine=1` made the same
 * choice), and `?from=<trick>` is what a dotted word in a trick's copy sends,
 * so "Back to the trick" goes to the page the reader left. Both are read here
 * on the server so the first paint is already the right list — filtering after
 * hydration would draw eighty-four terms and then take most of them away.
 * Both are validated against the catalogue rather than trusted: a `sport`
 * that is not one of ours opens the whole glossary, and a `from` that names no
 * trick offers the library instead.
 */
export default async function GlossaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  const requestedSport = one(params.sport);
  const sport = SPORT_IDS.find((id) => id === requestedSport) ?? null;

  const records = await publicTricks();
  const tricks: Record<string, { name: string; sport: SportId }> = Object.fromEntries(
    records.length
      ? records.map((record) => [record.slug, { name: record.name, sport: record.sport }])
      : TRICKS.map((trick) => [trick.id, { name: trick.name, sport: trick.sport }]),
  );

  const requestedFrom = one(params.from);
  const from = requestedFrom && tricks[requestedFrom] ? requestedFrom : null;

  return <GlossaryScreen sport={sport} from={from} tricks={tricks} />;
}
