import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, ChevronDown, ChevronUp, Play, Trash2, X } from 'lucide-react';
import type { Song } from '../types/music';
import { formatBytes, formatDuration } from '../lib/format';

interface PlaylistProps {
  playlistName: string;
  songs: Song[];
  currentSongId: string | null;
  onPlaySong: (songId: string) => void;
  onRemoveSong: (songId: string) => void;
  onRemoveSongs: (songIds: string[]) => void;
  onClear: () => void;
}

const VIRTUALIZE_THRESHOLD = 120;
const ROW_HEIGHT = 72;
const OVERSCAN_ROWS = 8;

export function Playlist({ playlistName, songs, currentSongId, onPlaySong, onRemoveSong, onRemoveSongs, onClear }: PlaylistProps) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const listViewportHeightRef = useRef(0);
  const listScrollTopRef = useRef(0);
  const [, forceUpdate] = useState(0);
  const selectedCount = selectedSongIds.length;
  const selectedSongIdSet = useMemo(() => new Set(selectedSongIds), [selectedSongIds]);
  const shouldVirtualize = songs.length > VIRTUALIZE_THRESHOLD;
  const viewportHeight = listViewportHeightRef.current || Math.min(620, Math.max(1, songs.length) * ROW_HEIGHT);
  const startIndex = shouldVirtualize ? Math.max(0, Math.floor(listScrollTopRef.current / ROW_HEIGHT) - OVERSCAN_ROWS) : 0;
  const endIndex = shouldVirtualize
    ? Math.min(songs.length, startIndex + Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2)
    : songs.length;
  const visibleSongs = shouldVirtualize ? songs.slice(startIndex, endIndex) : songs;
  const virtualPaddingTop = shouldVirtualize ? startIndex * ROW_HEIGHT : 0;
  const virtualPaddingBottom = shouldVirtualize ? Math.max(0, (songs.length - endIndex) * ROW_HEIGHT) : 0;

  useEffect(() => {
    setSelectedSongIds((ids) => ids.filter((id) => songs.some((song) => song.id === id)));
  }, [songs]);

  useEffect(() => {
    if (!songs.length) {
      setSelectionMode(false);
    }
  }, [songs.length]);

  useEffect(() => {
    if (!shouldVirtualize) {
      listScrollTopRef.current = 0;
      listViewportHeightRef.current = 0;
      return;
    }

    const ul = listRef.current;
    if (!ul) return;

    function updateViewportHeight() {
      const el = listRef.current;
      listViewportHeightRef.current = el ? el.clientHeight : (window.innerHeight * 0.68);
      forceUpdate((n) => n + 1);
    }

    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateViewportHeight);
      observer.observe(ul);
      updateViewportHeight();
    }

    var rafHandle = null as ReturnType<typeof requestAnimationFrame> | null;
    var pendingUpdate = false as boolean;
    function scheduleUpdate() {
      if (pendingUpdate) return;
      pendingUpdate = true;
      rafHandle = requestAnimationFrame(function() {
        pendingUpdate = false;
        forceUpdate(function(n) { return n + 1; });
      });
    }

    function handleScroll() {
      var el = listRef.current;
      if (!el) return;
      var st = el.scrollTop;
      if (st === listScrollTopRef.current) return;
      listScrollTopRef.current = st;
      scheduleUpdate();
    }

    ul.addEventListener('scroll', handleScroll, { passive: true });

    return function() {
      if (observer) observer.disconnect();
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      ul.removeEventListener('scroll', handleScroll);
    };
  }, [shouldVirtualize]);

  useEffect(() => {
    listScrollTopRef.current = 0;
    listRef.current?.scrollTo?.({ top: 0 });
  }, [playlistName, songs.length]);

  const toggleSelectionMode = () => {
    setSelectionMode((enabled) => {
      if (enabled) {
        setSelectedSongIds([]);
      }
      return !enabled;
    });
  };

  const toggleSongSelection = (songId: string) => {
    setSelectedSongIds((ids) =>
      ids.includes(songId) ? ids.filter((id) => id !== songId) : [...ids, songId],
    );
  };

  const removeOne = (song: Song) => {
    if (!window.confirm(`确定要删除「${song.name}」吗？`)) {
      return;
    }

    onRemoveSong(song.id);
  };

  const removeSelected = () => {
    if (!selectedCount) {
      return;
    }

    if (!window.confirm(`确定要删除选中的 ${selectedCount} 首歌吗？`)) {
      return;
    }

    onRemoveSongs(selectedSongIds);
    setSelectedSongIds([]);
  };

  const clearAll = () => {
    if (!songs.length || !window.confirm(`确定要清空全部 ${songs.length} 首歌吗？`)) {
      return;
    }

    onClear();
  };

  return (
    <section className="playlist-shell" aria-label="歌单">
      <div className="playlist-heading">
        <div>
          <p>PLAYLIST</p>
          <h2>{playlistName}：{songs.length} 首歌</h2>
        </div>
        <div className="playlist-actions">
          <button
            type="button"
            aria-label={isCollapsed ? '展开歌单' : '折叠歌单'}
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          >
            {isCollapsed ? <ChevronDown aria-hidden="true" size={15} /> : <ChevronUp aria-hidden="true" size={15} />}
            {isCollapsed ? '展开' : '折叠'}
          </button>
          <button type="button" disabled={!songs.length} onClick={toggleSelectionMode}>
            {selectionMode ? '取消' : '多选'}
          </button>
          <button type="button" disabled={!songs.length} onClick={clearAll}>
            清空
          </button>
        </div>
      </div>

      {!isCollapsed && selectionMode ? (
        <div className="selection-bar" role="status">
          <span>已选 {selectedCount} 首</span>
          <button className="selection-danger" type="button" disabled={!selectedCount} onClick={removeSelected}>
            <Trash2 aria-hidden="true" size={15} />
            删除所选 {selectedCount} 首
          </button>
        </div>
      ) : null}

      {!isCollapsed ? (
        <ul
          className={shouldVirtualize ? 'playlist is-virtualized' : 'playlist'}
          aria-label="播放列表"
          ref={listRef}
          style={
            shouldVirtualize
              ? {
                  paddingTop: virtualPaddingTop,
                  paddingBottom: virtualPaddingBottom,
                }
              : undefined
          }
          >
          {visibleSongs.map((song, offset) => {
            const index = startIndex + offset;
            return (
            <li
              className={[
                'song-row',
                song.id === currentSongId ? 'is-current' : '',
                selectionMode ? 'is-selecting' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={song.id}
            >
              {selectionMode ? (
                <label className="song-select">
                  <input
                    type="checkbox"
                    aria-label={`选择 ${song.name}`}
                    checked={selectedSongIdSet.has(song.id)}
                    onChange={() => toggleSongSelection(song.id)}
                  />
                  <CheckSquare aria-hidden="true" size={16} />
                </label>
              ) : (
                <button className="song-play" type="button" aria-label={`播放 ${song.name}`} onClick={() => onPlaySong(song.id)}>
                  <Play aria-hidden="true" size={16} />
                </button>
              )}
              <div className="song-main">
                <span className="song-index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{song.name}</h3>
                  <p>
                    {song.type || 'audio'} · {formatBytes(song.size)}
                    {song.duration ? ` · ${formatDuration(song.duration)}` : ''}
                  </p>
                </div>
              </div>
              <button className="icon-danger" type="button" aria-label={`移除 ${song.name}`} onClick={() => removeOne(song)}>
                {selectionMode ? <X aria-hidden="true" size={17} /> : <Trash2 aria-hidden="true" size={17} />}
              </button>
            </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
