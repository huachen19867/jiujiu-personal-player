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

export interface LibraryState {
  songs: StoredSong[];
  currentSongId: string | null;
  playbackMode: PlaybackMode;
  volume: number;
}
