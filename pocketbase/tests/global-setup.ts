import type { TestProject } from 'vitest/node';

import { startPocketBase } from './instance';

/**
 * One throwaway PocketBase for the whole suite. Test files create their own
 * riders with unique handles, so they neither see nor disturb each other.
 */
export default async function setup(project: TestProject) {
  const instance = await startPocketBase();
  project.provide('pocketbaseUrl', instance.url);

  return async () => {
    await instance.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    pocketbaseUrl: string;
  }
}
