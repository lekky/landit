/// <reference path="../.pb_data/types.d.ts" />

/**
 * A fifth thing a report can be about: an event (issue #315).
 *
 * The event pages (2026-09-06) carry a "Report a problem with this listing"
 * link, and the four subjects the form had — profile, spot, video, other — left
 * it filing under `other` with a bare record id. The calendar is researched
 * from organisers' pages and goes stale by existing, so a rider saying a
 * listing is wrong is the main way it gets corrected; it deserves its own
 * queue label. The list lives in three places on purpose — here, the hook's
 * `SUBJECT_TYPES`, and `REPORT_SUBJECTS` in `@landit/core` — and the core test
 * pins the order.
 */
migrate(
  (app) => {
    const reports = app.findCollectionByNameOrId('reports');
    const field = reports.fields.getByName('subject_type');
    if (!field) throw new Error('reports.subject_type is missing');
    field.values = ['profile', 'clip', 'spot', 'event', 'other'];
    app.save(reports);
  },
  (app) => {
    const reports = app.findCollectionByNameOrId('reports');
    const field = reports.fields.getByName('subject_type');
    if (!field) return;
    field.values = ['profile', 'clip', 'spot', 'other'];
    app.save(reports);
  },
);
