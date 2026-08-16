import type { Client } from './clients';
import type {
  CollectionCreates,
  CollectionName,
  CollectionRecords,
  CollectionUpdates,
} from './generated/collections';

/**
 * Typed access to any collection.
 *
 * The SDK's own surface is stringly-typed: `pb.collection('trikcs')` compiles,
 * and so does reading a field that does not exist. Everything here is keyed off
 * the generated types, so a collection renamed in a migration breaks the build
 * rather than production.
 *
 * **Filters are always parameterised.** Every function below takes bindings
 * separately and hands them to `client.filter`, which escapes them. A filter
 * built by concatenation is the PocketBase spelling of SQL injection, and the
 * privacy rules are written *in* this filter language — a rider who can inject
 * into a filter can read past them.
 */

/** Values that may be bound into a filter. */
export type FilterParams = Record<string, string | number | boolean | null | Date>;

export interface ListOptions {
  /** A PocketBase filter with `{:name}` placeholders. Never interpolate. */
  readonly filter?: string;
  /** Values for the placeholders in `filter`. */
  readonly params?: FilterParams;
  /** e.g. `'-created'`, `'sport,diff'`. */
  readonly sort?: string;
  /** Relations to expand, comma-separated. */
  readonly expand?: string;
  /** Fields to return. Narrowing this does not change the static type. */
  readonly fields?: string;
  readonly signal?: AbortSignal;
}

export interface PageOptions extends ListOptions {
  readonly page?: number;
  readonly perPage?: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly perPage: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

function query(client: Client, options: ListOptions): Record<string, unknown> {
  const { filter, params, sort, expand, fields, signal } = options;
  return {
    ...(filter ? { filter: params ? client.filter(filter, params) : filter } : {}),
    ...(sort ? { sort } : {}),
    ...(expand ? { expand } : {}),
    ...(fields ? { fields } : {}),
    ...(signal ? { signal } : {}),
  };
}

/**
 * A typed handle on one collection.
 *
 * `records(client, 'tricks').list()` is `TricksRecord[]`; `.create()` takes a
 * `TricksCreate`. Nothing here widens to `any`.
 */
export function records<N extends CollectionName>(client: Client, name: N) {
  type Record = CollectionRecords[N];
  const service = client.collection(name);

  return {
    /** Every matching record, following pagination. Use `page` for long lists. */
    async list(options: ListOptions = {}): Promise<Record[]> {
      return service.getFullList<Record>(query(client, options));
    },

    /** One page. The only safe way to read a collection that can grow without bound. */
    async page(options: PageOptions = {}): Promise<Page<Record>> {
      const { page = 1, perPage = 50, ...rest } = options;
      const result = await service.getList<Record>(page, perPage, query(client, rest));
      return {
        items: result.items,
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      };
    },

    /** One record by id. Throws `ClientResponseError` (404) when it is not visible. */
    async get(id: string, options: Omit<ListOptions, 'filter' | 'params'> = {}): Promise<Record> {
      return service.getOne<Record>(id, query(client, options));
    },

    /**
     * The first match, or `null`.
     *
     * `null` is the honest answer for both "no such record" and "not visible to
     * you" — the privacy rules deliberately make those indistinguishable, and
     * a caller that could tell them apart would be a way to probe for riders.
     */
    async first(
      filter: string,
      params: FilterParams,
      options: Omit<ListOptions, 'filter' | 'params'> = {},
    ): Promise<Record | null> {
      try {
        return await service.getFirstListItem<Record>(
          client.filter(filter, params),
          query(client, options),
        );
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async create(data: CollectionCreate<N>, options: ListOptions = {}): Promise<Record> {
      return service.create<Record>(data, query(client, options));
    },

    async update(
      id: string,
      data: CollectionUpdate<N>,
      options: ListOptions = {},
    ): Promise<Record> {
      return service.update<Record>(id, data, query(client, options));
    },

    async remove(id: string): Promise<void> {
      await service.delete(id);
    },
  };
}

/** Is this the SDK's "no such record, or not yours to see" error? */
export function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

/** Did the server refuse this on a rule or a hook — a paywall, a privacy gate, the consent gate? */
export function isForbidden(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 403;
}

/** The shape `records(client, n).create` accepts, for any collection `n`. */
export type CollectionCreate<N extends CollectionName> = CollectionCreates[N];

/** The shape `records(client, n).update` accepts, for any collection `n`. */
export type CollectionUpdate<N extends CollectionName> = CollectionUpdates[N];
