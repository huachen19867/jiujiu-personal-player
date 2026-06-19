import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectAudioFilesFromDirectory,
  createSongFromNativeAudio,
  createSongsFromFiles,
  isAudioFile,
  supportsDirectoryImport,
} from './musicFiles';

class TestFileHandle {
  kind = 'file' as const;

  constructor(private file: File) {}

  async getFile() {
    return this.file;
  }
}

class TestDirectoryHandle {
  kind = 'directory' as const;

  constructor(private children: Array<[string, TestFileHandle | TestDirectoryHandle]>) {}

  async *entries() {
    yield* this.children;
  }
}

describe('music file utilities', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalShowDirectoryPicker = globalThis.showDirectoryPicker;

  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });
  });

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      configurable: true,
      value: originalShowDirectoryPicker,
    });
    vi.restoreAllMocks();
  });

  it('accepts common local audio files by MIME type or extension', () => {
    const mp3 = new File(['mp3'], 'voice-note.bin', { type: 'audio/mpeg' });
    const flac = new File(['flac'], 'album.FLAC', { type: '' });
    const wav = new File(['wav'], 'take.wav', { type: '' });
    const text = new File(['text'], 'notes.txt', { type: 'text/plain' });

    expect(isAudioFile(mp3)).toBe(true);
    expect(isAudioFile(flac)).toBe(true);
    expect(isAudioFile(wav)).toBe(true);
    expect(isAudioFile(text)).toBe(false);
  });

  it('creates playlist songs from selected files and skips non-audio files', () => {
    const files = [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
      new File(['text'], 'cover.txt', { type: 'text/plain' }),
      new File(['audio'], 'Side B.ogg', { type: '' }),
    ];

    const songs = createSongsFromFiles(files);

    expect(songs).toHaveLength(2);
    expect(songs[0]).toMatchObject({
      name: 'Blue Monday',
      type: 'audio/mpeg',
      size: 5,
      url: 'blob:Blue Monday.mp3',
      file: files[0],
    });
    expect(songs[0].id).toMatch(/^local-.+-blue-monday-mp3$/);
    expect(songs[1]).toMatchObject({
      name: 'Side B',
      type: 'audio/ogg',
      size: 5,
      url: 'blob:Side B.ogg',
      file: expect.objectContaining({ type: 'audio/ogg' }),
    });
    expect(songs[1].id).toMatch(/^local-.+-side-b-ogg$/);
  });

  it('normalizes Android ffmpeg MIME reports for mp3 files', () => {
    const [song] = createSongsFromFiles([
      new File(['audio'], '青花瓷.mp3', { type: 'audio/ffmpeg' }),
    ]);

    expect(song.type).toBe('audio/mpeg');
    expect(song.file?.type).toBe('audio/mpeg');
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'audio/mpeg' }));
  });

  it('creates songs from Android native picker assets', () => {
    const song = createSongFromNativeAudio(
      {
        id: 'native-1',
        name: '白嫁衣.mp3',
        type: 'audio/ffmpeg',
        size: 1024,
        uri: 'content://media/audio/1',
      },
      0,
    );

    expect(song).toMatchObject({
      id: 'native-1',
      name: '白嫁衣',
      type: 'audio/mpeg',
      size: 1024,
      url: 'content://media/audio/1',
      nativeUri: 'content://media/audio/1',
      source: 'android-native',
    });
  });

  it('generates unique song IDs across separate imports with identical filenames', () => {
    const firstImport = createSongsFromFiles([
      new File(['first'], 'Same Song.mp3', { type: 'audio/mpeg' }),
    ]);
    const secondImport = createSongsFromFiles([
      new File(['second'], 'Same Song.mp3', { type: 'audio/mpeg' }),
    ]);

    expect(firstImport[0].id).not.toBe(secondImport[0].id);
  });

  it('detects whether directory import is available', () => {
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      configurable: true,
      value: undefined,
    });
    expect(supportsDirectoryImport()).toBe(false);

    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      configurable: true,
      value: vi.fn(),
    });
    expect(supportsDirectoryImport()).toBe(true);
  });

  it('recursively collects audio files from a directory handle', async () => {
    const intro = new File(['intro'], 'Intro.m4a', { type: 'audio/mp4' });
    const notes = new File(['notes'], 'notes.md', { type: 'text/markdown' });
    const live = new File(['live'], 'Live Set.opus', { type: '' });
    const directory = new TestDirectoryHandle([
      ['Intro.m4a', new TestFileHandle(intro)],
      ['notes.md', new TestFileHandle(notes)],
      [
        'sets',
        new TestDirectoryHandle([['Live Set.opus', new TestFileHandle(live)]]),
      ],
    ]);

    const files = await collectAudioFilesFromDirectory(directory);

    expect(files).toEqual([intro, live]);
  });
});
