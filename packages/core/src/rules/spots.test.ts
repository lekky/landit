import { describe, expect, it } from 'vitest';

import { SPOTS } from '../data/spots';
import { distanceMiles, isValidLatLng, parseCoords } from './spots';

describe('parsing a pasted spot', () => {
  it('reads a plain coordinate pair', () => {
    expect(parseCoords('53.4084, -2.9916')).toEqual({ lat: 53.4084, lng: -2.9916 });
    expect(parseCoords('53.4084,-2.9916')).toEqual({ lat: 53.4084, lng: -2.9916 });
    expect(parseCoords('53.4084 -2.9916')).toEqual({ lat: 53.4084, lng: -2.9916 });
  });

  it('reads the pair out of a Google Maps link', () => {
    expect(parseCoords('https://www.google.com/maps/@53.4695,-2.9877,17z')).toEqual({
      lat: 53.4695,
      lng: -2.9877,
    });
  });

  it('wants real precision, so a house number is not a coordinate', () => {
    expect(parseCoords('12.3, 4.5')).toBeNull();
    expect(parseCoords('Rampworx, Liverpool')).toBeNull();
  });

  it('rejects coordinates that are not on Earth', () => {
    expect(parseCoords('153.4084, -2.9916')).toBeNull();
    expect(parseCoords('53.4084, -200.9916')).toBeNull();
  });

  it('has nothing to say about nothing', () => {
    expect(parseCoords('')).toBeNull();
    expect(parseCoords(null)).toBeNull();
    expect(parseCoords(undefined)).toBeNull();
  });
});

describe('validating coordinates', () => {
  it('accepts a real pair and refuses everything else', () => {
    expect(isValidLatLng({ lat: 0, lng: 0 })).toBe(true);
    expect(isValidLatLng({ lat: 90, lng: 180 })).toBe(true);
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 0 })).toBe(false);
    expect(isValidLatLng({ lat: Number.NaN, lng: 0 })).toBe(false);
  });
});

describe('distance', () => {
  it('is zero from a point to itself', () => {
    expect(distanceMiles({ lat: 53.4, lng: -2.9 }, { lat: 53.4, lng: -2.9 })).toBe(0);
  });

  it('measures Liverpool to Manchester at roughly 28 miles', () => {
    const rampworx = { lat: 53.4695, lng: -2.9877 };
    const deansgate = { lat: 53.4779, lng: -2.25 };
    expect(distanceMiles(rampworx, deansgate)).toBeGreaterThan(28);
    expect(distanceMiles(rampworx, deansgate)).toBeLessThan(32);
  });

  it('is symmetric', () => {
    const a = { lat: 51.506, lng: -0.116 };
    const b = { lat: 53.7997, lng: -1.5492 };
    expect(distanceMiles(a, b)).toBeCloseTo(distanceMiles(b, a), 6);
  });

  it('replaces the prototype’s hard-coded per-spot distance', () => {
    // The design pack stored `dist: "2.4 mi"` on each spot, measured from a
    // rider who does not exist. Distance belongs to the viewer.
    for (const spot of SPOTS) {
      expect(spot).not.toHaveProperty('dist');
      expect(distanceMiles({ lat: spot.lat, lng: spot.lng }, spot)).toBe(0);
    }
  });
});
