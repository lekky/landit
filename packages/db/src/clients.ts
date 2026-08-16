import PocketBase from 'pocketbase';

/**
 * The three ways Land It talks to PocketBase.
 *
 * They differ in one thing that matters — **whose credentials they carry** —
 * and confusing them is how a paywall or a privacy rule gets bypassed by
 * accident rather than by attack:
 *
 * - `createBrowserClient` carries the *rider's* token and is subject to every
 *   API rule in the migrations. Everything a screen does goes through it.
 * - `createServerClient` starts anonymous and is given the rider's token for
 *   the length of one request. Still subject to every rule; it exists so a
 *   server component can read as the signed-in rider without borrowing another
 *   request's auth.
 * - `createSuperuserClient` carries *ours* and is subject to none of them. It
 *   is how server code does what riders may not — award a sticker, grant
 *   consent, write the streak — and it never reaches the browser.
 *
 * There is deliberately no module-level singleton. A shared client on the
 * server is a shared auth store, and a shared auth store is one request
 * answering with another rider's data.
 */

/** A PocketBase client. Re-exported so callers need not depend on the SDK directly. */
export type Client = PocketBase;

export interface ClientOptions {
  /** PocketBase base URL. Defaults to `NEXT_PUBLIC_POCKETBASE_URL`. */
  readonly url?: string;
}

/** Thrown when a client is asked for without anything telling it where to connect. */
export class MissingPocketBaseUrl extends Error {
  constructor(variables: readonly string[]) {
    super(
      `No PocketBase URL. Pass one explicitly or set ${variables.join(' or ')} — see apps/web/.env.example.`,
    );
    this.name = 'MissingPocketBaseUrl';
  }
}

function readEnv(name: string): string | undefined {
  // Guarded so this module stays importable somewhere without `process`.
  const env = typeof process === 'undefined' ? undefined : process.env;
  const value = env?.[name];
  return value && value.length > 0 ? value : undefined;
}

/**
 * The public URL, read **literally**, because that is the only form a bundler
 * can see.
 *
 * Next replaces `process.env.NEXT_PUBLIC_FOO` with a string constant wherever
 * it appears verbatim in the source. `readEnv('NEXT_PUBLIC_FOO')` reads the
 * same to a person and is invisible to the compiler: the dynamic key is never
 * substituted, `process.env` in the browser is an empty object, and the client
 * throws `MissingPocketBaseUrl` while the variable is plainly set and visibly
 * correct in the container, in the dashboard and under `printenv` alike.
 *
 * Only the public variable gets this treatment. `POCKETBASE_URL` and the
 * superuser credentials keep the dynamic read *on purpose* — inlining those
 * would ship them in the browser bundle. That asymmetry is the whole reason
 * this is a deliberate second reader rather than a cleverer `readEnv`.
 *
 * The `try` covers the third case: no bundler substituted anything and there is
 * no `process` either, so the bare reference would throw. React Native and a
 * plain `<script>` both land there.
 */
function readPublicUrlLiteral(): string | undefined {
  try {
    const value = process.env.NEXT_PUBLIC_POCKETBASE_URL;
    return value && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function resolveUrl(options: ClientOptions, variables: readonly string[]): string {
  const url = options.url ?? variables.map(readEnv).find(Boolean);
  if (!url) throw new MissingPocketBaseUrl(variables);
  return url;
}

const PUBLIC_URL = ['NEXT_PUBLIC_POCKETBASE_URL'] as const;

/**
 * Server code may point somewhere the browser must not be told about — a seed
 * run against the hosted box, an internal address — so `POCKETBASE_URL` wins
 * where it is set, and the public variable is the fallback.
 */
const SERVER_URL = ['POCKETBASE_URL', 'NEXT_PUBLIC_POCKETBASE_URL'] as const;

/**
 * The browser client. One per browser session; the SDK keeps the rider's token
 * in its own auth store and refreshes it.
 *
 * The URL comes from the inlined literal first and the dynamic read second.
 * The fallback is not dead code: on the server both paths see the same value,
 * and under a test runner or a bundler that does no substitution only the
 * dynamic one does.
 */
export function createBrowserClient(options: ClientOptions = {}): Client {
  const url = options.url ?? readPublicUrlLiteral() ?? readEnv(PUBLIC_URL[0]);
  if (!url) throw new MissingPocketBaseUrl(PUBLIC_URL);
  return new PocketBase(url);
}

export interface ServerClientOptions extends ClientOptions {
  /**
   * The signed-in rider's auth token, from the request's cookie. Omit for an
   * anonymous read — which is a real case: the landing page and the trick
   * library are readable signed-out.
   */
  readonly token?: string | null;
}

/**
 * A server-side client for the life of **one** request.
 *
 * Never hoist the result into a module-level variable: the next request would
 * inherit this one's rider, and every privacy rule in the migrations would
 * happily answer for the wrong person.
 */
export function createServerClient(options: ServerClientOptions = {}): Client {
  const client = new PocketBase(resolveUrl(options, SERVER_URL));
  client.autoCancellation(false);
  if (options.token) client.authStore.save(options.token, null);
  return client;
}

export interface SuperuserClientOptions extends ClientOptions {
  /** Defaults to `POCKETBASE_SUPERUSER_EMAIL`. */
  readonly email?: string;
  /** Defaults to `POCKETBASE_SUPERUSER_PASSWORD`. */
  readonly password?: string;
}

/**
 * Thrown when superuser credentials are missing, or when this is called
 * somewhere a browser could reach.
 */
export class SuperuserUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SuperuserUnavailable';
  }
}

/**
 * The superuser client. **Server only**, and it authenticates before returning
 * so a caller never holds a client that merely looks privileged.
 *
 * Every rule in the migrations and every request-layer hook is bypassed by
 * this token — that is what it is for, and why the model-layer hooks (the
 * paywall, the sticker award) deliberately do *not* exempt it. Reach for it
 * only where the product genuinely acts as itself rather than as a rider:
 * seeds, the consent flow, sticker awards, staff actions.
 */
export async function createSuperuserClient(options: SuperuserClientOptions = {}): Promise<Client> {
  // A bundler that pulled this into client code would be shipping the
  // credentials with it. Fail loudly rather than quietly.
  //
  // Read off `globalThis` rather than the bare identifier: this package never
  // pulls in DOM lib types (it has to stay usable from a React Native app and
  // from Node), so `window` is not a name it knows.
  if (typeof (globalThis as { window?: unknown }).window !== 'undefined') {
    throw new SuperuserUnavailable(
      'The superuser client is server-only. Something imported it into browser code.',
    );
  }

  const email = options.email ?? readEnv('POCKETBASE_SUPERUSER_EMAIL');
  const password = options.password ?? readEnv('POCKETBASE_SUPERUSER_PASSWORD');
  if (!email || !password) {
    throw new SuperuserUnavailable(
      'Set POCKETBASE_SUPERUSER_EMAIL and POCKETBASE_SUPERUSER_PASSWORD — see apps/web/.env.example.',
    );
  }

  const client = new PocketBase(resolveUrl(options, SERVER_URL));
  client.autoCancellation(false);
  await client.collection('_superusers').authWithPassword(email, password);
  return client;
}
