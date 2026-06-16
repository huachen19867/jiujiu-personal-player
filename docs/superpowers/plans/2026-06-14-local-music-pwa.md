# Local Music PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a phone-first local music PWA where users can select multiple local audio files or import a folder, then play and manage the generated playlist.

**Status 2026-06-15:** Implemented and verified. Current checks: `npm test -- --run`, `npm run build`, `npm audit`, and Browser mobile smoke test at `390x844`.

**Architecture:** Use Vite + React + TypeScript. Keep file import utilities, playback state, persistence, and UI components separate so each piece can be tested independently. Use the native `HTMLAudioElement` for playback and PWA assets for installability.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, vite-plugin-pwa.

---

## File Structure

- `package.json`: scripts and dependencies.
- `index.html`: app mount and PWA metadata.
- `vite.config.ts`: React, Vitest, and PWA configuration.
- `src/main.tsx`: React entry point.
- `src/App.tsx`: assembles the phone-player interface.
- `src/styles.css`: responsive phone-first styling.
- `src/types/music.ts`: shared song and playback mode types.
- `src/lib/musicFiles.ts`: audio filtering, ID generation, file-to-song conversion, directory import.
- `src/lib/playbackQueue.ts`: previous/next track selection rules.
- `src/lib/storage.ts`: serializable playlist/preferences persistence.
- `src/hooks/useMusicPlayer.ts`: playback orchestration and public controller API.
- `src/components/*.tsx`: focused UI components.
- `src/**/*.test.ts(x)`: Vitest and Testing Library tests.
- `public/manifest-icon.svg`: simple PWA icon.

## Task 1: Project Harness And Domain Types

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/test/setup.ts`
- Create: `src/types/music.ts`
- Test: `src/types/music.test.ts`

- [ ] **Step 1: Write the failing type smoke test**

```ts
import { describe, expect, it } from 'vitest';
import type { PlaybackMode, Song } from './music';

describe('music domain types', () => {
  it('accepts the supported playback modes and session song shape', () => {
    const mode: PlaybackMode = 'repeat-all';
    const song: Song = {
      id: 'song-1',
      name: 'Track One',
      type: 'audio/mpeg',
      size: 1024,
      url: 'blob:test',
      file: new File(['audio'], 'track.mp3', { type: 'audio/mpeg' }),
    };

    expect(mode).toBe('repeat-all');
    expect(song.name).toBe('Track One');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/types/music.test.ts`

Expected: FAIL because the project harness and `src/types/music.ts` do not exist yet.

- [ ] **Step 3: Create the minimal harness and types**

Create Vite, TypeScript, Vitest, Testing Library, and PWA dependencies. Define `Song`, `StoredSong`, and `PlaybackMode` exactly once in `src/types/music.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/types/music.test.ts`

Expected: PASS.

## Task 2: File Import Utilities

**Files:**
- Create: `src/lib/musicFiles.ts`
- Test: `src/lib/musicFiles.test.ts`

- [ ] **Step 1: Write failing tests for filtering and conversion**

Tests should verify that `.mp3`, `.flac`, `.wav`, `.m4a`, `.aac`, `.ogg`, and `.opus` files are accepted by MIME type or extension; non-audio files are ignored; converted songs receive stable visible names, object URLs, file references, MIME type, and size.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/musicFiles.test.ts`

Expected: FAIL because `musicFiles.ts` is missing.

- [ ] **Step 3: Implement the file utilities**

Implement `isAudioFile(file)`, `createSongFromFile(file, index)`, `createSongsFromFiles(files)`, `supportsDirectoryImport()`, and `collectAudioFilesFromDirectory(handle)`. Use `URL.createObjectURL` in one place and recurse through directory handles when supported.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/musicFiles.test.ts`

Expected: PASS.

## Task 3: Queue Rules And Persistence

**Files:**
- Create: `src/lib/playbackQueue.ts`
- Create: `src/lib/storage.ts`
- Test: `src/lib/playbackQueue.test.ts`
- Test: `src/lib/storage.test.ts`

- [ ] **Step 1: Write failing queue tests**

Tests should cover next/previous index for `sequence`, `repeat-one`, `repeat-all`, and deterministic `shuffle` using an injected random function.

- [ ] **Step 2: Write failing storage tests**

Tests should cover saving serializable song metadata and preferences, loading valid saved state, and returning a safe empty state for malformed JSON.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/lib/playbackQueue.test.ts src/lib/storage.test.ts`

Expected: FAIL because queue and storage modules are missing.

- [ ] **Step 4: Implement queue and storage**

Implement pure queue helpers and `saveLibraryState` / `loadLibraryState`. Never attempt to serialize `File` or object URL values.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/lib/playbackQueue.test.ts src/lib/storage.test.ts`

Expected: PASS.

## Task 4: Player Hook

**Files:**
- Create: `src/hooks/useMusicPlayer.ts`
- Test: `src/hooks/useMusicPlayer.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Tests should verify adding songs selects the first track, play/pause toggles the audio element, next/previous follows queue rules, removing the current song selects a sensible neighbor, and clearing the playlist pauses playback.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/hooks/useMusicPlayer.test.tsx`

Expected: FAIL because the hook is missing.

- [ ] **Step 3: Implement the hook**

Create one `Audio` instance with `useRef`, update `src` when current song changes, expose state and actions, subscribe to `timeupdate`, `loadedmetadata`, `ended`, and `error`, and clean up event listeners and object URLs.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/hooks/useMusicPlayer.test.tsx`

Expected: PASS.

## Task 5: Phone UI Components

**Files:**
- Create: `src/components/ImportActions.tsx`
- Create: `src/components/NowPlaying.tsx`
- Create: `src/components/TransportControls.tsx`
- Create: `src/components/Playlist.tsx`
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Create: `src/styles.css`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing component tests**

Tests should verify empty-state import buttons render, a selected playlist renders, play mode can be changed, removing a track updates the list, and unsupported directory import shows the multi-select fallback message.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because UI components are missing.

- [ ] **Step 3: Implement components and styling**

Build a phone-first shell with fixed safe-area padding, large touch targets, non-overlapping controls, and no landing-page hero. Use buttons with icons or compact symbols for transport controls and readable text for import commands.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

## Task 6: PWA Assets And Browser Verification

**Files:**
- Create: `public/manifest-icon.svg`
- Modify: `vite.config.ts`
- Modify: `README.md`
- Modify: `docs/tech-log/2026-06-14.md`

- [ ] **Step 1: Write or update PWA config**

Configure `vite-plugin-pwa` with app name `99新自用唱机`, display `standalone`, theme color, cache strategy, and icon reference.

- [ ] **Step 2: Run the full test suite**

Run: `npm test -- --run`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS with generated `dist`.

- [ ] **Step 4: Start the local dev server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a local URL.

- [ ] **Step 5: Verify in browser**

Open the local URL at a mobile viewport around 390x844. Check that the page is visible, no controls overlap, import buttons are accessible, the playlist area scrolls, and the app remains usable with an empty playlist.

- [ ] **Step 6: Update the technical log**

Record the reusable decisions: PWA first, directory import as progressive enhancement, object URL cleanup, metadata-only persistence, and test/build commands.
