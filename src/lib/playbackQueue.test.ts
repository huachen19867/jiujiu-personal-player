import { describe, expect, it } from 'vitest';
import { getNextIndex, getPreviousIndex } from './playbackQueue';

describe('playback queue rules', () => {
  it('moves through a sequence without wrapping', () => {
    expect(getNextIndex(0, 3, 'sequence')).toBe(1);
    expect(getNextIndex(2, 3, 'sequence')).toBeNull();
    expect(getPreviousIndex(2, 3, 'sequence')).toBe(1);
    expect(getPreviousIndex(0, 3, 'sequence')).toBeNull();
  });

  it('keeps the current song for repeat-one mode', () => {
    expect(getNextIndex(1, 3, 'repeat-one')).toBe(1);
    expect(getPreviousIndex(1, 3, 'repeat-one')).toBe(1);
  });

  it('wraps at the edges for repeat-all mode', () => {
    expect(getNextIndex(2, 3, 'repeat-all')).toBe(0);
    expect(getPreviousIndex(0, 3, 'repeat-all')).toBe(2);
  });

  it('picks a different song for shuffle when possible', () => {
    expect(getNextIndex(1, 4, 'shuffle', () => 0)).toBe(0);
    expect(getNextIndex(1, 4, 'shuffle', () => 0.7)).toBe(3);
    expect(getPreviousIndex(2, 4, 'shuffle', () => 0.4)).toBe(1);
  });

  it('returns null when the queue is empty', () => {
    expect(getNextIndex(0, 0, 'repeat-all')).toBeNull();
    expect(getPreviousIndex(0, 0, 'shuffle')).toBeNull();
  });
});
