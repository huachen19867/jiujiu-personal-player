import { Pencil, Plus } from 'lucide-react';
import type { PlaylistGroup } from '../types/music';

interface PlaylistSwitcherProps {
  playlists: PlaylistGroup[];
  activePlaylistId: string;
  notice: string | null;
  nativeAudioImportSupported: boolean;
  onFilesSelected: (files: FileList | File[]) => void;
  onNativeAudioImport: () => void;
  onSelectPlaylist: (playlistId: string) => void;
  onRenamePlaylist: (playlistId: string, name: string) => void;
}

export function PlaylistSwitcher({
  playlists,
  activePlaylistId,
  notice,
  nativeAudioImportSupported,
  onFilesSelected,
  onNativeAudioImport,
  onSelectPlaylist,
  onRenamePlaylist,
}: PlaylistSwitcherProps) {
  return (
    <section className="playlist-switcher" aria-label="歌单切换">
      <div className="playlist-switcher-track">
        {playlists.map((playlist) => {
          const isActive = playlist.id === activePlaylistId;
          return (
            <div className={isActive ? 'playlist-tab is-active has-actions' : 'playlist-tab'} key={playlist.id}>
              <button
                className="playlist-tab-main"
                type="button"
                aria-label={`查看 ${playlist.name}`}
                onClick={() => onSelectPlaylist(playlist.id)}
              >
                <span>{playlist.name}</span>
                <small>{playlist.songs.length} 首</small>
              </button>

              {isActive ? (
                nativeAudioImportSupported ? (
                  <button
                    className="playlist-tab-action playlist-tab-add"
                    type="button"
                    aria-label={`给${playlist.name}添加歌曲`}
                    onClick={onNativeAudioImport}
                  >
                    <Plus aria-hidden="true" size={15} />
                  </button>
                ) : (
                  <label className="playlist-tab-action playlist-tab-add">
                    <Plus aria-hidden="true" size={15} />
                    <input
                      aria-label={`给${playlist.name}添加歌曲`}
                      type="file"
                      accept="audio/*,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus"
                      multiple
                      onChange={(event) => {
                        if (event.currentTarget.files) {
                          onFilesSelected(event.currentTarget.files);
                          event.currentTarget.value = '';
                        }
                      }}
                    />
                  </label>
                )
              ) : null}

              {isActive ? (
                <button
                  className="playlist-tab-action playlist-tab-rename"
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
              ) : null}
            </div>
          );
        })}
      </div>
      {notice ? (
        <p className="playlist-switcher-notice" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
