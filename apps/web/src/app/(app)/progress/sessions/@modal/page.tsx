/**
 * The `@modal` slot on `/progress/sessions` itself: nothing (T38).
 *
 * Without it, a navigation back to the list after a save or a delete matches
 * the slot's last active state and leaves the modal drawn over the list. With
 * it, landing on the list empties the slot. `default.tsx` (T37) covers the hard
 * navigations; this covers the soft one to exactly this URL.
 */
export default function SessionsModalSlot() {
  return null;
}
