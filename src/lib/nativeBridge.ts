import type { NativeAudioAsset } from './musicFiles';

export interface NativeMusicPickerResult {
  songs: NativeAudioAsset[];
  message?: string;
  tooMany?: boolean;
  count?: number;
}

export interface NativeMusicPickerPlugin {
  pickAudioFiles: () => Promise<NativeMusicPickerResult>;
  pickAudioFolder?: () => Promise<NativeMusicPickerResult>;
  scanAudioFiles?: () => Promise<NativeMusicPickerResult>;
}

export interface NativeAudioQueueItem {
  songId: string;
  playlistId: string;
  songIndex: number;
  uri: string;
  title: string;
  playlist: string;
  duration?: number;
}

export interface NativeAudioPlayerState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  ended: boolean;
  songId?: string;
  playlistId?: string;
  songIndex?: number;
}

export interface NativePluginListenerHandle {
  remove: () => Promise<void> | void;
}

export type NativeAudioPlayerEvent = 'ended' | 'next' | 'previous' | 'play' | 'pause' | 'trackChanged';

export interface NativeAudioPlayerEventPayload {
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
  songId?: string;
  playlistId?: string;
  songIndex?: number;
}

export interface NativeAudioPlayerPlugin {
  load: (options: {
    uri: string;
    volume: number;
    title?: string;
    playlist?: string;
    songId?: string;
    playlistId?: string;
    songIndex?: number;
    queue?: NativeAudioQueueItem[];
    queueIndex?: number;
    playbackMode?: string;
  }) => Promise<{ duration: number }>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (options: { position: number }) => Promise<void>;
  setVolume: (options: { volume: number }) => Promise<void>;
  setQueue?: (options: {
    queue: NativeAudioQueueItem[];
    queueIndex: number;
    playbackMode: string;
  }) => Promise<void>;
  getState: () => Promise<NativeAudioPlayerState>;
  addListener?: (
    eventName: NativeAudioPlayerEvent,
    listener: (event?: NativeAudioPlayerEventPayload) => void,
  ) => Promise<NativePluginListenerHandle> | NativePluginListenerHandle;
  release?: () => Promise<void>;
}

type CapacitorGlobal = typeof globalThis & {
  Capacitor?: {
    Plugins?: Record<string, unknown>;
  };
};

export function getNativeMusicPicker() {
  return getPlugin<NativeMusicPickerPlugin>('LocalMusicPicker');
}

export function getNativeAudioPlayer() {
  return getPlugin<NativeAudioPlayerPlugin>('NativeAudioPlayer');
}

function getPlugin<T>(name: string): T | null {
  const plugin = (globalThis as CapacitorGlobal).Capacitor?.Plugins?.[name];
  return plugin ? (plugin as T) : null;
}
