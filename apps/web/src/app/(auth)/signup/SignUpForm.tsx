'use client';

import {
  CONTACT,
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
import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';

import { TimezoneField } from '@/components/TimezoneField';
import { AUTH_COPY } from '@/lib/authRefusal';
import { ROUTES } from '@/lib/routes';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { signUpAction, type AuthFormState } from '../actions';
import styles from '../auth.module.css';
import { useFieldErrors, useRefusalCapture } from '../useAuthForm';

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
 *
 * **What the rider typed survives a refusal** (issue #370). React 19 resets a
 * `<form action>` once the action settles, which empties every uncontrolled
 * field — so a taken email used to hand back five blank fields and nothing to
 * say which one was wrong. The name, the email and the grown-up's email are
 * held in state here and survive it, as the country and the date of birth
 * always did. **The password is deliberately left uncontrolled**, so a refusal
 * clears it: it is never held in React state, and nothing sends it back from
 * the server.
 */
export type SignUpFormProps = {
  /**
   * The address typed into the landing page's hero field, handed over in a
   * short-lived httpOnly cookie rather than a query string
   * (`app/landingActions.ts`). Empty for anyone who arrived any other way.
   *
   * The email field's starting value, not a fixed one: the rider can type over
   * it like anything else here.
   */
  defaultEmail?: string;
};

export function SignUpForm({ defaultEmail = '' }: SignUpFormProps) {
  const [state, action, pending] = useActionState<AuthFormState | undefined, FormData>(
    signUpAction,
    undefined,
  );
  const { errorFor, edited } = useFieldErrors(state);

  useRefusalCapture('signup', state, ANALYTICS_EVENTS.signedUp);

  const [name, setName] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [guardianEmail, setGuardianEmail] = useState('');
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

  const nameError = errorFor('name');
  const emailError = errorFor('email');
  const passwordError = errorFor('password');
  const countryError = errorFor('country');
  const dobError = errorFor('dob');
  const guardianError = errorFor('guardian_email');

  return (
    <form
      action={action}
      onSubmit={() => capture(ANALYTICS_EVENTS.signedUp, { outcome: 'attempted' })}
      className={styles.form}
    >
      <div className="field">
        <label htmlFor="name">Your name</label>
        {/* The prototype put "Miles" here — a real rider's name, and the one on
            the story page's byline. An example name reads as a suggestion, and
            suggesting a specific child's name to every rider signing up is not
            what this field is for. It says what to type instead, which is also
            the answer to the question the field actually raises: the refusal
            below is "Tell us what to call you", so a nickname is fine. Don't
            restore the prototype's value in the name of fidelity. */}
        <input
          id="name"
          name="name"
          placeholder="First name or nickname"
          autoComplete="given-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            edited('name');
          }}
        />
        {nameError ? <span className="err">{nameError}</span> : null}
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            edited('email');
          }}
        />
        {emailError ? (
          <span className="err">
            {emailError}
            {/* The one refusal with somewhere better to be. No address in the
                link: an email in a query string is an email in the history. */}
            {state?.refused === 'email_taken' ? (
              <>
                {' '}
                <Link href={ROUTES.signIn} className={styles.errLink}>
                  {AUTH_COPY.signInInstead}
                </Link>
              </>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          onChange={() => edited('password')}
        />
        {passwordError ? <span className="err">{passwordError}</span> : null}
      </div>

      <div className={styles.ageRow}>
        <div className="field">
          <label htmlFor="country">Where you live</label>
          <select
            id="country"
            name="country"
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              edited('country');
            }}
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
          {countryError ? <span className="err">{countryError}</span> : null}
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
            onChange={(event) => {
              setDob(event.target.value);
              edited('dob');
            }}
          />
          {dobError ? <span className="err">{dobError}</span> : null}
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
          badly. Come back on your 13th birthday, or ask a grown-up to email {CONTACT.safeguarding}.
        </div>
      ) : null}

      {needsGuardian ? (
        <>
          <div className={styles.notice}>
            <strong>A grown-up will need to say yes</strong>
            Where you live, a parent or carer has to approve accounts under {consentAge(country)} —
            so {countryName(country)} means we need to ask one. You can use Land The Trick while you
            wait: the whole trick library, your own tricks, your notes and your streak.
          </div>

          <div className="field">
            <label htmlFor="guardian_email">A grown-up’s email</label>
            <input
              id="guardian_email"
              name="guardian_email"
              type="email"
              placeholder="them@example.com"
              autoComplete="off"
              value={guardianEmail}
              onChange={(event) => {
                setGuardianEmail(event.target.value);
                edited('guardian_email');
              }}
            />
            <span className={styles.hint}>
              We will email them one question and nothing else. Do not know it now? Leave it blank —
              your account still gets made, and you can send it from your account page whenever you
              like.
            </span>
            {guardianError ? <span className="err">{guardianError}</span> : null}
          </div>
        </>
      ) : null}

      {state?.errors?.form ? <p className={styles.formError}>{state.errors.form}</p> : null}

      <Button type="submit" wide className={styles.submit} disabled={pending || declined}>
        {pending ? 'One moment…' : 'Create account'}
      </Button>
    </form>
  );
}
