import { Play, Trash2 } from 'lucide-react';
import type { Song } from '../types/music';
import { formatBytes, formatDuration } from '../lib/format';

interface PlaylistProps {
  songs: Song[];
  currentSongId: string | null;
  onPlaySong: (songId: string) => void;
  onRemoveSong: (songId: string) => void;
  onClear: () => void;
}

export function Playlist({ songs, currentSongId, onPlaySong, onRemoveSong, onClear }: PlaylistProps) {
  return (
    <section className="playlist-shell" aria-label="歌单">
      <div className="playlist-heading">
        <div>
          <p>PLAYLIST</p>
          <h2>{songs.length ? `${songs.length} 首本地歌` : '还没有歌'}</h2>
        </div>
        <button type="button" disabled={!songs.length} onClick={onClear}>
          清空
        </button>
      </div>

      <ul className="playlist" aria-label="播放列表">
        {songs.map((song, index) => (
          <li className={song.id === currentSongId ? 'song-row is-current' : 'song-row'} key={song.id}>
            <button className="song-play" type="button" aria-label={`播放 ${song.name}`} onClick={() => onPlaySong(song.id)}>
              <Play aria-hidden="true" size={16} />
            </button>
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
            <button className="icon-danger" type="button" aria-label={`移除 ${song.name}`} onClick={() => onRemoveSong(song.id)}>
              <Trash2 aria-hidden="true" size={17} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
