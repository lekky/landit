import { beforeEach, describe, expect, it } from 'vitest';

import {
  forgetLibraryPlace,
  libraryArrival,
  noteScreen,
  rememberLibraryPlace,
  rememberedLibraryHref,
  withinLibrary,
  type LibraryPlace,
} from './libraryPlace';

/**
 * The library's place memory.
 *
 * What is worth asserting here is not that a setter sets. It is the **shape of
 * the promise**: one hop, this sport only, and forgotten the moment the rider
 * is somewhere else. Each of those is a line in `noteScreen` or
 * `libraryPlaceFor` that a later change could drop without any screen failing —
 * a rider would just find themselves at the top of the grid again, or, worse,
 * put back into a view they left half an hour and four screens ago.
 */

const place = (over: Partial<LibraryPlace> = {}): LibraryPlace => ({
  href: '/library',
  sport: 'scooter',
  narrowing: { search: 'whip', difficulty: 3, status: 'all', sort: 'easiest' },
  scrollY: 1840,
  ...over,
});

beforeEach(() => {
  forgetLibraryPlace();
});

describe('withinLibrary', () => {
  it('is the library and its trick pages, and nothing else', () => {
    expect(withinLibrary('/library')).toBe(true);
    expect(withinLibrary('/library/tailwhip')).toBe(true);
    expect(withinLibrary('/library?mine=1')).toBe(false);
    expect(withinLibrary('/home')).toBe(false);
    // Not a prefix match: a future `/libraryish` is somewhere else entirely.
    expect(withinLibrary('/library-of-congress')).toBe(false);
  });
});

describe('the remembered place', () => {
  it('is nothing until the rider has been in the library', () => {
    expect(libraryArrival('scooter')).toBeNull();
    expect(rememberedLibraryHref()).toBeNull();
  });

  it('survives the hop into a trick page and back', () => {
    rememberLibraryPlace(place());
    noteScreen('/library/tailwhip');
    expect(libraryArrival('scooter')?.scrollY).toBe(1840);
    expect(rememberedLibraryHref()).toBe('/library');
    // Arriving back at the library does not spend it: React renders a component
    // twice in development, and both renders have to agree about where the
    // rider goes.
    noteScreen('/library');
    expect(libraryArrival('scooter')?.scrollY).toBe(1840);
    expect(libraryArrival('scooter')?.narrowing?.search).toBe('whip');
  });

  it('is forgotten as soon as the rider is on another screen', () => {
    rememberLibraryPlace(place());
    noteScreen('/library/tailwhip');
    noteScreen('/home');
    expect(libraryArrival('scooter')).toBeNull();
    expect(rememberedLibraryHref()).toBeNull();
  });

  it("puts a rider at the top when the place belongs to another sport's grid", () => {
    rememberLibraryPlace(place({ sport: 'bmx' }));
    noteScreen('/library/bmx-bunny-hop');
    expect(libraryArrival('scooter')).toEqual({ narrowing: null, scrollY: 0 });
    expect(libraryArrival('bmx')?.narrowing?.search).toBe('whip');
  });

  it('carries the address the rider left, so the back arrow lands where Back would', () => {
    rememberLibraryPlace(place({ href: '/library?mine=1&cat=park' }));
    noteScreen('/library/tailwhip');
    expect(rememberedLibraryHref()).toBe('/library?mine=1&cat=park');
  });

  it('keeps only the last place: a second visit replaces the first', () => {
    rememberLibraryPlace(place({ scrollY: 400 }));
    rememberLibraryPlace(place({ scrollY: 2600 }));
    expect(libraryArrival('scooter')?.scrollY).toBe(2600);
  });
});
