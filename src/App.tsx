import { useState } from 'react';
import { NowPlaying } from './components/NowPlaying';
import { Playlist } from './components/Playlist';
import { PlaylistSwitcher } from './components/PlaylistSwitcher';
import { ProfilePanel } from './components/ProfilePanel';
import { TransportControls } from './components/TransportControls';
import { APP_BRAND } from './config/brand';
import { useMusicPlayer } from './hooks/useMusicPlayer';
import {
  createSongFromNativeAudio,
  createSongsFromFiles,
} from './lib/musicFiles';
import { getNativeMusicPicker } from './lib/nativeBridge';
import { AUTO_LOCAL_PLAYLIST_ID } from './lib/storage';
import './styles.css';

function App() {
  const player = useMusicPlayer();
  const [notice, setNotice] = useState<string | null>(null);
  const nativeAudioImportSupported = Boolean(getNativeMusicPicker());
  const reauthorizationNotice = player.rememberedSongCount
    ? `上次有 ${player.rememberedSongCount} 首旧版歌曲需要重新选一次；新版导入后会自动保留。`
    : null;

  const addFiles = (files: FileList | File[]) => {
    const songs = createSongsFromFiles(files);
    if (!songs.length) {
      setNotice('没有找到可播放的音频文件。');
      return;
    }

    player.addSongs(songs);
    setNotice(null);
  };

  const importNativeAudio = async () => {
    const picker = getNativeMusicPicker();
    if (!picker) {
      setNotice('当前环境没有安卓多选能力，请改用普通选歌。');
      return;
    }

    try {
      const scanAudioFiles = player.activePlaylistId === AUTO_LOCAL_PLAYLIST_ID ? picker.scanAudioFiles : undefined;
      const result = await (scanAudioFiles ? scanAudioFiles() : picker.pickAudioFiles());
      const songs = result.songs.map((asset, index) => createSongFromNativeAudio(asset, index));
      if (result.message) {
        setNotice(result.message);
      }
      if (!songs.length) {
        return;
      }

      player.addSongs(songs);
      setNotice(null);
    } catch {
      setNotice('安卓多选导入失败，请改用普通选歌。');
    }
  };

  return (
    <main className="app-shell">
      <div className="player-page">
        <header className="site-header">
          <div>
            <p className="site-kicker">LOCAL PLAYER</p>
            <div className="site-title">{APP_BRAND.displayName}</div>
          </div>
          <p className="site-status">{player.totalSongCount ? `${player.totalSongCount} 首歌` : '本地歌单'}</p>
        </header>

        <div className="player-layout">
          <div className="player-primary">
            <NowPlaying
              song={player.currentSong}
              playlistGroups={player.playlistGroups}
              activePlaylistName={player.currentPlaylistName}
              selectedPlaylistIds={player.selectedPlaybackPlaylistIds}
              currentTime={player.currentTime}
              duration={player.duration}
              isPlaying={player.isPlaying}
              onTogglePlaylistSelection={player.togglePlaybackPlaylist}
            />

            <TransportControls
              currentTime={player.currentTime}
              duration={player.duration}
              isPlaying={player.isPlaying}
              playbackMode={player.playbackMode}
              volume={player.volume}
              disabled={!player.currentSong}
              playDisabled={!player.canPlay}
              onTogglePlay={player.togglePlay}
              onNext={player.next}
              onPrevious={player.previous}
              onSeek={player.seek}
              onVolumeChange={player.setVolumeLevel}
              onCycleMode={player.cycleMode}
            />

            <PlaylistSwitcher
              playlists={player.playlistGroups}
              activePlaylistId={player.activePlaylistId}
              notice={notice ?? player.errorMessage ?? reauthorizationNotice}
              nativeAudioImportSupported={nativeAudioImportSupported}
              onFilesSelected={addFiles}
              onNativeAudioImport={importNativeAudio}
              onSelectPlaylist={player.selectPlaylist}
              onRenamePlaylist={player.renamePlaylist}
            />
          </div>

          <div className="player-secondary">
            <Playlist
              playlistName={player.activePlaylistName}
              songs={player.songs}
              currentSongId={player.currentSong?.id ?? null}
              onPlaySong={player.playSong}
              onRemoveSong={player.removeSong}
              onRemoveSongs={player.removeSongs}
              onClear={player.clearPlaylist}
            />
            <ProfilePanel />
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
