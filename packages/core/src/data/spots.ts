import type { Spot } from '../types';

/**
 * Seed spots, transcribed from `design-handoff/design/landit-data.js`.
 *
 * The prototype carried a hard-coded `dist` ("2.4 mi") per spot, measured from
 * a rider who does not exist. Distance is a property of the viewer, not of the
 * spot, so it is not stored: use `distanceMiles` from `../rules/spots.ts`.
 * Every seeded spot is `live`; rider submissions land as `pending` (plan §3).
 */
export const SPOTS = [
  {
    name: 'Rampworx',
    town: 'Liverpool',
    type: 'Indoor park',
    lat: 53.4695,
    lng: -2.9877,
    sports: ['scooter', 'skate'],
    tags: ['Foam pit', 'Resi', 'Bowl'],
    status: 'live',
  },
  {
    name: 'Hillside Bowl',
    town: 'Sheffield',
    type: 'Concrete',
    lat: 53.3811,
    lng: -1.4701,
    sports: ['skate'],
    tags: ['Bowl', 'Ledges'],
    status: 'live',
  },
  {
    name: 'Deansgate Ledges',
    town: 'Manchester',
    type: 'Street spot',
    lat: 53.4779,
    lng: -2.25,
    sports: ['scooter', 'skate'],
    tags: ['Ledges', 'Flat', 'Rails'],
    status: 'live',
  },
  {
    name: 'Adrenaline Alley',
    town: 'Corby',
    type: 'Indoor park',
    lat: 52.493,
    lng: -0.689,
    sports: ['scooter', 'skate'],
    tags: ['Foam pit', 'Box jump', 'Mini'],
    status: 'live',
  },
  {
    name: 'Southbank',
    town: 'London',
    type: 'Street spot',
    lat: 51.506,
    lng: -0.116,
    sports: ['skate'],
    tags: ['Flat', 'Banks'],
    status: 'live',
  },
  {
    name: 'Ramp 1',
    town: 'Wigan',
    type: 'Indoor park',
    lat: 53.545,
    lng: -2.632,
    sports: ['scooter'],
    tags: ['Ramps', 'Bowl', 'Resi'],
    status: 'live',
  },
  {
    name: 'Greystone',
    town: 'Leeds',
    type: 'Concrete',
    lat: 53.7997,
    lng: -1.5492,
    sports: ['scooter', 'skate'],
    tags: ['Bowl', 'Ledges'],
    status: 'live',
  },
] as const satisfies readonly Spot[];
