import type { LibraryState, PlaybackMode, Song, StoredSong } from '../types/music';
import { APP_BRAND } from '../config/brand';

export const LIBRARY_STORAGE_KEY = APP_BRAND.storageKey;

export const DEFAULT_LIBRARY_STATE: LibraryState = {
  songs: [],
  currentSongId: null,
  playbackMode: 'sequence',
  volume: 0.85,
};

type SaveableLibraryState = Omit<LibraryState, 'songs'> & {
  songs: Array<Song | StoredSong>;
};

const PLAYBACK_MODES = new Set<PlaybackMode>(['sequence', 'repeat-one', 'repeat-all', 'shuffle']);

export function saveLibraryState(state: SaveableLibraryState) {
  const serializableState: LibraryState = {
    songs: state.songs.map(toStoredSong),
    currentSongId: state.currentSongId,
    playbackMode: state.playbackMode,
    volume: state.volume,
  };

  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(serializableState));
}

export function loadLibraryState(): LibraryState {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_LIBRARY_STATE, songs: [] };
    }

    const parsed = JSON.parse(raw) as unknown;
    return isLibraryState(parsed) ? parsed : { ...DEFAULT_LIBRARY_STATE, songs: [] };
  } catch {
    return { ...DEFAULT_LIBRARY_STATE, songs: [] };
  }
}

function toStoredSong(song: Song | StoredSong): StoredSong {
  return {
    id: song.id,
    name: song.name,
    type: song.type,
    size: song.size,
    source: song.source,
    nativeUri: song.nativeUri,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
  };
}

function isLibraryState(value: unknown): value is LibraryState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as LibraryState;
  return (
    Array.isArray(candidate.songs) &&
    candidate.songs.every(isStoredSong) &&
    (typeof candidate.currentSongId === 'string' || candidate.currentSongId === null) &&
    PLAYBACK_MODES.has(candidate.playbackMode) &&
    typeof candidate.volume === 'number' &&
    candidate.volume >= 0 &&
    candidate.volume <= 1
  );
}

function isStoredSong(value: unknown): value is StoredSong {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as StoredSong;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.size === 'number' &&
    (candidate.source === undefined || candidate.source === 'web-file' || candidate.source === 'android-native') &&
    (candidate.nativeUri === undefined || typeof candidate.nativeUri === 'string')
  );
}
