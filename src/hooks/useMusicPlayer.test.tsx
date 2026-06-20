import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Song } from '../types/music';
import { useMusicPlayer } from './useMusicPlayer';

type AudioListener = (event: Event) => void;

class FakeAudio {
  src = '';
  currentTime = 0;
  duration = 240;
  volume = 1;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  listeners = new Map<string, Set<AudioListener>>();

  addEventListener(type: string, listener: AudioListener) {
    const listeners = this.listeners.get(type) ?? new Set<AudioListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: AudioListener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string) {
    this.listeners.get(type)?.forEach((listener) => listener(new Event(type)));
  }
}

const audioInstances: FakeAudio[] = [];

function makeSong(id: string, name = id): Song {
  const file = new File(['audio'], `${name}.mp3`, { type: 'audio/mpeg' });
  return {
    id,
    name,
    type: 'audio/mpeg',
    size: file.size,
    url: `blob:${id}`,
    file,
  };
}

describe('useMusicPlayer', () => {
  beforeEach(() => {
    audioInstances.length = 0;
    vi.stubGlobal(
      'Audio',
      class extends FakeAudio {
        constructor() {
          super();
          audioInstances.push(this);
        }
      },
    );
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(globalThis, 'Capacitor', {
      configurable: true,
      value: undefined,
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('selects the first track when songs are added', () => {
    const { result } = renderHook(() => useMusicPlayer());
    const songs = [makeSong('one'), makeSong('two')];

    act(() => result.current.addSongs(songs));

    expect(result.current.songs).toHaveLength(2);
    expect(result.current.currentSong?.id).toBe('one');
    expect(audioInstances[0].src).toBe('blob:one');
  });

  it('keeps saved playlist metadata on initial mount before files are reauthorized', () => {
    localStorage.setItem(
      'jiujiu-personal-player-library-v1',
      JSON.stringify({
        songs: [{ id: 'stored', name: 'Stored Track', type: 'audio/mpeg', size: 123 }],
        currentSongId: 'stored',
        playbackMode: 'shuffle',
        volume: 0.4,
      }),
    );

    const { result } = renderHook(() => useMusicPlayer());

    expect(result.current.songs).toEqual([]);
    expect(result.current.rememberedSongCount).toBe(1);
    expect(localStorage.getItem('jiujiu-personal-player-library-v1')).toContain('Stored Track');
  });

  it('restores saved Android native songs with persisted content URIs', () => {
    localStorage.setItem(
      'jiujiu-personal-player-library-v1',
      JSON.stringify({
        songs: [
          {
            id: 'native-stored',
            name: 'Stored Native Track',
            type: 'audio/mpeg',
            size: 123,
            source: 'android-native',
            nativeUri: 'content://media/audio/native-stored',
          },
        ],
        currentSongId: 'native-stored',
        playbackMode: 'shuffle',
        volume: 0.6,
      }),
    );

    const { result } = renderHook(() => useMusicPlayer());

    expect(result.current.songs).toHaveLength(1);
    expect(result.current.songs[0]).toMatchObject({
      id: 'native-stored',
      name: 'Stored Native Track',
      url: 'content://media/audio/native-stored',
      nativeUri: 'content://media/audio/native-stored',
      source: 'android-native',
    });
    expect(result.current.currentSong?.id).toBe('native-stored');
    expect(result.current.rememberedSongCount).toBe(0);
    expect(result.current.playbackMode).toBe('shuffle');
    expect(result.current.volume).toBe(0.6);
  });

  it('toggles play and pause through the audio element', async () => {
    const { result } = renderHook(() => useMusicPlayer());
    act(() => result.current.addSongs([makeSong('one')]));

    await act(async () => {
      await result.current.togglePlay();
    });
    expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(true);

    audioInstances[0].pause.mockClear();
    act(() => result.current.togglePlay());
    expect(audioInstances[0].pause).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(false);
  });

  it('plays a playlist song when selected from a paused state', async () => {
    const { result } = renderHook(() => useMusicPlayer());
    act(() => result.current.addSongs([makeSong('one'), makeSong('two')]));

    await act(async () => {
      result.current.playSong('two');
      await Promise.resolve();
    });

    expect(result.current.currentSong?.id).toBe('two');
    expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(true);
  });

  it('uses the native audio player for Android content URI songs', async () => {
    const nativePlayer = {
      load: vi.fn().mockResolvedValue({ duration: 199 }),
      play: vi.fn().mockResolvedValue({}),
      pause: vi.fn().mockResolvedValue({}),
      seek: vi.fn().mockResolvedValue({}),
      setVolume: vi.fn().mockResolvedValue({}),
      getState: vi.fn().mockResolvedValue({ currentTime: 0, duration: 199, isPlaying: true, ended: false }),
    };
    Object.defineProperty(globalThis, 'Capacitor', {
      configurable: true,
      value: {
        Plugins: {
          NativeAudioPlayer: nativePlayer,
        },
      },
    });
    const nativeSong: Song = {
      id: 'native-one',
      name: 'Native One',
      type: 'audio/mpeg',
      size: 1024,
      url: 'content://media/audio/1',
      nativeUri: 'content://media/audio/1',
      source: 'android-native',
    };
    const { result } = renderHook(() => useMusicPlayer());

    act(() => result.current.addSongs([nativeSong]));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.togglePlay();
    });

    expect(nativePlayer.load).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: 'content://media/audio/1',
        volume: 0.85,
        title: 'Native One',
      }),
    );
    expect(nativePlayer.play).toHaveBeenCalled();
    expect(audioInstances[0].play).not.toHaveBeenCalled();
    expect(result.current.duration).toBe(199);
    expect(result.current.isPlaying).toBe(true);
  });

  it('continues to the next native track when Android playback completes', async () => {
    let endedListener: (() => void) | null = null;
    const nativePlayer = {
      load: vi.fn().mockResolvedValue({ duration: 199 }),
      play: vi.fn().mockResolvedValue({}),
      pause: vi.fn().mockResolvedValue({}),
      seek: vi.fn().mockResolvedValue({}),
      setVolume: vi.fn().mockResolvedValue({}),
      getState: vi.fn().mockResolvedValue({ currentTime: 0, duration: 199, isPlaying: true, ended: false }),
      addListener: vi.fn((eventName: string, listener: () => void) => {
        if (eventName === 'ended') {
          endedListener = listener;
        }
        return Promise.resolve({ remove: vi.fn() });
      }),
    };
    Object.defineProperty(globalThis, 'Capacitor', {
      configurable: true,
      value: {
        Plugins: {
          NativeAudioPlayer: nativePlayer,
        },
      },
    });
    const nativeSongs: Song[] = [
      {
        id: 'native-one',
        name: 'Native One',
        type: 'audio/mpeg',
        size: 1024,
        url: 'content://media/audio/1',
        nativeUri: 'content://media/audio/1',
        source: 'android-native',
      },
      {
        id: 'native-two',
        name: 'Native Two',
        type: 'audio/mpeg',
        size: 2048,
        url: 'content://media/audio/2',
        nativeUri: 'content://media/audio/2',
        source: 'android-native',
      },
    ];
    const { result } = renderHook(() => useMusicPlayer());

    act(() => result.current.addSongs(nativeSongs));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.togglePlay();
    });
    nativePlayer.load.mockClear();
    nativePlayer.play.mockClear();

    await act(async () => {
      endedListener?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.currentSong?.id).toBe('native-two');
    expect(result.current.isPlaying).toBe(true);
    expect(nativePlayer.load).toHaveBeenLastCalledWith(
      expect.objectContaining({
        uri: 'content://media/audio/2',
        volume: 0.85,
        title: 'Native Two',
      }),
    );
    expect(nativePlayer.play).toHaveBeenCalled();
  });

  it('moves next and previous according to repeat-all rules', () => {
    const { result } = renderHook(() => useMusicPlayer());
    act(() => {
      result.current.addSongs([makeSong('one'), makeSong('two')]);
      result.current.setPlaybackMode('repeat-all');
    });

    act(() => result.current.next());
    expect(result.current.currentSong?.id).toBe('two');

    act(() => result.current.next());
    expect(result.current.currentSong?.id).toBe('one');

    act(() => result.current.previous());
    expect(result.current.currentSong?.id).toBe('two');
  });

  it('continues into another selected playlist after the current playlist is unchecked', async () => {
    const { result } = renderHook(() => useMusicPlayer());

    act(() => result.current.addSongs([makeSong('one')]));
    act(() => result.current.selectPlaylist('playlist-2'));
    act(() => result.current.addSongs([makeSong('two')]));
    await act(async () => {
      await result.current.togglePlay();
    });

    act(() => result.current.togglePlaybackPlaylist('playlist-2'));
    act(() => result.current.togglePlaybackPlaylist('playlist-1'));
    act(() => audioInstances[0].dispatch('ended'));

    expect(result.current.currentPlaylistId).toBe('playlist-2');
    expect(result.current.currentSong?.id).toBe('two');
    expect(result.current.isPlaying).toBe(true);
  });

  it('continues from the end of one selected playlist into the next selected playlist', () => {
    const { result } = renderHook(() => useMusicPlayer());

    act(() => result.current.addSongs([makeSong('one')]));
    act(() => result.current.selectPlaylist('playlist-2'));
    act(() => result.current.addSongs([makeSong('two')]));
    act(() => result.current.togglePlaybackPlaylist('playlist-2'));
    act(() => audioInstances[0].dispatch('ended'));

    expect(result.current.currentPlaylistId).toBe('playlist-2');
    expect(result.current.currentSong?.id).toBe('two');
  });

  it('renames a playlist without losing its songs', () => {
    const { result } = renderHook(() => useMusicPlayer());

    act(() => result.current.addSongs([makeSong('one')]));
    act(() => result.current.renamePlaylist('playlist-1', '古风'));

    expect(result.current.playlistGroups[0].name).toBe('古风');
    expect(result.current.activePlaylistName).toBe('古风');
    expect(result.current.songs.map((song) => song.id)).toEqual(['one']);
  });

  it('selects a neighbor when the current song is removed', () => {
    const { result } = renderHook(() => useMusicPlayer());
    act(() => result.current.addSongs([makeSong('one'), makeSong('two'), makeSong('three')]));
    act(() => result.current.next());

    act(() => result.current.removeSong('two'));

    expect(result.current.songs.map((song) => song.id)).toEqual(['one', 'three']);
    expect(result.current.currentSong?.id).toBe('three');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:two');
  });

  it('removes multiple songs and keeps the next available track selected', () => {
    const { result } = renderHook(() => useMusicPlayer());
    act(() => result.current.addSongs([makeSong('one'), makeSong('two'), makeSong('three'), makeSong('four')]));
    act(() => result.current.next());

    act(() => result.current.removeSongs(['one', 'two']));

    expect(result.current.songs.map((song) => song.id)).toEqual(['three', 'four']);
    expect(result.current.currentSong?.id).toBe('three');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:one');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:two');
  });

  it('clears the playlist and pauses playback', async () => {
    const { result } = renderHook(() => useMusicPlayer());
    act(() => result.current.addSongs([makeSong('one')]));
    await act(async () => {
      await result.current.togglePlay();
    });

    act(() => result.current.clearPlaylist());

    expect(result.current.songs).toEqual([]);
    expect(result.current.currentSong).toBeNull();
    expect(result.current.isPlaying).toBe(false);
    expect(audioInstances[0].pause).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:one');
  });

  it('ignores audio errors when no song is selected', () => {
    const { result } = renderHook(() => useMusicPlayer());

    act(() => audioInstances[0].dispatch('error'));

    expect(result.current.errorMessage).toBeNull();
  });
});
