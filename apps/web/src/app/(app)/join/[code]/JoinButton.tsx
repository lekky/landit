'use client';

import { Button } from '@landit/ui-web';
import { useActionState } from 'react';

import { joinCrewAction, type CrewFormState } from '../../crew/actions';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import styles from './join.module.css';

/**
 * Redeem the code in the URL.
 *
 * The same action the crew screen's paste-a-code form uses, so there is exactly
 * one path into a crew in this app as well as one on the server — a second
 * implementation here would be a second place for the rules to drift out of.
 */
export function JoinButton({ code }: { code: string }) {
  const [state, join, pending] = useActionState<CrewFormState | undefined, FormData>(
    joinCrewAction,
    undefined,
  );

  return (
    <form
      onSubmit={() => capture(ANALYTICS_EVENTS.crewJoined, { outcome: 'attempted', from: 'link' })}
      action={join}
      className={styles.actions}
    >
      <input type="hidden" name="code" value={code} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Joining…' : 'Join the crew'}
      </Button>
      {state?.error ? <p className={styles.error}>{state.error}</p> : null}
    </form>
  );
}
