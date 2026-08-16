/**
 * Countries a rider can pick at sign-up, with their names.
 *
 * Anyone can sign up (plan §6.3), so this is the whole of ISO-3166-1 alpha-2
 * rather than a shortlist of markets — the country is not a market decision, it
 * is what selects the consent threshold, and a rider whose country is missing
 * would have to lie about where they live to make an account.
 *
 * **The names are a table, not `Intl.DisplayNames`**, and that is a correction
 * rather than a preference. Deriving them at runtime looked like the way to
 * avoid a long list that could go stale — until the sign-up form was rendered
 * on a server and hydrated in a browser whose ICU data disagreed about a
 * handful of them. React threw the whole form away and rebuilt it, which on a
 * slow connection means a child's typing vanishing mid-sign-up. A table is the
 * same on both sides by construction.
 *
 * Generated once from `Intl.DisplayNames(['en-GB'], { type: 'region' })` on
 * Node 24 and committed as data. Editing a name is an ordinary data change;
 * adding a country means adding both halves of one line.
 */

/** Every country a sign-up may carry, code to name, alphabetical by code. */
export const COUNTRIES: Readonly<Record<string, string>> = Object.freeze({
  AD: 'Andorra',
  AE: 'United Arab Emirates',
  AF: 'Afghanistan',
  AG: 'Antigua & Barbuda',
  AI: 'Anguilla',
  AL: 'Albania',
  AM: 'Armenia',
  AO: 'Angola',
  AQ: 'Antarctica',
  AR: 'Argentina',
  AS: 'American Samoa',
  AT: 'Austria',
  AU: 'Australia',
  AW: 'Aruba',
  AX: 'Åland Islands',
  AZ: 'Azerbaijan',
  BA: 'Bosnia & Herzegovina',
  BB: 'Barbados',
  BD: 'Bangladesh',
  BE: 'Belgium',
  BF: 'Burkina Faso',
  BG: 'Bulgaria',
  BH: 'Bahrain',
  BI: 'Burundi',
  BJ: 'Benin',
  BL: 'St Barthélemy',
  BM: 'Bermuda',
  BN: 'Brunei',
  BO: 'Bolivia',
  BQ: 'Caribbean Netherlands',
  BR: 'Brazil',
  BS: 'Bahamas',
  BT: 'Bhutan',
  BV: 'Bouvet Island',
  BW: 'Botswana',
  BY: 'Belarus',
  BZ: 'Belize',
  CA: 'Canada',
  CC: 'Cocos (Keeling) Islands',
  CD: 'Congo - Kinshasa',
  CF: 'Central African Republic',
  CG: 'Congo - Brazzaville',
  CH: 'Switzerland',
  CI: 'Côte d’Ivoire',
  CK: 'Cook Islands',
  CL: 'Chile',
  CM: 'Cameroon',
  CN: 'China',
  CO: 'Colombia',
  CR: 'Costa Rica',
  CU: 'Cuba',
  CV: 'Cape Verde',
  CW: 'Curaçao',
  CX: 'Christmas Island',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DE: 'Germany',
  DJ: 'Djibouti',
  DK: 'Denmark',
  DM: 'Dominica',
  DO: 'Dominican Republic',
  DZ: 'Algeria',
  EC: 'Ecuador',
  EE: 'Estonia',
  EG: 'Egypt',
  EH: 'Western Sahara',
  ER: 'Eritrea',
  ES: 'Spain',
  ET: 'Ethiopia',
  FI: 'Finland',
  FJ: 'Fiji',
  FK: 'Falkland Islands',
  FM: 'Micronesia',
  FO: 'Faroe Islands',
  FR: 'France',
  GA: 'Gabon',
  GB: 'United Kingdom',
  GD: 'Grenada',
  GE: 'Georgia',
  GF: 'French Guiana',
  GG: 'Guernsey',
  GH: 'Ghana',
  GI: 'Gibraltar',
  GL: 'Greenland',
  GM: 'Gambia',
  GN: 'Guinea',
  GP: 'Guadeloupe',
  GQ: 'Equatorial Guinea',
  GR: 'Greece',
  GS: 'South Georgia & South Sandwich Islands',
  GT: 'Guatemala',
  GU: 'Guam',
  GW: 'Guinea-Bissau',
  GY: 'Guyana',
  HK: 'Hong Kong SAR China',
  HM: 'Heard & McDonald Islands',
  HN: 'Honduras',
  HR: 'Croatia',
  HT: 'Haiti',
  HU: 'Hungary',
  ID: 'Indonesia',
  IE: 'Ireland',
  IL: 'Israel',
  IM: 'Isle of Man',
  IN: 'India',
  IO: 'British Indian Ocean Territory',
  IQ: 'Iraq',
  IR: 'Iran',
  IS: 'Iceland',
  IT: 'Italy',
  JE: 'Jersey',
  JM: 'Jamaica',
  JO: 'Jordan',
  JP: 'Japan',
  KE: 'Kenya',
  KG: 'Kyrgyzstan',
  KH: 'Cambodia',
  KI: 'Kiribati',
  KM: 'Comoros',
  KN: 'St Kitts & Nevis',
  KP: 'North Korea',
  KR: 'South Korea',
  KW: 'Kuwait',
  KY: 'Cayman Islands',
  KZ: 'Kazakhstan',
  LA: 'Laos',
  LB: 'Lebanon',
  LC: 'St Lucia',
  LI: 'Liechtenstein',
  LK: 'Sri Lanka',
  LR: 'Liberia',
  LS: 'Lesotho',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  LY: 'Libya',
  MA: 'Morocco',
  MC: 'Monaco',
  MD: 'Moldova',
  ME: 'Montenegro',
  MF: 'St Martin',
  MG: 'Madagascar',
  MH: 'Marshall Islands',
  MK: 'North Macedonia',
  ML: 'Mali',
  MM: 'Myanmar (Burma)',
  MN: 'Mongolia',
  MO: 'Macao SAR China',
  MP: 'Northern Mariana Islands',
  MQ: 'Martinique',
  MR: 'Mauritania',
  MS: 'Montserrat',
  MT: 'Malta',
  MU: 'Mauritius',
  MV: 'Maldives',
  MW: 'Malawi',
  MX: 'Mexico',
  MY: 'Malaysia',
  MZ: 'Mozambique',
  NA: 'Namibia',
  NC: 'New Caledonia',
  NE: 'Niger',
  NF: 'Norfolk Island',
  NG: 'Nigeria',
  NI: 'Nicaragua',
  NL: 'Netherlands',
  NO: 'Norway',
  NP: 'Nepal',
  NR: 'Nauru',
  NU: 'Niue',
  NZ: 'New Zealand',
  OM: 'Oman',
  PA: 'Panama',
  PE: 'Peru',
  PF: 'French Polynesia',
  PG: 'Papua New Guinea',
  PH: 'Philippines',
  PK: 'Pakistan',
  PL: 'Poland',
  PM: 'St Pierre & Miquelon',
  PN: 'Pitcairn Islands',
  PR: 'Puerto Rico',
  PS: 'Palestinian Territories',
  PT: 'Portugal',
  PW: 'Palau',
  PY: 'Paraguay',
  QA: 'Qatar',
  RE: 'Réunion',
  RO: 'Romania',
  RS: 'Serbia',
  RU: 'Russia',
  RW: 'Rwanda',
  SA: 'Saudi Arabia',
  SB: 'Solomon Islands',
  SC: 'Seychelles',
  SD: 'Sudan',
  SE: 'Sweden',
  SG: 'Singapore',
  SH: 'St Helena',
  SI: 'Slovenia',
  SJ: 'Svalbard & Jan Mayen',
  SK: 'Slovakia',
  SL: 'Sierra Leone',
  SM: 'San Marino',
  SN: 'Senegal',
  SO: 'Somalia',
  SR: 'Suriname',
  SS: 'South Sudan',
  ST: 'São Tomé & Príncipe',
  SV: 'El Salvador',
  SX: 'Sint Maarten',
  SY: 'Syria',
  SZ: 'Eswatini',
  TC: 'Turks & Caicos Islands',
  TD: 'Chad',
  TF: 'French Southern Territories',
  TG: 'Togo',
  TH: 'Thailand',
  TJ: 'Tajikistan',
  TK: 'Tokelau',
  TL: 'Timor-Leste',
  TM: 'Turkmenistan',
  TN: 'Tunisia',
  TO: 'Tonga',
  TR: 'Türkiye',
  TT: 'Trinidad & Tobago',
  TV: 'Tuvalu',
  TW: 'Taiwan',
  TZ: 'Tanzania',
  UA: 'Ukraine',
  UG: 'Uganda',
  UM: 'US Outlying Islands',
  US: 'United States',
  UY: 'Uruguay',
  UZ: 'Uzbekistan',
  VA: 'Vatican City',
  VC: 'St Vincent & the Grenadines',
  VE: 'Venezuela',
  VG: 'British Virgin Islands',
  VI: 'US Virgin Islands',
  VN: 'Vietnam',
  VU: 'Vanuatu',
  WF: 'Wallis & Futuna',
  WS: 'Samoa',
  YE: 'Yemen',
  YT: 'Mayotte',
  ZA: 'South Africa',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',
});

/** Every country code a sign-up may carry. */
export const COUNTRY_CODES: readonly string[] = Object.freeze(Object.keys(COUNTRIES));

/**
 * The countries offered first, in this order.
 *
 * Not a claim about where riders are — a claim about where the *sign-up form*
 * should not make somebody scroll. The UK is where this is built and where the
 * first riders are; the rest are the largest English-speaking markets, which is
 * the only signal available before launch.
 */
export const COUNTRY_SUGGESTIONS: readonly string[] = Object.freeze([
  'GB',
  'IE',
  'US',
  'CA',
  'AU',
  'NZ',
]);

/** The default selection on the sign-up form. */
export const DEFAULT_COUNTRY = 'GB';

/** A country's name, falling back to the bare code for anything unknown. */
export function countryName(code: string): string {
  const upper = String(code ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 2);
  if (!upper) return '';
  return COUNTRIES[upper] ?? upper;
}

/**
 * Every country as `{ code, name }`, sorted by name for a picker.
 *
 * Sorted with plain comparisons rather than `localeCompare`, for the same
 * reason the names are a table: a collation that differs between the server and
 * the browser reorders the list during hydration.
 */
export function countryOptions(
  codes: readonly string[] = COUNTRY_CODES,
): readonly { readonly code: string; readonly name: string }[] {
  return codes
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
