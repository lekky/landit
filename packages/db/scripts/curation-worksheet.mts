#!/usr/bin/env node
/**
 * Print the tutorial curation worksheet (#462) as CSV.
 *
 *   pnpm --filter @landit/db curation:worksheet > worksheet.csv
 *   pnpm --filter @landit/db curation:worksheet --free   # just the 60 free tricks
 *
 * Open the file in a spreadsheet and work down it. Each row carries a trick,
 * two ready-made YouTube searches, and four empty columns — `tutorial_link`,
 * `tutorial_title`, `tutorial_channel` and `notes` — named to match `/admin` →
 * Tricks → Edit, so transcribing a finished sheet is mechanical.
 *
 * **This reads the canonical `TRICKS` data and talks to nothing.** No
 * PocketBase, no network, no credentials, and above all no video is chosen
 * here: a person watches each one and that act is the approval. See
 * `../src/curation.ts` for why that is not a limitation to be engineered away.
 */
import process from 'node:process';

import { curationRows, curationWorksheetCsv } from '../src/curation.ts';

const freeOnly = process.argv.includes('--free');
const rows = curationRows().filter((row) => !freeOnly || row.tier === 'free');

process.stdout.write(curationWorksheetCsv(rows));
