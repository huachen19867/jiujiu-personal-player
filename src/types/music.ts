export type PlaybackMode = 'sequence' | 'repeat-one' | 'repeat-all' | 'shuffle';
export type SongSource = 'web-file' | 'android-native';

export interface Song {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  file?: File;
  source?: SongSource;
  nativeUri?: string;
  artist?: string;
  album?: string;
  duration?: number;
}

export interface StoredSong {
  id: string;
  name: string;
  type: string;
  size: number;
  source?: SongSource;
  nativeUri?: string;
  artist?: string;
  album?: string;
  duration?: number;
}

export interface PlaylistGroup {
  id: string;
  name: string;
  songs: Song[];
}

export interface StoredPlaylistGroup {
  id: string;
  name: string;
  songs: StoredSong[];
}

export interface LibraryState {
  playlists: StoredPlaylistGroup[];
  activePlaylistId: string;
  currentSongId: string | null;
  selectedPlaybackPlaylistIds: string[];
  playbackMode: PlaybackMode;
  volume: number;
}
