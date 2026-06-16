export type PlaybackMode = 'sequence' | 'repeat-one' | 'repeat-all' | 'shuffle';

export interface Song {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  file: File;
  artist?: string;
  album?: string;
  duration?: number;
}

export interface StoredSong {
  id: string;
  name: string;
  type: string;
  size: number;
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
