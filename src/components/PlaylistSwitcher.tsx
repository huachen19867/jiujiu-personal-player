import { useEffect, useRef, useState } from 'react';
import { FileMusic, FolderOpen, Pencil, Plus } from 'lucide-react';
import type { PlaylistGroup } from '../types/music';

interface PlaylistSwitcherProps {
  playlists: PlaylistGroup[];
  activePlaylistId: string;
  notice: string | null;
  nativeAudioImportSupported: boolean;
  nativeFolderImportSupported: boolean;
  onFilesSelected: (files: FileList | File[]) => void;
  onNativeAudioImport: () => void;
  onNativeFolderImport: () => void;
  onSelectPlaylist: (playlistId: string) => void;
  onRenamePlaylist: (playlistId: string, name: string) => void;
}

export function PlaylistSwitcher({
  playlists,
  activePlaylistId,
  notice,
  nativeAudioImportSupported,
  nativeFolderImportSupported,
  onFilesSelected,
  onNativeAudioImport,
  onNativeFolderImport,
  onSelectPlaylist,
  onRenamePlaylist,
}: PlaylistSwitcherProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [actionPlaylistId, setActionPlaylistId] = useState<string | null>(null);
  const [importMenuPlaylistId, setImportMenuPlaylistId] = useState<string | null>(null);

  useEffect(() => {
    if (!actionPlaylistId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }

      setActionPlaylistId(null);
      setImportMenuPlaylistId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActionPlaylistId(null);
        setImportMenuPlaylistId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionPlaylistId]);

  useEffect(() => {
    if (actionPlaylistId && !playlists.some((playlist) => playlist.id === actionPlaylistId)) {
      setActionPlaylistId(null);
      setImportMenuPlaylistId(null);
    }
  }, [actionPlaylistId, playlists]);

  const importMenuPlaylist = playlists.find((playlist) => playlist.id === importMenuPlaylistId) ?? null;

  return (
    <section className="playlist-switcher" aria-label="歌单切换" ref={rootRef}>
      <div className="playlist-switcher-track">
        {playlists.map((playlist) => {
          const isActive = playlist.id === activePlaylistId;
          const isActionOpen = playlist.id === actionPlaylistId;
          const className = [
            'playlist-tab',
            isActive ? 'is-active' : '',
            isActionOpen ? 'has-actions' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div className={className} key={playlist.id}>
              <button
                className="playlist-tab-main"
                type="button"
                aria-label={`查看 ${playlist.name}`}
                aria-expanded={isActionOpen}
                onClick={() => {
                  if (!isActive) {
                    onSelectPlaylist(playlist.id);
                  }

                  setActionPlaylistId(isActionOpen ? null : playlist.id);
                  setImportMenuPlaylistId(null);
                }}
              >
                <span>{playlist.name}</span>
                <small>{playlist.songs.length} 首</small>
              </button>

              {isActionOpen ? (
                nativeAudioImportSupported ? (
                  <button
                    className="playlist-tab-action playlist-tab-add"
                    type="button"
                    aria-label={`打开${playlist.name}导入方式`}
                    aria-expanded={importMenuPlaylistId === playlist.id}
                    onClick={() => setImportMenuPlaylistId((id) => (id === playlist.id ? null : playlist.id))}
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

              {isActionOpen ? (
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
      {importMenuPlaylist ? (
        <div className="playlist-import-menu" role="menu" aria-label={`${importMenuPlaylist.name}导入方式`}>
          <button
            type="button"
            role="menuitem"
            aria-label={`选歌曲导入${importMenuPlaylist.name}`}
            onClick={() => {
              setImportMenuPlaylistId(null);
              onNativeAudioImport();
            }}
          >
            <FileMusic aria-hidden="true" size={16} />
            选歌曲
          </button>
          {nativeFolderImportSupported ? (
            <button
              type="button"
              role="menuitem"
              aria-label={`选文件夹导入${importMenuPlaylist.name}`}
              onClick={() => {
                setImportMenuPlaylistId(null);
                onNativeFolderImport();
              }}
            >
              <FolderOpen aria-hidden="true" size={16} />
              选文件夹
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
