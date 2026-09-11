/// <reference path="../.pb_data/types.d.ts" />

/**
 * Imported spots follow the import sports rule (Rachid, 2026-09-11, in chat:
 * "apply the scooter rule to france too, and for any import").
 *
 * **What was wrong.** The France import (#383) wrote all 3,103 of its parks as
 * `sports: ['skate']`, reading the census's silence about scooters as a
 * refusal. The owner's rule for a silent source — first given for the
 * 2026-09-06 research sweep, now extended to every import — is the opposite: a
 * public park with no documented restriction is open to scooters and
 * skateboards, and BMX is listed only where the source names it. A scooter
 * rider filtering the map by their sport saw none of France.
 *
 * **Why a migration and not the seed.** The France table is seeded
 * `onExisting: 'skip'` on purpose: written once and never over, so a staff edit
 * survives a re-seed (#273). That same guarantee means a re-seed cannot carry
 * this correction to rows already on the live box. The importer now writes the
 * right sports for a fresh database (`importedSpotSports` in `@landit/core`);
 * this pass brings the existing rows level, once.
 *
 * **Only rows still exactly as the import wrote them.** A French row whose
 * sports are anything but `['skate']` has been touched by a person, and a
 * person's decision outranks a default, so it is left alone. On 2026-09-11 all
 * 3,103 live rows matched the seed exactly, so today that guard excludes
 * nothing; it is there for whatever happens between this merge and the deploy.
 *
 * **BMX comes from the census, by name.** Twelve places are named for BMX in the
 * census itself ("Piste BMX", "Skate Park & BMX", "Salle de roller, skate,
 * bmx"). A JSVM migration cannot import from the workspace, so they are listed
 * here as `name|town`, and `packages/db/src/imports/france.test.ts` reads this
 * file as text and fails if these lists and the importer ever disagree. One is
 * a BMX track on dirt ("Terre battue", Tarnos), and a track on loose ground is
 * listed for BMX alone (owner's call, same conversation).
 *
 * **No audit rows.** The audit hooks are request hooks and a migration is not a
 * request — the same as the source/licence backfill before it. This file, in
 * git, is the record of the change.
 *
 * **Reversible.** `down` puts `['skate']` back on French rows whose sports are
 * one of the three values `up` writes, and on nothing else.
 */
migrate(
  (app) => {
    /** Places the census names for BMX, on ground every sport can ride. */
    const WITH_BMX = new Set([
      'Piste de Skate Bitumée|Saintes',
      'Skatepark|Montagnac',
      'Aire de Détente de la Coulée Verte|Cocheren',
      'Tache Verte Skate Park et Boulodrome|Royan',
      'Piste de Skate (bols)|Saintes',
      'Skatepark|Baume-les-Dames',
      'BMX skatepark international Ronan Pointeau|Montpellier',
      'Skatepark Rue de la LIBERTE|Vinay',
      'Camping de la Tensch|Francaltroff',
      'Base Nature Francois Leotard 2|Fréjus',
      'Complexe l’Atelier|Tourcoing',
    ]);

    /** BMX tracks on loose ground — dirt, sand — listed for BMX alone. */
    const BMX_ONLY = new Set(['Skate Park de la Baye 2|Tarnos']);

    let rows = [];
    try {
      rows = app.findRecordsByFilter('spots', "source = 'fr-sports-gouv'", 'created,id', 0, 0);
    } catch {
      // A fresh database has no rows; the seed writes them with the rule applied.
      return;
    }

    for (const row of rows) {
      const sports = row.getStringSlice('sports') || [];
      if (sports.length !== 1 || String(sports[0]) !== 'skate') continue;

      const key = `${row.getString('name')}|${row.getString('town')}`;
      if (BMX_ONLY.has(key)) row.set('sports', ['bmx']);
      else if (WITH_BMX.has(key)) row.set('sports', ['scooter', 'skate', 'bmx']);
      else row.set('sports', ['scooter', 'skate']);
      app.save(row);
    }
  },

  (app) => {
    /** What `up` writes, as sorted comma-joined lists. */
    const WRITTEN = new Set(['bmx', 'scooter,skate', 'bmx,scooter,skate']);

    let rows = [];
    try {
      rows = app.findRecordsByFilter('spots', "source = 'fr-sports-gouv'", 'created,id', 0, 0);
    } catch {
      return;
    }

    for (const row of rows) {
      const raw = row.getStringSlice('sports') || [];
      const sports = [];
      for (let i = 0; i < raw.length; i++) sports.push(String(raw[i]));
      if (!WRITTEN.has(sports.sort().join(','))) continue;
      row.set('sports', ['skate']);
      app.save(row);
    }
  },
);
