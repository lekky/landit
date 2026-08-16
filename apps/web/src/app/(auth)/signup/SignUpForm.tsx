'use client';

import {
  COUNTRY_SUGGESTIONS,
  DEFAULT_COUNTRY,
  consentAge,
  countryName,
  countryOptions,
  declareAge,
  isDayKey,
  signupOutcome,
  toDayKey,
  type AgeDeclaration,
} from '@landit/core';
import { Button } from '@landit/ui-web';
import { useActionState, useMemo, useState } from 'react';

import { TimezoneField } from '@/components/TimezoneField';

import { signUpAction, type AuthFormState } from '../actions';
import styles from '../auth.module.css';

/**
 * Sign-up (screenshot 04, plus the two fields the plan adds to it).
 *
 * **The date of birth never leaves this device.** That is not a comment about
 * intent, it is what the code does: the date input has no `name`, so the browser
 * cannot include it in the submission, and the only age-shaped things that go to
 * the server are the band and the day it changes — both computed here by
 * `declareAge` (plan §3, §6.2). If you add a `name` to that input, you have
 * started collecting children's birth dates.
 *
 * The rest is the consent flow's front half (§6.2, §6.3):
 *
 * - **No minimum age is stated anywhere.** Ofcom's position is that a service
 *   claiming one must enforce it with highly effective age assurance, and a
 *   tick-box is explicitly not that — so "13+, please tick" would manufacture a
 *   duty we cannot discharge. Younger riders are welcome, with a guardian.
 * - **Below the country's threshold**, the rider is told a grown-up will need to
 *   say yes *before* they fill anything else in, rather than after they have
 *   made an account.
 * - **A US under-13 is declined** with the reason, here and again on the server.
 *   COPPA's verifiable parental consent is a different and much heavier
 *   mechanism than an approval email, and we are not building it at launch.
 */
export function SignUpForm() {
  const [state, action, pending] = useActionState<AuthFormState | undefined, FormData>(
    signUpAction,
    undefined,
  );

  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);
  const [dob, setDob] = useState('');
  const countries = useMemo(() => countryOptions(), []);

  const declaration: AgeDeclaration | null = useMemo(() => {
    if (!isDayKey(dob)) return null;
    try {
      return declareAge(dob, toDayKey(new Date()));
    } catch {
      return null;
    }
  }, [dob]);

  const outcome = declaration ? signupOutcome(country, declaration.band) : null;
  const declined = outcome === 'declined';
  const needsGuardian = outcome === 'consent_required';
  const errors = state?.errors ?? {};

  return (
    <form action={action} className={styles.form}>
      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" placeholder="Miles" autoComplete="given-name" />
        {errors.name ? <span className="err">{errors.name}</span> : null}
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" placeholder="you@example.com" />
        {errors.email ? <span className="err">{errors.email}</span> : null}
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
        />
        {errors.password ? <span className="err">{errors.password}</span> : null}
      </div>

      <div className={styles.ageRow}>
        <div className="field">
          <label htmlFor="country">Where you live</label>
          <select
            id="country"
            name="country"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          >
            <optgroup label="Common">
              {COUNTRY_SUGGESTIONS.map((code) => (
                <option key={`top-${code}`} value={code}>
                  {countryName(code)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Everywhere">
              {countries.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.name}
                </option>
              ))}
            </optgroup>
          </select>
          {errors.country ? <span className="err">{errors.country}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="dob">Date of birth</label>
          {/*
            No `name`, on purpose: an input without one is not part of the form
            submission, so the date physically cannot be posted. Everything the
            server learns about age is in the two hidden fields below.
          */}
          <input
            id="dob"
            type="date"
            value={dob}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setDob(event.target.value)}
          />
          {errors.dob ? <span className="err">{errors.dob}</span> : null}
        </div>
      </div>

      <p className={styles.hint}>
        We work out your age band on this device and keep only that. The date itself is never sent
        to us and never stored.
      </p>

      <input type="hidden" name="age_band" value={declaration?.band ?? ''} />
      <input type="hidden" name="band_next_change_on" value={declaration?.bandNextChangeOn ?? ''} />
      <TimezoneField />

      {declined ? (
        <div className={`${styles.notice} ${styles.declined}`}>
          <strong>We cannot sign you up yet</strong>
          In the United States, an account for a rider under 13 needs a kind of parental consent we
          have not built yet — a proper checked one, not an email. We would rather say so than do it
          badly. Come back on your 13th birthday, or ask a grown-up to email
          safeguarding@landit.app.
        </div>
      ) : null}

      {needsGuardian ? (
        <div className={styles.notice}>
          <strong>A grown-up will need to say yes</strong>
          Where you live, a parent or carer has to approve accounts under {consentAge(country)} — so{' '}
          {countryName(country)} means we will ask you for their email next. You can use Land It
          while you wait: the whole trick library, your own tricks, your notes and your streak.
        </div>
      ) : null}

      {errors.form ? <p className={styles.formError}>{errors.form}</p> : null}

      <Button type="submit" wide className={styles.submit} disabled={pending || declined}>
        {pending ? 'One moment…' : 'Create account'}
      </Button>
    </form>
  );
}
