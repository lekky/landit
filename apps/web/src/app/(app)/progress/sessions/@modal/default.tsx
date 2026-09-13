/**
 * The `@modal` slot when no intercepted route matches it: nothing.
 *
 * Without this file a hard load of any sessions URL the slot has no page for —
 * the list itself, one session — would render a 404 for the slot (Next's
 * parallel-routes rule), so it has to exist before T38 adds anything to the
 * slot.
 */
export default function SessionsModalDefault() {
  return null;
}
