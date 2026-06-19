import type { NativeAudioAsset } from './musicFiles';

export interface NativeMusicPickerPlugin {
  pickAudioFiles: () => Promise<{ songs: NativeAudioAsset[] }>;
}

export interface NativeAudioPlayerState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  ended: boolean;
}

export interface NativeAudioPlayerPlugin {
  load: (options: { uri: string; volume: number }) => Promise<{ duration: number }>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (options: { position: number }) => Promise<void>;
  setVolume: (options: { volume: number }) => Promise<void>;
  getState: () => Promise<NativeAudioPlayerState>;
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
