import { Pencil, Plus } from 'lucide-react';
import type { PlaylistGroup } from '../types/music';

interface PlaylistSwitcherProps {
  playlists: PlaylistGroup[];
  activePlaylistId: string;
  onSelectPlaylist: (playlistId: string) => void;
  onRenamePlaylist: (playlistId: string, name: string) => void;
}

export function PlaylistSwitcher({
  playlists,
  activePlaylistId,
  onSelectPlaylist,
  onRenamePlaylist,
}: PlaylistSwitcherProps) {
  return (
    <section className="playlist-switcher" aria-label="歌单切换">
      <div className="playlist-switcher-track">
        {playlists.map((playlist, index) => {
          const isEmptyTail = playlist.songs.length === 0 && index === playlists.length - 1 && index > 0;
          return (
            <div
              className={playlist.id === activePlaylistId ? 'playlist-tab is-active' : 'playlist-tab'}
              key={playlist.id}
            >
              <button
                className="playlist-tab-main"
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
              <button
                className="playlist-tab-rename"
                type="button"
                aria-label={`重命名 ${playlist.name}`}
                onClick={() => {
                  const nextName = window.prompt('重命名歌单', playlist.name);
                  if (nextName !== null) {
                    onRenamePlaylist(playlist.id, nextName);
                  }
                }}
              >
                <Pencil aria-hidden="true" size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
