import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getNextIndex, getPreviousIndex } from '../lib/playbackQueue';
import { loadLibraryState, saveLibraryState } from '../lib/storage';
import type { PlaybackMode, Song } from '../types/music';

const MODE_ORDER: PlaybackMode[] = ['sequence', 'repeat-all', 'repeat-one', 'shuffle'];

export function useMusicPlayer() {
  const savedState = useMemo(() => loadLibraryState(), []);
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
    audio.volume = volume;
  }, [audio, volume]);

  useEffect(() => {
    if (!currentSong) {
      audio.pause();
      audio.src = '';
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      playSelectedSongRef.current = false;
      return;
    }

    audio.src = currentSong.url;
    audio.currentTime = 0;
    setCurrentTime(0);
    setDuration(currentSong.duration ?? 0);
    setErrorMessage(null);

    const shouldPlay = isPlaying || playSelectedSongRef.current;
    playSelectedSongRef.current = false;

    if (shouldPlay) {
      void audio.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
        setErrorMessage('这首歌暂时播放不了');
      });
    }
  }, [audio, currentSong]);

  const pause = useCallback(() => {
    audio.pause();
    setIsPlaying(false);
  }, [audio]);

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
    return () => {
      audio.pause();
      songsRef.current.forEach((song) => URL.revokeObjectURL(song.url));
    };
  }, [audio]);

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
      await audio.play();
      setIsPlaying(true);
      setErrorMessage(null);
    } catch {
      setIsPlaying(false);
      setErrorMessage('这首歌暂时播放不了');
    }
  }, [audio, currentSong]);

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
      audio.currentTime = safeTime;
      setCurrentTime(safeTime);
    },
    [audio, duration],
  );

  const setVolumeLevel = useCallback((nextVolume: number) => {
    setVolume(Math.max(0, Math.min(1, nextVolume)));
  }, []);

  const cycleMode = useCallback(() => {
    setPlaybackMode((mode) => MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length]);
  }, []);

  const removeSong = useCallback(
    (songId: string) => {
      const removedIndex = songs.findIndex((song) => song.id === songId);
      if (removedIndex < 0) {
        return;
      }

      playlistChangedInSessionRef.current = true;
      URL.revokeObjectURL(songs[removedIndex].url);
      const nextSongs = songs.filter((song) => song.id !== songId);
      setSongs(nextSongs);

      if (nextSongs.length === 0) {
        setCurrentIndex(null);
        pause();
        return;
      }

      if (currentIndex === null) {
        return;
      }

      if (removedIndex === currentIndex) {
        setCurrentIndex(Math.min(removedIndex, nextSongs.length - 1));
        return;
      }

      if (removedIndex < currentIndex) {
        setCurrentIndex(currentIndex - 1);
      }
    },
    [currentIndex, pause, songs],
  );

  const clearPlaylist = useCallback(() => {
    playlistChangedInSessionRef.current = true;
    songs.forEach((song) => URL.revokeObjectURL(song.url));
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
    clearPlaylist,
  };
}
