import type { LibraryState, PlaybackMode, Song, StoredPlaylistGroup, StoredSong } from '../types/music';
import { APP_BRAND } from '../config/brand';

export const LIBRARY_STORAGE_KEY = APP_BRAND.storageKey;
export const DEFAULT_PLAYLIST_ID = 'playlist-1';
export const DEFAULT_PLAYLIST_NAME = '歌单一';

export const DEFAULT_LIBRARY_STATE: LibraryState = {
  playlists: [{ id: DEFAULT_PLAYLIST_ID, name: DEFAULT_PLAYLIST_NAME, songs: [] }],
  activePlaylistId: DEFAULT_PLAYLIST_ID,
  currentSongId: null,
  playbackMode: 'sequence',
  volume: 0.85,
};

type SaveableLibraryState = Omit<LibraryState, 'playlists'> & {
  playlists: Array<Omit<StoredPlaylistGroup, 'songs'> & { songs: Array<Song | StoredSong> }>;
};

const PLAYBACK_MODES = new Set<PlaybackMode>(['sequence', 'repeat-one', 'repeat-all', 'shuffle']);

export function saveLibraryState(state: SaveableLibraryState) {
  const serializableState: LibraryState = {
    playlists: normalizeStoredPlaylists(
      state.playlists.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        songs: playlist.songs.map(toStoredSong),
      })),
    ),
    activePlaylistId: state.activePlaylistId,
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
      return DEFAULT_LIBRARY_STATE;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (isLibraryState(parsed)) {
      return {
        ...parsed,
        playlists: normalizeStoredPlaylists(parsed.playlists),
        activePlaylistId: parsed.playlists.some((playlist) => playlist.id === parsed.activePlaylistId)
          ? parsed.activePlaylistId
          : DEFAULT_PLAYLIST_ID,
      };
    }

    if (isLegacyLibraryState(parsed)) {
      return {
        playlists: normalizeStoredPlaylists([
          {
            id: DEFAULT_PLAYLIST_ID,
            name: DEFAULT_PLAYLIST_NAME,
            songs: parsed.songs,
          },
        ]),
        activePlaylistId: DEFAULT_PLAYLIST_ID,
        currentSongId: parsed.currentSongId,
        playbackMode: parsed.playbackMode,
        volume: parsed.volume,
      };
    }

    return DEFAULT_LIBRARY_STATE;
  } catch {
    return DEFAULT_LIBRARY_STATE;
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
    Array.isArray(candidate.playlists) &&
    candidate.playlists.every(isStoredPlaylistGroup) &&
    typeof candidate.activePlaylistId === 'string' &&
    (typeof candidate.currentSongId === 'string' || candidate.currentSongId === null) &&
    PLAYBACK_MODES.has(candidate.playbackMode) &&
    typeof candidate.volume === 'number' &&
    candidate.volume >= 0 &&
    candidate.volume <= 1
  );
}

function isLegacyLibraryState(value: unknown): value is Omit<LibraryState, 'playlists' | 'activePlaylistId'> & {
  songs: StoredSong[];
} {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { songs?: unknown; currentSongId?: unknown; playbackMode?: unknown; volume?: unknown };
  return (
    Array.isArray(candidate.songs) &&
    candidate.songs.every(isStoredSong) &&
    (typeof candidate.currentSongId === 'string' || candidate.currentSongId === null) &&
    PLAYBACK_MODES.has(candidate.playbackMode as PlaybackMode) &&
    typeof candidate.volume === 'number' &&
    candidate.volume >= 0 &&
    candidate.volume <= 1
  );
}

function isStoredPlaylistGroup(value: unknown): value is StoredPlaylistGroup {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as StoredPlaylistGroup;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.songs) &&
    candidate.songs.every(isStoredSong)
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

function normalizeStoredPlaylists(playlists: StoredPlaylistGroup[]): StoredPlaylistGroup[] {
  return playlists.length ? playlists : DEFAULT_LIBRARY_STATE.playlists;
}
