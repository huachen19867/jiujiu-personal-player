import { Plus } from 'lucide-react';
import type { PlaylistGroup } from '../types/music';

interface PlaylistSwitcherProps {
  playlists: PlaylistGroup[];
  activePlaylistId: string;
  onSelectPlaylist: (playlistId: string) => void;
}

export function PlaylistSwitcher({ playlists, activePlaylistId, onSelectPlaylist }: PlaylistSwitcherProps) {
  return (
    <section className="playlist-switcher" aria-label="歌单切换">
      <div className="playlist-switcher-track">
        {playlists.map((playlist, index) => {
          const isEmptyTail = playlist.songs.length === 0 && index === playlists.length - 1 && index > 0;
          return (
            <button
              className={playlist.id === activePlaylistId ? 'playlist-tab is-active' : 'playlist-tab'}
              key={playlist.id}
              type="button"
              aria-label={`查看 ${playlist.name}`}
              onClick={() => onSelectPlaylist(playlist.id)}
            >
              {isEmptyTail ? (
                <Plus aria-hidden="true" size={15} />
              ) : (
                <span className="playlist-tab-spacer" aria-hidden="true" />
              )}
              <span>{playlist.name}</span>
              <small>{playlist.songs.length} 首</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
