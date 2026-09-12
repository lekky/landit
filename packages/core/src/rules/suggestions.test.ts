import { describe, expect, it } from 'vitest';

import {
  SUGGESTION_DETAIL_MAX,
  SUGGESTION_MAX_OPEN,
  SUGGESTION_MAX_PER_WINDOW,
  SUGGESTION_TOPICS,
  SUGGESTION_WINDOW_MINUTES,
  isSuggestionTopic,
  suggestionProblems,
  suggestionTopicLabel,
} from './suggestions';
import { REPORT_DETAIL_MAX, REPORT_MAX_PER_WINDOW } from './reports';

describe('what a suggestion has to say', () => {
  const good = { topic: 'trick', detail: 'The Bri Flip is not in the scooter library.' };

  it('accepts a complete one', () => {
    expect(suggestionProblems(good)).toEqual([]);
  });

  it('refuses one that says nothing', () => {
    expect(suggestionProblems({ ...good, detail: '   ' })).toHaveLength(1);
    expect(
      suggestionProblems({ ...good, detail: 'x'.repeat(SUGGESTION_DETAIL_MAX + 1) }),
    ).toHaveLength(1);
  });

  it('refuses a topic that is not one of ours', () => {
    expect(suggestionProblems({ ...good, topic: 'vibes' })).toHaveLength(1);
    expect(isSuggestionTopic('bug')).toBe(true);
    expect(isSuggestionTopic('spot')).toBe(false);
    expect(isSuggestionTopic('')).toBe(false);
  });

  it('names every problem at once, so a form does not play twenty questions', () => {
    expect(suggestionProblems({ topic: '', detail: '' })).toHaveLength(2);
  });

  it('asks for no email, because this route is riders only', () => {
    // The report form takes an address from a signed-out reporter because the
    // OSA duty says it must work signed out. This one does not work signed out,
    // so there is no address to ask for and no shape here that could carry one.
    expect(Object.keys(good)).toEqual(['topic', 'detail']);
    expect(suggestionProblems(good)).toEqual([]);
  });
});

describe('the stored values and the words on screen are not the same thing', () => {
  it('reads a topic back as something a rider would say', () => {
    expect(suggestionTopicLabel('trick')).toBe('A trick we’re missing');
    expect(suggestionTopicLabel('nonsense')).toBe('Something else');
  });

  it('covers every value the collection allows', () => {
    // This list is the `suggestions.topic` select in
    // `pocketbase/migrations/1789257600_suggestions.js` and the hook's own
    // `TOPICS`. A value in the schema with no label here is a radio button
    // nobody can pick.
    expect(SUGGESTION_TOPICS.map((t) => t.id)).toEqual([
      'trick',
      'feature',
      'event',
      'bug',
      'other',
    ]);
  });

  it('has no spot topic, because AddSpotForm already takes those', () => {
    // Not a style rule: a second route for spot suggestions would write them
    // somewhere the staff spot queue does not look. See the doc comment.
    expect(isSuggestionTopic('spot')).toBe(false);
  });
});

describe('a suggestion never spends the safeguarding budget', () => {
  /*
   * The reason this file exists at all, asserted rather than only written down.
   *
   * If suggestions ever shared `reports`' collection they would share its rate
   * limit, and a rider who sent their hourly allowance of ideas could not then
   * file a report. These constants being separate is what stops that, so a
   * future edit that "tidies" them into one place fails here first.
   */
  it('keeps its own limits, smaller than the report route it must not crowd', () => {
    expect(SUGGESTION_MAX_PER_WINDOW).toBeLessThan(REPORT_MAX_PER_WINDOW);
    expect(SUGGESTION_DETAIL_MAX).toBeLessThan(REPORT_DETAIL_MAX);
    expect(SUGGESTION_WINDOW_MINUTES).toBeGreaterThan(0);
    expect(SUGGESTION_MAX_OPEN).toBeGreaterThan(SUGGESTION_MAX_PER_WINDOW);
  });
});
