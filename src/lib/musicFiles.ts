import type { Song } from '../types/music';

const AUDIO_EXTENSIONS = new Set(['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'opus']);
let fallbackIdSequence = 0;

type FileHandleLike = {
  kind: 'file';
  getFile: () => Promise<File>;
};

export type DirectoryHandleLike = {
  kind: 'directory';
  entries: () => AsyncIterable<[string, FileHandleLike | DirectoryHandleLike]>;
};

export function isAudioFile(file: File) {
  if (file.type.startsWith('audio/')) {
    return true;
  }

  const extension = getExtension(file.name);
  return AUDIO_EXTENSIONS.has(extension);
}

export function createSongFromFile(file: File, index = 0): Song {
  return {
    id: createSongId(file.name, index),
    name: stripExtension(file.name),
    type: file.type,
    size: file.size,
    url: URL.createObjectURL(file),
    file,
  };
}

export function createSongsFromFiles(files: Iterable<File>) {
  return Array.from(files)
    .map((file, index) => ({ file, index }))
    .filter(({ file }) => isAudioFile(file))
    .map(({ file, index }) => createSongFromFile(file, index));
}

export function supportsDirectoryImport() {
  return typeof (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

export async function collectAudioFilesFromDirectory(handle: DirectoryHandleLike): Promise<File[]> {
  const files: File[] = [];

  for await (const [, child] of handle.entries()) {
    if (child.kind === 'file') {
      const file = await child.getFile();
      if (isAudioFile(file)) {
        files.push(file);
      }
      continue;
    }

    files.push(...(await collectAudioFilesFromDirectory(child)));
  }

  return files;
}

function getExtension(name: string) {
  const extension = name.split('.').pop();
  return extension ? extension.toLowerCase() : '';
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
