#!/usr/bin/env node
/**
 * Generate `src/generated/collections.ts` from the repo's own migrations.
 *
 *   pnpm --filter @landit/db typegen          # rewrite the file
 *   pnpm --filter @landit/db typegen --check  # fail if it is out of date
 *
 * **Why this is not `pocketbase-typegen`,** which plan §7 originally named:
 * that package reads the SQLite file through `better-sqlite3`, a native module
 * pnpm refuses to build unless it is added to `allowBuilds` — a list
 * `pnpm-workspace.yaml` says to keep as short as it can be, with a reason
 * beside each entry. With it unbuilt, *every* pnpm command in the workspace
 * fails, including CI's `pnpm install --frozen-lockfile`. Paying for a native
 * toolchain on every machine to read a database we generate ourselves was the
 * worse trade, so this reads the same schema over the API instead: no
 * dependency, no native build, and the source is the migrations rather than a
 * database someone remembered to export. Recorded in plan §7.
 *
 * The schema comes out of a throwaway PocketBase started on the pinned binary
 * with `pocketbase/migrations/` applied — so the types can never describe a
 * schema the migrations do not actually produce.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD, withInstance } from './pb-instance.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'src', 'generated', 'collections.ts');

async function fetchCollections(url) {
  const auth = await fetch(`${url}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: SUPERUSER_EMAIL, password: SUPERUSER_PASSWORD }),
  });
  if (!auth.ok) throw new Error(`superuser auth failed: ${auth.status}`);
  const { token } = await auth.json();

  const response = await fetch(`${url}/api/collections?perPage=200`, {
    headers: { Authorization: token },
  });
  if (!response.ok) throw new Error(`could not list collections: ${response.status}`);
  const { items } = await response.json();

  // PocketBase's own `_superusers`, `_authOrigins`, `_externalAuths`,
  // `_mfas` and `_otps` are its plumbing, not Land The Trick's data model.
  return items
    .filter((c) => !c.system && !c.name.startsWith('_'))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------- emitting TS */

const pascal = (s) =>
  s
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');

/**
 * Fields PocketBase puts on every record it returns but does not list in the
 * collection's `fields` — unlike `id`, `email` and `verified`, which an auth
 * collection *does* list and which must therefore not be added twice.
 */
const RESPONSE_ONLY = [
  ['collectionId', 'string'],
  ['collectionName', 'string'],
];

function tsTypeOf(field, collectionName, selectTypes) {
  const many = (t) => (field.maxSelect && field.maxSelect > 1 ? `${t}[]` : t);

  switch (field.type) {
    case 'text':
    case 'editor':
    case 'email':
    case 'url':
    case 'password':
      return 'string';
    case 'number':
      return 'number';
    case 'bool':
      return 'boolean';
    case 'date':
    case 'autodate':
      // PocketBase hands dates back as `YYYY-MM-DD HH:mm:ss.SSSZ` strings.
      return 'string';
    case 'select': {
      const name = `${pascal(collectionName)}${pascal(field.name)}`;
      const union = field.values.map((v) => `'${v}'`).join(' | ');
      selectTypes.set(name, union);
      return many(name);
    }
    case 'relation':
    case 'file':
      return many('string');
    case 'geoPoint':
      return '{ lon: number; lat: number }';
    case 'json':
    default:
      return 'unknown';
  }
}

/**
 * `id` is the one system field a client may supply on create (PocketBase
 * generates it otherwise), and autodates are never written by hand.
 */
function isWritable(field) {
  return field.type !== 'autodate';
}

function emit(collections) {
  const selectTypes = new Map();
  const blocks = [];
  const names = [];
  const recordMap = [];
  const createMap = [];
  const updateMap = [];

  for (const collection of collections) {
    const Name = pascal(collection.name);
    names.push(collection.name);
    recordMap.push(`  ${collection.name}: ${Name}Record;`);
    createMap.push(`  ${collection.name}: ${Name}Create;`);
    updateMap.push(`  ${collection.name}: ${Name}Update;`);

    // `hidden` fields (the consent token hashes) never leave the server, so
    // they are not part of any shape a caller can see or set.
    const fields = collection.fields.filter((f) => !f.hidden && f.type !== 'password');
    const declared = new Set(fields.map((f) => f.name));

    const read = [
      ...RESPONSE_ONLY.filter(([n]) => !declared.has(n)).map(([n, t]) => `  ${n}: ${t};`),
      ...fields.map((f) => `  ${f.name}: ${tsTypeOf(f, collection.name, selectTypes)};`),
    ];

    // `id` is listed as an ordinary field but is generated when omitted, and
    // an auth collection's `email`/`verified` go through the auth endpoints,
    // not a record write.
    const NOT_PLAIN_WRITES = new Set(
      collection.type === 'auth' ? ['id', 'email', 'verified', 'emailVisibility'] : ['id'],
    );
    const writable = fields.filter((f) => isWritable(f) && !NOT_PLAIN_WRITES.has(f.name));
    const create = writable.map(
      (f) => `  ${f.name}${f.required ? '' : '?'}: ${tsTypeOf(f, collection.name, selectTypes)};`,
    );

    blocks.push(
      [
        `/** A \`${collection.name}\` record as PocketBase returns it. */`,
        `export interface ${Name}Record {`,
        ...read,
        `}`,
        ``,
        `/** The shape accepted when creating a \`${collection.name}\` record. */`,
        `export interface ${Name}Create {`,
        `  id?: string;`,
        ...create,
        `}`,
        ``,
        `/** The shape accepted when updating a \`${collection.name}\` record. */`,
        `export type ${Name}Update = Partial<${Name}Create>;`,
      ].join('\n'),
    );
  }

  const selects = [...selectTypes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, union]) => `export type ${name} = ${union};`)
    .join('\n');

  return `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with \`pnpm --filter @landit/db typegen\` after changing anything
 * in \`pocketbase/migrations/\`. \`collections.drift.test.ts\` fails if this file
 * and the migrations disagree, so a stale copy cannot reach main.
 *
 * Every field is present on the \`*Record\` shapes because PocketBase returns a
 * zero value rather than omitting a field. Optionality only means something on
 * write, which is what \`*Create\` and \`*Update\` describe.
 */

/** Every collection Land The Trick defines. PocketBase's own \`_\`-prefixed ones are not here. */
export type CollectionName =
${names.map((n) => `  | '${n}'`).join('\n')};

${selects}

${blocks.join('\n\n')}

/** Collection name to the record it holds. */
export interface CollectionRecords {
${recordMap.join('\n')}
}

/** Collection name to the shape its create accepts. */
export interface CollectionCreates {
${createMap.join('\n')}
}

/** Collection name to the shape its update accepts. */
export interface CollectionUpdates {
${updateMap.join('\n')}
}
`;
}

/* -------------------------------------------------------------------- main */

const check = process.argv.includes('--check');

const generated = await withInstance(async (url) => emit(await fetchCollections(url)));

if (check) {
  const current = existsSync(OUT) ? await readFile(OUT, 'utf8') : '';
  if (current !== generated) {
    process.stderr.write(
      `${path.relative(process.cwd(), OUT)} is out of date.\n` +
        `Run \`pnpm --filter @landit/db typegen\` and commit the result.\n`,
    );
    process.exit(1);
  }
  process.stderr.write('Generated collection types are up to date.\n');
} else {
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, generated, 'utf8');
  process.stderr.write(`Wrote ${path.relative(process.cwd(), OUT)}\n`);
}
