import { beforeEach, describe, expect, it } from 'vitest';
import type { Song } from '../types/music';
import { DEFAULT_LIBRARY_STATE, loadLibraryState, saveLibraryState } from './storage';

function makeSong(overrides: Partial<Song> = {}): Song {
  const file = new File(['audio'], overrides.name ?? 'Track.mp3', { type: 'audio/mpeg' });
  return {
    id: 'song-1',
    name: 'Track',
    type: 'audio/mpeg',
    size: file.size,
    url: 'blob:track',
    file,
    ...overrides,
  };
}

describe('library storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves serializable song metadata and playback preferences', () => {
    saveLibraryState({
      songs: [makeSong({ duration: 182 })],
      currentSongId: 'song-1',
      playbackMode: 'shuffle',
      volume: 0.42,
    });

    const raw = localStorage.getItem('jiujiu-personal-player-library-v1');

    expect(raw).toContain('"name":"Track"');
    expect(raw).toContain('"playbackMode":"shuffle"');
    expect(raw).not.toContain('blob:track');
  });

  it('loads a valid saved state', () => {
    localStorage.setItem(
      'jiujiu-personal-player-library-v1',
      JSON.stringify({
        songs: [{ id: 'song-1', name: 'Track', type: 'audio/mpeg', size: 5 }],
        currentSongId: 'song-1',
        playbackMode: 'repeat-all',
        volume: 0.8,
      }),
    );

    expect(loadLibraryState()).toEqual({
      songs: [{ id: 'song-1', name: 'Track', type: 'audio/mpeg', size: 5 }],
      currentSongId: 'song-1',
      playbackMode: 'repeat-all',
      volume: 0.8,
    });
  });

  it('returns a safe default state for malformed storage', () => {
    localStorage.setItem('jiujiu-personal-player-library-v1', '{bad json');

    expect(loadLibraryState()).toEqual(DEFAULT_LIBRARY_STATE);
  });
});
