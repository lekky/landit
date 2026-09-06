/// <reference path="../.pb_data/types.d.ts" />

/**
 * `users.heard_about` — how a rider says they found Land The Trick.
 *
 * Asked once, at the end of onboarding, and never required. A **select** rather
 * than a text field, and that is the whole safety argument for holding it at
 * all: the column can only ever contain one of nine strings this repo chose, so
 * there is no shape of write — a forged request, a future form, a staff edit —
 * that can turn it into somewhere a child's own words are kept. The values
 * mirror `HEARD_ABOUT` in `packages/core/src/data/profile.ts`.
 *
 * **Why it is stored rather than only counted.** PostHog is cookieless with no
 * person profiles (`apps/web/src/lib/analytics.ts`), deliberately, so an
 * analytics answer could say "eleven riders came from YouTube" and could never
 * say whether any of them stayed a week or paid for anything. Sitting on the
 * rider's own row, beside `plan` and their subscription, it can. That is the
 * only reason it earns a column, and it is why nothing else about the answer —
 * no date, no free text, no second field — is kept.
 *
 * It is a rider fact, so it is inside every guarantee the others are: the
 * profile privacy rules already cover it, `hooks/lib/erasure.js` clears it when
 * an account is closed, and the data export writes it out in words.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    users.fields.add(
      new SelectField({
        type: 'select',
        name: 'heard_about',
        required: false,
        maxSelect: 1,
        values: [
          'friend',
          'skatepark',
          'youtube',
          'tiktok',
          'instagram',
          'coach',
          'family',
          'search',
          'elsewhere',
        ],
      }),
    );

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const field = users.fields.getByName('heard_about');
    if (field) users.fields.removeById(field.id);
    app.save(users);
  },
);
