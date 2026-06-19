import { useState } from 'react';
import { ImportActions } from './components/ImportActions';
import { NowPlaying } from './components/NowPlaying';
import { Playlist } from './components/Playlist';
import { ProfilePanel } from './components/ProfilePanel';
import { TransportControls } from './components/TransportControls';
import { APP_BRAND } from './config/brand';
import { useMusicPlayer } from './hooks/useMusicPlayer';
import {
  collectAudioFilesFromDirectory,
  createSongFromNativeAudio,
  createSongsFromFiles,
  type DirectoryHandleLike,
  supportsDirectoryImport,
} from './lib/musicFiles';
import { getNativeMusicPicker } from './lib/nativeBridge';
import './styles.css';

type DirectoryPickerGlobal = typeof globalThis & {
  showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
};

function App() {
  const player = useMusicPlayer();
  const [notice, setNotice] = useState<string | null>(null);
  const directoryImportSupported = supportsDirectoryImport();
  const nativeAudioImportSupported = Boolean(getNativeMusicPicker());
  const reauthorizationNotice = player.rememberedSongCount
    ? `上次歌单有 ${player.rememberedSongCount} 首，重新选歌授权后才能播放。`
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
      const result = await picker.pickAudioFiles();
      const songs = result.songs.map((asset, index) => createSongFromNativeAudio(asset, index));
      if (!songs.length) {
        return;
      }

      player.addSongs(songs);
      setNotice(null);
    } catch {
      setNotice('安卓多选导入失败，请改用普通选歌。');
    }
  };

  const importDirectory = async () => {
    if (!supportsDirectoryImport()) {
      setNotice('当前浏览器不支持文件夹导入，请改用选歌多选。');
      return;
    }

    try {
      const picker = (globalThis as DirectoryPickerGlobal).showDirectoryPicker;
      const handle = await picker?.();
      if (!handle) {
        return;
      }

      const files = await collectAudioFilesFromDirectory(handle);
      addFiles(files);
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        setNotice('文件夹导入失败，请改用选歌多选。');
      }
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
          <p className="site-status">{player.songs.length ? `${player.songs.length} 首歌` : '本地歌单'}</p>
        </header>

        <div className="player-layout">
          <div className="player-primary">
            <NowPlaying
              song={player.currentSong}
              currentTime={player.currentTime}
              duration={player.duration}
              isPlaying={player.isPlaying}
            />

            <ImportActions
              notice={notice ?? player.errorMessage ?? reauthorizationNotice}
              directoryImportSupported={directoryImportSupported}
              nativeAudioImportSupported={nativeAudioImportSupported}
              onFilesSelected={addFiles}
              onNativeAudioImport={importNativeAudio}
              onImportDirectory={importDirectory}
            />

            <TransportControls
              currentTime={player.currentTime}
              duration={player.duration}
              isPlaying={player.isPlaying}
              playbackMode={player.playbackMode}
              volume={player.volume}
              disabled={!player.currentSong}
              onTogglePlay={player.togglePlay}
              onNext={player.next}
              onPrevious={player.previous}
              onSeek={player.seek}
              onVolumeChange={player.setVolumeLevel}
              onCycleMode={player.cycleMode}
            />
          </div>

          <div className="player-secondary">
            <Playlist
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
