import { describe, expect, it } from 'vitest';

import { deleteSessionCopy } from './sessionDelete';

describe('deleteSessionCopy', () => {
  it('names the session and its day, as the design does', () => {
    const copy = deleteSessionCopy({ spotName: 'Adrenaline Alley', dateLabel: '12 Sep' });
    expect(copy.title).toBe('Delete this session?');
    expect(copy.lead).toBe('Adrenaline Alley on 12 Sep goes for good.');
    expect(copy.cancel).toBe('Keep it');
    expect(copy.confirm).toBe('Delete session');
  });

  it('says it comes off the month and the spot, and that stages stay', () => {
    const copy = deleteSessionCopy({ spotName: 'Kerb', dateLabel: '9 Sep' });
    expect(copy.body).toBe('It comes off your month and off the spot.');
    expect(copy.keeps).toBe('Tricks you moved up stay where they are');
    // A later edit must not drop the promise the plan makes: a stage is one-way.
    expect(`${copy.keeps}${copy.keepsTail}`).toMatch(/not undone/);
  });

  it('still reads when the spot has gone or the date is missing', () => {
    expect(deleteSessionCopy({ spotName: '  ', dateLabel: '' }).lead).toBe(
      'This session goes for good.',
    );
  });
});
