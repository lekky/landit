<!-- Title: t{n}-{slug} for plan tasks, or fix-/chore-/docs- prefix, matching the branch. -->

<!-- The five sections below are the TPO brief that opened the session (CLAUDE.md step 1),
     carried through to here. Its sixth section — "anything you still need to answer" — is
     deliberately absent: those are answered before the work starts, so a PR listing them
     would be a PR that should not exist yet. -->

## What you asked for

<!-- the owner's request, repeated back in their own words -->

## Why we're doing it

- <!-- the benefit, not the mechanism -->

## Analytics events

<!-- The ANALYTICS_EVENTS entries this adds or touches (apps/web/src/lib/analytics.ts),
     or one line saying why none: staff-only, a refactor nobody sees, already counted.
     There is no autocapture, on purpose — an uninstrumented screen is an invisible one.
     Properties carry catalogue facts, never rider facts and never anything a rider typed. -->

## Risks

<!-- anything slower, larger, newly depended on or newly someone else's to run;
     anything touching the four security guarantees or the child-safety position;
     any collision with work already in flight -->

## Explicitly out of scope

<!-- what this deliberately does NOT do, named — adjacent things the ask could be read
     to include, tempting fixes noticed on the way past, the larger version of the idea -->

## Detail

<!-- implementation notes: approach, plan sections amended (if any) -->

## Gates

<!-- pnpm build / test / lint results, judged on exit codes;
     screenshots checked against: <numbers> -->
