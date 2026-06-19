import type { Song } from '../types/music';

const AUDIO_EXTENSIONS = new Set(['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'opus']);
const EXTENSION_MIME_TYPES = new Map([
  ['mp3', 'audio/mpeg'],
  ['flac', 'audio/flac'],
  ['wav', 'audio/wav'],
  ['m4a', 'audio/mp4'],
  ['aac', 'audio/aac'],
  ['ogg', 'audio/ogg'],
  ['opus', 'audio/ogg'],
]);
let fallbackIdSequence = 0;

export interface NativeAudioAsset {
  id?: string;
  name: string;
  type?: string;
  size: number;
  uri: string;
  duration?: number;
}

export function isAudioFile(file: File) {
  if (file.type.startsWith('audio/')) {
    return true;
  }

  const extension = getExtension(file.name);
  return AUDIO_EXTENSIONS.has(extension);
}

export function createSongFromFile(file: File, index = 0): Song {
  const playableFile = normalizeAudioFile(file);

  return {
    id: createSongId(playableFile.name, index),
    name: stripExtension(playableFile.name),
    type: playableFile.type,
    size: playableFile.size,
    url: URL.createObjectURL(playableFile),
    file: playableFile,
    source: 'web-file',
  };
}

export function createSongsFromFiles(files: Iterable<File>) {
  return Array.from(files)
    .map((file, index) => ({ file, index }))
    .filter(({ file }) => isAudioFile(file))
    .map(({ file, index }) => createSongFromFile(file, index));
}

export function createSongFromNativeAudio(asset: NativeAudioAsset, index = 0): Song {
  const type = normalizeMimeType(asset.name, asset.type ?? '');

  return {
    id: asset.id ?? createSongId(asset.name, index),
    name: stripExtension(asset.name),
    type,
    size: asset.size,
    url: asset.uri,
    nativeUri: asset.uri,
    source: 'android-native',
    duration: asset.duration,
  };
}

function getExtension(name: string) {
  const extension = name.split('.').pop();
  return extension ? extension.toLowerCase() : '';
}

function normalizeAudioFile(file: File) {
  const type = normalizeMimeType(file.name, file.type);

  if (type === file.type) {
    return file;
  }

  return new File([file], file.name, {
    type,
    lastModified: file.lastModified,
  });
}

function normalizeMimeType(name: string, type: string) {
  const extensionType = EXTENSION_MIME_TYPES.get(getExtension(name));
  if (!extensionType) {
    return type;
  }

  if (!type || type === 'audio/ffmpeg' || type === 'application/octet-stream') {
    return extensionType;
  }

  return type;
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, '');
}

function createSongId(fileName: string, index: number) {
  const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${fallbackIdSequence++}-${index}`;
  return `local-${token}-${slugify(fileName) || 'track'}`;
}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
