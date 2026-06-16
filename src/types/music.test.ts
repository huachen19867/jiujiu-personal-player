import { describe, expect, it } from 'vitest';
import type { PlaybackMode, Song } from './music';

describe('music domain types', () => {
  it('accepts the supported playback modes and session song shape', () => {
    const mode: PlaybackMode = 'repeat-all';
    const song: Song = {
      id: 'song-1',
      name: 'Track One',
      type: 'audio/mpeg',
      size: 1024,
      url: 'blob:test',
      file: new File(['audio'], 'track.mp3', { type: 'audio/mpeg' }),
    };

    expect(mode).toBe('repeat-all');
    expect(song.name).toBe('Track One');
  });
});
