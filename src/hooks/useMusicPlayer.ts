import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getNativeAudioPlayer } from '../lib/nativeBridge';
import type { NativeAudioPlayerEventPayload, NativeAudioQueueItem } from '../lib/nativeBridge';
import { getNextIndex, getPreviousIndex } from '../lib/playbackQueue';
import {
  AUTO_LOCAL_PLAYLIST_ID,
  AUTO_LOCAL_PLAYLIST_NAME,
  DEFAULT_PLAYLIST_ID,
  DEFAULT_PLAYLIST_NAME,
  loadLibraryState,
  saveLibraryState,
} from '../lib/storage';
import type { PlaybackMode, PlaylistGroup, Song, StoredPlaylistGroup, StoredSong } from '../types/music';

const MODE_ORDER: PlaybackMode[] = ['sequence', 'repeat-all', 'repeat-one', 'shuffle'];
const PLAYLIST_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

type RestoredLibrary = {
  playlists: PlaylistGroup[];
  activePlaylistId: string;
  currentPlaylistId: string;
  currentIndex: number | null;
  unrestorableSongCount: number;
};

type PlaybackQueueEntry = {
  playlistId: string;
  songIndex: number;
  song: Song;
};

export function useMusicPlayer() {
  const savedState = useMemo(() => loadLibraryState(), []);
  const restoredLibrary = useMemo(() => restoreLibrary(savedState.playlists, savedState.activePlaylistId, savedState.currentSongId), [savedState]);
  const restoredSelectedPlaybackPlaylistIds = useMemo(
    () =>
      normalizeRestoredPlaybackPlaylistIds(
        savedState.selectedPlaybackPlaylistIds,
        restoredLibrary.playlists,
        restoredLibrary.currentPlaylistId,
      ),
    [restoredLibrary.currentPlaylistId, restoredLibrary.playlists, savedState.selectedPlaybackPlaylistIds],
  );
  const nativeAudioPlayer = useMemo(() => getNativeAudioPlayer(), []);
  const [audio] = useState(() => new Audio());
  const [playlistGroups, setPlaylistGroups] = useState<PlaylistGroup[]>(restoredLibrary.playlists);
  const [activePlaylistId, setActivePlaylistId] = useState(restoredLibrary.activePlaylistId);
  const [currentPlaylistId, setCurrentPlaylistId] = useState(restoredLibrary.currentPlaylistId);
  const [selectedPlaybackPlaylistIds, setSelectedPlaybackPlaylistIds] = useState<string[]>(
    restoredSelectedPlaybackPlaylistIds,
  );
  const [currentIndex, setCurrentIndex] = useState<number | null>(restoredLibrary.currentIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(savedState.volume);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(savedState.playbackMode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const playlistGroupsRef = useRef<PlaylistGroup[]>(restoredLibrary.playlists);
  const currentSongsRef = useRef<Song[]>([]);
  const currentSongRef = useRef<Song | null>(null);
  const currentIndexRef = useRef<number | null>(restoredLibrary.currentIndex);
  const currentPlaylistIdRef = useRef(restoredLibrary.currentPlaylistId);
  const selectedPlaybackPlaylistIdsRef = useRef<string[]>(restoredSelectedPlaybackPlaylistIds);
  const playbackModeRef = useRef<PlaybackMode>(savedState.playbackMode);
  const volumeRef = useRef(savedState.volume);
  const playlistChangedInSessionRef = useRef(false);
  const playSelectedSongRef = useRef(false);
  const shuffledPlaybackQueueRef = useRef<PlaybackQueueEntry[] | null>(null);
  const nativeLoadedSongIdRef = useRef<string | null>(null);

  const activePlaylist = useMemo(
    () => playlistGroups.find((playlist) => playlist.id === activePlaylistId) ?? playlistGroups[0],
    [activePlaylistId, playlistGroups],
  );
  const currentPlaylist = useMemo(
    () => playlistGroups.find((playlist) => playlist.id === currentPlaylistId) ?? activePlaylist,
    [activePlaylist, currentPlaylistId, playlistGroups],
  );
  const songs = activePlaylist?.songs ?? [];
  const currentSongs = currentPlaylist?.songs ?? [];
  const currentSong = currentIndex === null ? null : currentSongs[currentIndex] ?? null;
  const totalSongCount = playlistGroups.reduce((sum, playlist) => sum + playlist.songs.length, 0);
  const playbackQueue = useMemo(
    () => createPlaybackQueue(playlistGroups, selectedPlaybackPlaylistIds, currentPlaylist?.id ?? DEFAULT_PLAYLIST_ID),
    [currentPlaylist?.id, playlistGroups, selectedPlaybackPlaylistIds],
  );
  const canPlay = playbackQueue.length > 0;
  const rememberedSongCount =
    totalSongCount === 0 && !playlistChangedInSessionRef.current ? restoredLibrary.unrestorableSongCount : 0;

  useEffect(() => {
    playlistGroupsRef.current = playlistGroups;
  }, [playlistGroups]);

  useEffect(() => {
    currentSongsRef.current = currentSongs;
  }, [currentSongs]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    currentPlaylistIdRef.current = currentPlaylist?.id ?? DEFAULT_PLAYLIST_ID;
  }, [currentPlaylist?.id]);

  useEffect(() => {
    selectedPlaybackPlaylistIdsRef.current = selectedPlaybackPlaylistIds;
  }, [selectedPlaybackPlaylistIds]);

  useEffect(() => {
    playbackModeRef.current = playbackMode;
  }, [playbackMode]);

  useEffect(() => {
    setSelectedPlaybackPlaylistIds((ids) => {
      const visibleIds = new Set(playlistGroups.map((playlist) => playlist.id));
      const filteredIds = ids.filter((id) => visibleIds.has(id));
      if (filteredIds.length) {
        return filteredIds;
      }
      return [currentPlaylist?.id ?? activePlaylist?.id ?? DEFAULT_PLAYLIST_ID];
    });
  }, [activePlaylist?.id, currentPlaylist?.id, playlistGroups]);

  useEffect(() => {
    volumeRef.current = volume;
    audio.volume = volume;
    if (currentSongRef.current?.nativeUri && nativeAudioPlayer) {
      void nativeAudioPlayer.setVolume({ volume });
    }
  }, [audio, nativeAudioPlayer, volume]);

  useEffect(() => {
    if (!currentSong) {
      audio.pause();
      audio.src = '';
      void nativeAudioPlayer?.pause();
      nativeLoadedSongIdRef.current = null;
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      playSelectedSongRef.current = false;
      return;
    }

    const shouldPlay = isPlaying || playSelectedSongRef.current;
    playSelectedSongRef.current = false;

    if (currentSong.nativeUri && nativeAudioPlayer) {
      audio.pause();
      audio.src = '';
      setErrorMessage(null);

      if (nativeLoadedSongIdRef.current === currentSong.id) {
        return;
      }

      setCurrentTime(0);
      setDuration(currentSong.duration ?? 0);
      const nativeQueue = createNativePlaybackQueueOptions(
        playlistGroupsRef.current,
        selectedPlaybackPlaylistIdsRef.current,
        currentPlaylistIdRef.current,
        currentSong.id,
        playbackModeRef.current,
      );

      void nativeAudioPlayer
        .load({
          uri: currentSong.nativeUri,
          volume: volumeRef.current,
          title: currentSong.name,
          playlist: currentPlaylist?.name ?? DEFAULT_PLAYLIST_NAME,
          songId: currentSong.id,
          playlistId: currentPlaylistIdRef.current,
          songIndex: currentIndexRef.current ?? 0,
          ...nativeQueue,
        })
        .then((state) => {
          nativeLoadedSongIdRef.current = currentSong.id;
          setDuration(state.duration ?? currentSong.duration ?? 0);
          if (!shouldPlay) {
            return undefined;
          }

          return nativeAudioPlayer.play().then(() => {
            setIsPlaying(true);
          });
        })
        .catch(() => {
          setIsPlaying(false);
          setErrorMessage('这首歌暂时播放不了，可能是格式或编码不受当前手机支持。');
        });
      return;
    }

    void nativeAudioPlayer?.pause();
    nativeLoadedSongIdRef.current = null;
    audio.src = currentSong.url;
    audio.currentTime = 0;
    setCurrentTime(0);
    setDuration(currentSong.duration ?? 0);
    setErrorMessage(null);

    if (shouldPlay) {
      void audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
          setErrorMessage('这首歌暂时播放不了，可能是格式或编码不受当前手机支持。');
        });
    }
  }, [audio, currentSong, currentPlaylist?.name, nativeAudioPlayer]);

  useEffect(() => {
    if (!currentSong?.nativeUri || !nativeAudioPlayer?.setQueue) {
      return;
    }

    void nativeAudioPlayer.setQueue(
      createNativePlaybackQueueOptions(
        playlistGroups,
        selectedPlaybackPlaylistIds,
        currentPlaylist?.id ?? DEFAULT_PLAYLIST_ID,
        currentSong.id,
        playbackMode,
      ),
    );
  }, [
    currentPlaylist?.id,
    currentSong?.id,
    currentSong?.nativeUri,
    nativeAudioPlayer,
    playbackMode,
    playlistGroups,
    selectedPlaybackPlaylistIds,
  ]);

  const pause = useCallback(() => {
    audio.pause();
    if (currentSongRef.current?.nativeUri && nativeAudioPlayer) {
      void nativeAudioPlayer.pause();
    }
    setIsPlaying(false);
  }, [audio, nativeAudioPlayer]);

  const getPlaybackQueueFromRefs = useCallback(
    () =>
      createPlaybackQueue(
        playlistGroupsRef.current,
        selectedPlaybackPlaylistIdsRef.current,
        currentPlaylistIdRef.current,
      ),
    [],
  );

  const createAndStoreShuffleQueue = useCallback(
    (preferredFirstSongId?: string | null) => {
      const queue = createShuffledPlaybackQueue(getPlaybackQueueFromRefs(), preferredFirstSongId);
      shuffledPlaybackQueueRef.current = queue;
      return queue;
    },
    [getPlaybackQueueFromRefs],
  );

  const getEffectivePlaybackQueueFromRefs = useCallback(() => {
    const queue = getPlaybackQueueFromRefs();
    if (playbackModeRef.current !== 'shuffle') {
      return queue;
    }

    if (shuffledPlaybackQueueRef.current && hasSameQueueSongs(shuffledPlaybackQueueRef.current, queue)) {
      return shuffledPlaybackQueueRef.current;
    }

    return createAndStoreShuffleQueue(currentSongRef.current?.id);
  }, [createAndStoreShuffleQueue, getPlaybackQueueFromRefs]);

  const moveToQueueEntry = useCallback((entry: PlaybackQueueEntry | null, shouldKeepPlaying: boolean) => {
    if (!entry) {
      setIsPlaying(false);
      return;
    }

    if (shouldKeepPlaying) {
      playSelectedSongRef.current = true;
      setIsPlaying(true);
    }
    setCurrentPlaylistId(entry.playlistId);
    setCurrentIndex(entry.songIndex);
  }, []);

  const moveByDirection = useCallback(
    (direction: 1 | -1, shouldKeepPlaying: boolean) => {
      const currentSong = currentSongRef.current;
      if (!currentSong) {
        return;
      }

      const queue = getEffectivePlaybackQueueFromRefs();
      const queueIndex = queue.findIndex((entry) => entry.song.id === currentSong.id);
      const queuePlaybackMode = playbackModeRef.current === 'shuffle' ? 'repeat-all' : playbackModeRef.current;

      if (queueIndex >= 0) {
        const nextQueueIndex =
          direction === 1
            ? getNextIndex(queueIndex, queue.length, queuePlaybackMode)
            : getPreviousIndex(queueIndex, queue.length, queuePlaybackMode);
        moveToQueueEntry(nextQueueIndex === null ? null : queue[nextQueueIndex], shouldKeepPlaying);
        return;
      }

      if (queue.length) {
        moveToQueueEntry(direction === 1 ? queue[0] : queue[queue.length - 1], shouldKeepPlaying);
        return;
      }

      const currentIndex = currentIndexRef.current;
      if (currentIndex === null) {
        return;
      }

      const songs = currentSongsRef.current;
      const nextIndex =
        direction === 1
          ? getNextIndex(currentIndex, songs.length, queuePlaybackMode)
          : getPreviousIndex(currentIndex, songs.length, queuePlaybackMode);
      moveToQueueEntry(
        nextIndex === null
          ? null
          : {
              playlistId: currentPlaylistIdRef.current,
              songIndex: nextIndex,
              song: songs[nextIndex],
            },
        shouldKeepPlaying,
      );
    },
    [getEffectivePlaybackQueueFromRefs, moveToQueueEntry],
  );

  const advanceAfterTrackEnd = useCallback(() => {
    moveByDirection(1, true);
  }, [moveByDirection]);

  const syncNativeTrackState = useCallback((state?: NativeAudioPlayerEventPayload | null) => {
    if (!state?.songId) {
      return false;
    }

    const playlists = playlistGroupsRef.current;
    let playlistId = state.playlistId;
    let songIndex = typeof state.songIndex === 'number' ? state.songIndex : -1;
    let playlist = playlistId ? playlists.find((group) => group.id === playlistId) : undefined;

    if (!playlist || !playlist.songs[songIndex] || playlist.songs[songIndex].id !== state.songId) {
      const foundPlaylist = playlists.find((group) => group.songs.some((song) => song.id === state.songId));
      if (!foundPlaylist) {
        return false;
      }
      playlist = foundPlaylist;
      playlistId = foundPlaylist.id;
      songIndex = foundPlaylist.songs.findIndex((song) => song.id === state.songId);
    }

    if (!playlistId || songIndex < 0) {
      return false;
    }

    nativeLoadedSongIdRef.current = state.songId;
    setCurrentPlaylistId(playlistId);
    setCurrentIndex(songIndex);
    setErrorMessage(null);

    if (typeof state.currentTime === 'number' && Number.isFinite(state.currentTime)) {
      setCurrentTime(state.currentTime);
    }
    if (typeof state.duration === 'number' && Number.isFinite(state.duration)) {
      setDuration(state.duration);
    }
    if (typeof state.isPlaying === 'boolean') {
      setIsPlaying(state.isPlaying);
    }

    return true;
  }, []);

  const next = useCallback(() => {
    moveByDirection(1, isPlaying);
  }, [isPlaying, moveByDirection]);

  const previous = useCallback(() => {
    moveByDirection(-1, isPlaying);
  }, [isPlaying, moveByDirection]);

  useEffect(() => {
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleEnded = () => advanceAfterTrackEnd();
    const handleError = () => {
      if (!currentSongRef.current) {
        return;
      }
      setIsPlaying(false);
      setErrorMessage('这首歌暂时播放不了。');
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [advanceAfterTrackEnd, audio]);

  useEffect(() => {
    const shouldKeepUnrestorableSavedState =
      !playlistChangedInSessionRef.current && totalSongCount === 0 && restoredLibrary.unrestorableSongCount > 0;

    saveLibraryState({
      playlists: shouldKeepUnrestorableSavedState ? savedState.playlists : playlistGroups,
      activePlaylistId: shouldKeepUnrestorableSavedState ? savedState.activePlaylistId : activePlaylistId,
      currentSongId: shouldKeepUnrestorableSavedState ? savedState.currentSongId : currentSong?.id ?? null,
      selectedPlaybackPlaylistIds: shouldKeepUnrestorableSavedState
        ? savedState.selectedPlaybackPlaylistIds
        : selectedPlaybackPlaylistIds,
      playbackMode,
      volume,
    });
  }, [
    activePlaylistId,
    currentSong?.id,
    playbackMode,
    playlistGroups,
    restoredLibrary.unrestorableSongCount,
    savedState.activePlaylistId,
    savedState.currentSongId,
    savedState.playlists,
    savedState.selectedPlaybackPlaylistIds,
    selectedPlaybackPlaylistIds,
    totalSongCount,
    volume,
  ]);

  useEffect(() => {
    if (!currentSong?.nativeUri || !nativeAudioPlayer) {
      return;
    }

    let canceled = false;
    const syncNativeState = async () => {
      try {
        const state = await nativeAudioPlayer.getState();
        if (canceled) {
          return;
        }

        const trackChanged = syncNativeTrackState(state);
        if (!trackChanged) {
          setCurrentTime(state.currentTime);
          setDuration(state.duration);
          setIsPlaying(state.isPlaying);
        }
        if (state.ended) {
          advanceAfterTrackEnd();
        }
      } catch {
        if (!canceled) {
          setErrorMessage('这首歌暂时播放不了，可能是格式或编码不受当前手机支持。');
        }
      }
    };

    void syncNativeState();
    const timer = window.setInterval(syncNativeState, 1000);
    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, [advanceAfterTrackEnd, currentSong?.nativeUri, nativeAudioPlayer, syncNativeTrackState]);

  useEffect(() => {
    if (!nativeAudioPlayer?.addListener) {
      return;
    }

    let removed = false;
    const listenerHandles: { remove: () => Promise<void> | void }[] = [];
    const registerListener = (
      eventName: 'ended' | 'next' | 'previous' | 'play' | 'pause' | 'trackChanged',
      listener: (event?: NativeAudioPlayerEventPayload) => void,
    ) => {
      void Promise.resolve(nativeAudioPlayer.addListener?.(eventName, listener)).then((handle) => {
        if (!handle) {
          return;
        }
        if (removed) {
          void handle.remove();
          return;
        }
        listenerHandles.push(handle);
      });
    };

    registerListener('ended', advanceAfterTrackEnd);
    registerListener('next', () => moveByDirection(1, true));
    registerListener('previous', () => moveByDirection(-1, true));
    registerListener('play', () => setIsPlaying(true));
    registerListener('pause', () => setIsPlaying(false));
    registerListener('trackChanged', syncNativeTrackState);

    return () => {
      removed = true;
      listenerHandles.forEach((handle) => {
        void handle.remove();
      });
    };
  }, [advanceAfterTrackEnd, moveByDirection, nativeAudioPlayer, syncNativeTrackState]);

  useEffect(() => {
    return () => {
      audio.pause();
      void nativeAudioPlayer?.release?.();
      playlistGroupsRef.current
        .flatMap((playlist) => playlist.songs)
        .filter((song) => song.source !== 'android-native')
        .forEach((song) => URL.revokeObjectURL(song.url));
    };
  }, [audio, nativeAudioPlayer]);

  const addSongs = useCallback(
    (incomingSongs: Song[]) => {
      if (incomingSongs.length === 0) {
        return;
      }

      playlistChangedInSessionRef.current = true;
      const shouldSelectFirstIncoming = !currentSong && songs.length === 0;
      setPlaylistGroups((existingGroups) =>
        ensureTrailingEmptyPlaylist(
          existingGroups.map((playlist) =>
            playlist.id === activePlaylistId
              ? { ...playlist, songs: [...playlist.songs, ...incomingSongs] }
              : playlist,
          ),
        ),
      );
      if (shouldSelectFirstIncoming) {
        setCurrentPlaylistId(activePlaylistId);
        setCurrentIndex(0);
      }
    },
    [activePlaylistId, currentSong, songs.length],
  );

  const play = useCallback(async () => {
    if (!currentSong) {
      const queue =
        playbackModeRef.current === 'shuffle' ? getEffectivePlaybackQueueFromRefs() : getPlaybackQueueFromRefs();
      moveToQueueEntry(queue[0] ?? null, true);
      return;
    }

    try {
      if (currentSong.nativeUri && nativeAudioPlayer) {
        await nativeAudioPlayer.play();
        setIsPlaying(true);
        setErrorMessage(null);
        return;
      }

      await audio.play();
      setIsPlaying(true);
      setErrorMessage(null);
    } catch {
      setIsPlaying(false);
      setErrorMessage('这首歌暂时播放不了，可能是格式或编码不受当前手机支持。');
    }
  }, [audio, currentSong, getEffectivePlaybackQueueFromRefs, getPlaybackQueueFromRefs, moveToQueueEntry, nativeAudioPlayer]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
      return;
    }

    return play();
  }, [isPlaying, pause, play]);

  const playSong = useCallback(
    (songId: string) => {
      const index = songs.findIndex((song) => song.id === songId);
      if (index >= 0) {
        if (activePlaylistId === currentPlaylistId && index === currentIndex) {
          if (!isPlaying) {
            return play();
          }
          return;
        }

        playSelectedSongRef.current = true;
        setCurrentPlaylistId(activePlaylistId);
        setCurrentIndex(index);
      }
    },
    [activePlaylistId, currentIndex, currentPlaylistId, isPlaying, play, songs],
  );

  const selectPlaylist = useCallback(
    (playlistId: string) => {
      const playlist = playlistGroups.find((group) => group.id === playlistId);
      if (!playlist || playlist.id === activePlaylistId) {
        return;
      }

      setActivePlaylistId(playlist.id);
      setErrorMessage(null);

      if (isPlaying && currentSongRef.current) {
        return;
      }

      setCurrentPlaylistId(playlist.id);
      setCurrentIndex(playlist.songs.length ? 0 : null);
      setCurrentTime(0);
      setDuration(0);
    },
    [activePlaylistId, isPlaying, playlistGroups],
  );

  const renamePlaylist = useCallback((playlistId: string, nextName: string) => {
    const trimmedName = nextName.trim();
    if (!trimmedName) {
      return;
    }

    playlistChangedInSessionRef.current = true;
    setPlaylistGroups((existingGroups) =>
      ensureTrailingEmptyPlaylist(
        existingGroups.map((playlist) => (playlist.id === playlistId ? { ...playlist, name: trimmedName } : playlist)),
      ),
    );
  }, []);

  const togglePlaybackPlaylist = useCallback((playlistId: string) => {
    setSelectedPlaybackPlaylistIds((ids) => {
      if (ids.includes(playlistId)) {
        return ids.length > 1 ? ids.filter((id) => id !== playlistId) : ids;
      }
      return [...ids, playlistId];
    });
  }, []);

  const seek = useCallback(
    (time: number) => {
      const safeTime = Math.max(0, Math.min(time, duration || time));
      if (currentSongRef.current?.nativeUri && nativeAudioPlayer) {
        void nativeAudioPlayer.seek({ position: safeTime });
      } else {
        audio.currentTime = safeTime;
      }
      setCurrentTime(safeTime);
    },
    [audio, duration, nativeAudioPlayer],
  );

  const setVolumeLevel = useCallback((nextVolume: number) => {
    setVolume(Math.max(0, Math.min(1, nextVolume)));
  }, []);

  const cycleMode = useCallback(() => {
    const nextMode = MODE_ORDER[(MODE_ORDER.indexOf(playbackModeRef.current) + 1) % MODE_ORDER.length];
    playbackModeRef.current = nextMode;

    if (nextMode === 'shuffle') {
      const queue = createAndStoreShuffleQueue(isPlaying ? currentSongRef.current?.id : null);
      if ((!isPlaying || !currentSongRef.current) && queue.length) {
        moveToQueueEntry(queue[0], false);
      }
    } else {
      shuffledPlaybackQueueRef.current = null;
    }

    setPlaybackMode(nextMode);
  }, [createAndStoreShuffleQueue, isPlaying, moveToQueueEntry]);

  const removeSongs = useCallback(
    (songIds: string[]) => {
      const idsToRemove = new Set(songIds);
      const removedSongs = songs.filter((song) => idsToRemove.has(song.id));
      if (!removedSongs.length) {
        return;
      }

      playlistChangedInSessionRef.current = true;
      removedSongs
        .filter((song) => song.source !== 'android-native')
        .forEach((song) => URL.revokeObjectURL(song.url));
      const nextSongs = songs.filter((song) => !idsToRemove.has(song.id));
      setPlaylistGroups((existingGroups) =>
        ensureTrailingEmptyPlaylist(
          existingGroups.map((playlist) =>
            playlist.id === activePlaylistId ? { ...playlist, songs: nextSongs } : playlist,
          ),
        ),
      );

      if (nextSongs.length === 0) {
        if (currentPlaylistId === activePlaylistId) {
          setCurrentIndex(null);
          pause();
        }
        return;
      }

      if (currentPlaylistId !== activePlaylistId) {
        return;
      }

      if (currentIndex === null) {
        return;
      }

      const currentSongId = songs[currentIndex]?.id;
      if (currentSongId && !idsToRemove.has(currentSongId)) {
        setCurrentIndex(nextSongs.findIndex((song) => song.id === currentSongId));
        return;
      }

      const replacement =
        songs.slice(currentIndex + 1).find((song) => !idsToRemove.has(song.id)) ??
        songs
          .slice(0, currentIndex)
          .reverse()
          .find((song) => !idsToRemove.has(song.id));

      setCurrentIndex(replacement ? nextSongs.findIndex((song) => song.id === replacement.id) : null);
    },
    [activePlaylistId, currentIndex, currentPlaylistId, pause, songs],
  );

  const removeSong = useCallback(
    (songId: string) => {
      removeSongs([songId]);
    },
    [removeSongs],
  );

  const clearPlaylist = useCallback(() => {
    playlistChangedInSessionRef.current = true;
    songs
      .filter((song) => song.source !== 'android-native')
      .forEach((song) => URL.revokeObjectURL(song.url));
    setPlaylistGroups((existingGroups) =>
      ensureTrailingEmptyPlaylist(
        existingGroups.map((playlist) => (playlist.id === activePlaylistId ? { ...playlist, songs: [] } : playlist)),
      ),
    );
    if (currentPlaylistId === activePlaylistId) {
      setCurrentIndex(null);
      pause();
    }
  }, [activePlaylistId, currentPlaylistId, pause, songs]);

  return {
    songs,
    playlistGroups,
    activePlaylistId,
    activePlaylistName: activePlaylist?.name ?? DEFAULT_PLAYLIST_NAME,
    currentPlaylistId: currentPlaylist?.id ?? DEFAULT_PLAYLIST_ID,
    currentPlaylistName: currentPlaylist?.name ?? DEFAULT_PLAYLIST_NAME,
    selectedPlaybackPlaylistIds,
    activePlaylist,
    currentSong,
    currentIndex,
    totalSongCount,
    canPlay,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackMode,
    errorMessage,
    rememberedSongCount,
    addSongs,
    play,
    pause,
    togglePlay,
    playSong,
    selectPlaylist,
    renamePlaylist,
    togglePlaybackPlaylist,
    next,
    previous,
    seek,
    setVolumeLevel,
    setPlaybackMode,
    cycleMode,
    removeSong,
    removeSongs,
    clearPlaylist,
  };
}

function restoreLibrary(
  storedPlaylists: StoredPlaylistGroup[],
  storedActivePlaylistId: string,
  storedCurrentSongId: string | null,
): RestoredLibrary {
  let unrestorableSongCount = 0;
  const restoredPlaylists = storedPlaylists.map((playlist, index) => {
    const restoredSongs = playlist.songs.map(restoreStoredSong).filter((song): song is Song => Boolean(song));
    unrestorableSongCount += playlist.songs.length - restoredSongs.length;

    return {
      id: playlist.id || createPlaylistId(index),
      name: playlist.name || createPlaylistName(index),
      songs: restoredSongs,
    };
  });

  const playlists = ensureTrailingEmptyPlaylist(restoredPlaylists);
  const activePlaylist =
    playlists.find((playlist) => playlist.id === storedActivePlaylistId) ??
    playlists.find((playlist) => playlist.id === DEFAULT_PLAYLIST_ID) ??
    playlists[0];
  const playlistWithSavedSong = playlists.find((playlist) =>
    playlist.songs.some((song) => song.id === storedCurrentSongId),
  );
  const currentPlaylist = playlistWithSavedSong ?? activePlaylist;
  const savedSongIndex = currentPlaylist.songs.findIndex((song) => song.id === storedCurrentSongId);
  const currentIndex = savedSongIndex >= 0 ? savedSongIndex : currentPlaylist.songs.length ? 0 : null;

  return {
    playlists,
    activePlaylistId: activePlaylist.id,
    currentPlaylistId: currentPlaylist.id,
    currentIndex,
    unrestorableSongCount,
  };
}

function restoreStoredSong(song: StoredSong): Song | null {
  if (!song.nativeUri) {
    return null;
  }

  return {
    id: song.id,
    name: song.name,
    type: song.type,
    size: song.size,
    url: song.nativeUri,
    source: 'android-native',
    nativeUri: song.nativeUri,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
  };
}

function normalizeRestoredPlaybackPlaylistIds(
  selectedPlaybackPlaylistIds: string[],
  playlists: PlaylistGroup[],
  fallbackPlaylistId: string,
) {
  const visibleIds = new Set(playlists.map((playlist) => playlist.id));
  const filteredIds = selectedPlaybackPlaylistIds.filter((playlistId) => visibleIds.has(playlistId));
  return filteredIds.length ? Array.from(new Set(filteredIds)) : [fallbackPlaylistId];
}

function ensureTrailingEmptyPlaylist(playlists: PlaylistGroup[]): PlaylistGroup[] {
  const autoLocalPlaylist =
    playlists.find((playlist) => playlist.id === AUTO_LOCAL_PLAYLIST_ID) ?? createAutoLocalPlaylist();
  const regularPlaylists = playlists.filter((playlist) => playlist.id !== AUTO_LOCAL_PLAYLIST_ID);
  const normalized = regularPlaylists.length ? regularPlaylists : [createEmptyPlaylist(0)];
  const lastFilledIndex = normalized.reduce(
    (lastIndex, playlist, index) => (playlist.songs.length ? index : lastIndex),
    -1,
  );
  const visibleCount = Math.max(1, lastFilledIndex + 2);

  const visibleRegularPlaylists = Array.from({ length: visibleCount }, (_, index) => {
    const playlist = normalized[index] ?? createEmptyPlaylist(index);
    return {
      ...playlist,
      id: playlist.id || createPlaylistId(index),
      name: playlist.name || createPlaylistName(index),
    };
  });

  return [
    {
      ...autoLocalPlaylist,
      id: AUTO_LOCAL_PLAYLIST_ID,
      name: autoLocalPlaylist.name || AUTO_LOCAL_PLAYLIST_NAME,
    },
    ...visibleRegularPlaylists,
  ];
}

function createAutoLocalPlaylist(): PlaylistGroup {
  return {
    id: AUTO_LOCAL_PLAYLIST_ID,
    name: AUTO_LOCAL_PLAYLIST_NAME,
    songs: [],
  };
}

function createEmptyPlaylist(index: number): PlaylistGroup {
  return {
    id: index === 0 ? DEFAULT_PLAYLIST_ID : createPlaylistId(index),
    name: index === 0 ? DEFAULT_PLAYLIST_NAME : createPlaylistName(index),
    songs: [],
  };
}

function createPlaylistId(index: number) {
  return `playlist-${index + 1}`;
}

function createPlaylistName(index: number) {
  return `歌单${PLAYLIST_NUMERALS[index] ?? index + 1}`;
}

function createPlaybackQueue(
  playlists: PlaylistGroup[],
  selectedPlaylistIds: string[],
  fallbackPlaylistId: string,
): PlaybackQueueEntry[] {
  const selectedIds = selectedPlaylistIds.length ? selectedPlaylistIds : [fallbackPlaylistId];
  const selectedIdSet = new Set(selectedIds);
  const queue = playlists.flatMap((playlist) =>
    selectedIdSet.has(playlist.id)
      ? playlist.songs.map((song, songIndex) => ({
          playlistId: playlist.id,
          songIndex,
          song,
        }))
      : [],
  );

  if (queue.length) {
    return queue;
  }

  return playlists.flatMap((playlist) =>
    playlist.id === fallbackPlaylistId
      ? playlist.songs.map((song, songIndex) => ({
          playlistId: playlist.id,
          songIndex,
          song,
        }))
      : [],
  );
}

function createShuffledPlaybackQueue(queue: PlaybackQueueEntry[], preferredFirstSongId?: string | null) {
  if (queue.length <= 1) {
    return queue;
  }

  const pending = [...queue];
  let firstEntry: PlaybackQueueEntry | undefined;

  if (preferredFirstSongId) {
    const preferredIndex = pending.findIndex((entry) => entry.song.id === preferredFirstSongId);
    if (preferredIndex >= 0) {
      firstEntry = pending.splice(preferredIndex, 1)[0];
    }
  }

  if (!firstEntry) {
    const firstIndex = Math.min(Math.floor(Math.random() * pending.length), pending.length - 1);
    firstEntry = pending.splice(firstIndex, 1)[0];
  }

  for (let index = pending.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(Math.floor(Math.random() * (index + 1)), index);
    [pending[index], pending[swapIndex]] = [pending[swapIndex], pending[index]];
  }

  return [firstEntry, ...pending];
}

function hasSameQueueSongs(left: PlaybackQueueEntry[], right: PlaybackQueueEntry[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSongIds = new Set(right.map((entry) => entry.song.id));
  return left.every((entry) => rightSongIds.has(entry.song.id));
}

function createNativePlaybackQueueOptions(
  playlists: PlaylistGroup[],
  selectedPlaylistIds: string[],
  fallbackPlaylistId: string,
  currentSongId: string,
  playbackMode: PlaybackMode,
): {
  queue: NativeAudioQueueItem[];
  queueIndex: number;
  playbackMode: PlaybackMode;
} {
  const queue = createPlaybackQueue(playlists, selectedPlaylistIds, fallbackPlaylistId).flatMap((entry) => {
    if (!entry.song.nativeUri) {
      return [];
    }

    const playlistName = playlists.find((playlist) => playlist.id === entry.playlistId)?.name ?? DEFAULT_PLAYLIST_NAME;
    return [
      {
        songId: entry.song.id,
        playlistId: entry.playlistId,
        songIndex: entry.songIndex,
        uri: entry.song.nativeUri,
        title: entry.song.name,
        playlist: playlistName,
        duration: entry.song.duration,
      },
    ];
  });

  return {
    queue,
    queueIndex: queue.findIndex((entry) => entry.songId === currentSongId),
    playbackMode,
  };
}
