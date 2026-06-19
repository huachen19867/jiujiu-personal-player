import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Play, Trash2, X } from 'lucide-react';
import type { Song } from '../types/music';
import { formatBytes, formatDuration } from '../lib/format';

interface PlaylistProps {
  songs: Song[];
  currentSongId: string | null;
  onPlaySong: (songId: string) => void;
  onRemoveSong: (songId: string) => void;
  onRemoveSongs: (songIds: string[]) => void;
  onClear: () => void;
}

export function Playlist({ songs, currentSongId, onPlaySong, onRemoveSong, onRemoveSongs, onClear }: PlaylistProps) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const selectedCount = selectedSongIds.length;
  const selectedSongIdSet = useMemo(() => new Set(selectedSongIds), [selectedSongIds]);

  useEffect(() => {
    setSelectedSongIds((ids) => ids.filter((id) => songs.some((song) => song.id === id)));
  }, [songs]);

  useEffect(() => {
    if (!songs.length) {
      setSelectionMode(false);
    }
  }, [songs.length]);

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
          <h2>{songs.length ? `${songs.length} 首本地歌` : '还没有歌'}</h2>
        </div>
        <div className="playlist-actions">
          <button type="button" disabled={!songs.length} onClick={toggleSelectionMode}>
            {selectionMode ? '取消' : '多选'}
          </button>
          <button type="button" disabled={!songs.length} onClick={clearAll}>
            清空
          </button>
        </div>
      </div>

      {selectionMode ? (
        <div className="selection-bar" role="status">
          <span>已选 {selectedCount} 首</span>
          <button className="selection-danger" type="button" disabled={!selectedCount} onClick={removeSelected}>
            <Trash2 aria-hidden="true" size={15} />
            删除所选 {selectedCount} 首
          </button>
        </div>
      ) : null}

      <ul className="playlist" aria-label="播放列表">
        {songs.map((song, index) => (
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
        ))}
      </ul>
    </section>
  );
}
