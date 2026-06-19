import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getNativeAudioPlayer } from '../lib/nativeBridge';
import { getNextIndex, getPreviousIndex } from '../lib/playbackQueue';
import { loadLibraryState, saveLibraryState } from '../lib/storage';
import type { PlaybackMode, Song } from '../types/music';

const MODE_ORDER: PlaybackMode[] = ['sequence', 'repeat-all', 'repeat-one', 'shuffle'];

export function useMusicPlayer() {
  const savedState = useMemo(() => loadLibraryState(), []);
  const nativeAudioPlayer = useMemo(() => getNativeAudioPlayer(), []);
  const [audio] = useState(() => new Audio());
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(savedState.volume);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(savedState.playbackMode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const songsRef = useRef<Song[]>([]);
  const currentSongRef = useRef<Song | null>(null);
  const volumeRef = useRef(savedState.volume);
  const playlistChangedInSessionRef = useRef(false);
  const playSelectedSongRef = useRef(false);

  const currentSong = currentIndex === null ? null : songs[currentIndex] ?? null;
  const rememberedSongCount =
    songs.length === 0 && !playlistChangedInSessionRef.current ? savedState.songs.length : 0;

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

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
      setCurrentTime(0);
      setDuration(currentSong.duration ?? 0);
      setErrorMessage(null);

      void nativeAudioPlayer
        .load({ uri: currentSong.nativeUri, volume: volumeRef.current })
        .then((state) => {
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
    audio.src = currentSong.url;
    audio.currentTime = 0;
    setCurrentTime(0);
    setDuration(currentSong.duration ?? 0);
    setErrorMessage(null);

    if (shouldPlay) {
      void audio.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
        setErrorMessage('这首歌暂时播放不了，可能是格式或编码不受当前手机支持。');
      });
    }
  }, [audio, currentSong, nativeAudioPlayer]);

  const pause = useCallback(() => {
    audio.pause();
    if (currentSongRef.current?.nativeUri && nativeAudioPlayer) {
      void nativeAudioPlayer.pause();
    }
    setIsPlaying(false);
  }, [audio, nativeAudioPlayer]);

  const goToIndex = useCallback(
    (index: number | null) => {
      if (index === null) {
        pause();
        return;
      }
      setCurrentIndex(index);
    },
    [pause],
  );

  const next = useCallback(() => {
    if (currentIndex === null) {
      return;
    }
    goToIndex(getNextIndex(currentIndex, songs.length, playbackMode));
  }, [currentIndex, goToIndex, playbackMode, songs.length]);

  const previous = useCallback(() => {
    if (currentIndex === null) {
      return;
    }
    goToIndex(getPreviousIndex(currentIndex, songs.length, playbackMode));
  }, [currentIndex, goToIndex, playbackMode, songs.length]);

  useEffect(() => {
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleEnded = () => next();
    const handleError = () => {
      if (!currentSongRef.current) {
        return;
      }
      setIsPlaying(false);
      setErrorMessage('这首歌暂时播放不了');
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
  }, [audio, next]);

  useEffect(() => {
    const shouldKeepSavedSongs =
      !playlistChangedInSessionRef.current && songs.length === 0 && savedState.songs.length > 0;

    saveLibraryState({
      songs: shouldKeepSavedSongs ? savedState.songs : songs,
      currentSongId: shouldKeepSavedSongs ? savedState.currentSongId : currentSong?.id ?? null,
      playbackMode,
      volume,
    });
  }, [currentSong?.id, playbackMode, savedState.currentSongId, savedState.songs, songs, volume]);

  useEffect(() => {
    if (!currentSong?.nativeUri || !nativeAudioPlayer || !isPlaying) {
      return;
    }

    let canceled = false;
    const syncNativeState = async () => {
      try {
        const state = await nativeAudioPlayer.getState();
        if (canceled) {
          return;
        }

        setCurrentTime(state.currentTime);
        setDuration(state.duration);
        if (state.ended) {
          setIsPlaying(false);
          next();
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
  }, [currentSong?.nativeUri, isPlaying, nativeAudioPlayer, next]);

  useEffect(() => {
    return () => {
      audio.pause();
      void nativeAudioPlayer?.release?.();
      songsRef.current
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
      setSongs((existingSongs) => {
        const mergedSongs = [...existingSongs, ...incomingSongs];
        if (currentIndex === null && existingSongs.length === 0) {
          setCurrentIndex(0);
        }
        return mergedSongs;
      });
    },
    [currentIndex],
  );

  const play = useCallback(async () => {
    if (!currentSong) {
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
  }, [audio, currentSong, nativeAudioPlayer]);

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
        if (index === currentIndex) {
          if (!isPlaying) {
            return play();
          }
          return;
        }

        playSelectedSongRef.current = true;
        setCurrentIndex(index);
      }
    },
    [currentIndex, isPlaying, play, songs],
  );

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
    setPlaybackMode((mode) => MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length]);
  }, []);

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
      setSongs(nextSongs);

      if (nextSongs.length === 0) {
        setCurrentIndex(null);
        pause();
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
    [currentIndex, pause, songs],
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
    setSongs([]);
    setCurrentIndex(null);
    pause();
  }, [pause, songs]);

  return {
    songs,
    currentSong,
    currentIndex,
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
