import { useState } from 'react';
import { ImportActions } from './components/ImportActions';
import { NowPlaying } from './components/NowPlaying';
import { Playlist } from './components/Playlist';
import { TransportControls } from './components/TransportControls';
import { useMusicPlayer } from './hooks/useMusicPlayer';
import {
  collectAudioFilesFromDirectory,
  createSongsFromFiles,
  type DirectoryHandleLike,
  supportsDirectoryImport,
} from './lib/musicFiles';
import './styles.css';

type DirectoryPickerGlobal = typeof globalThis & {
  showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
};

function App() {
  const player = useMusicPlayer();
  const [notice, setNotice] = useState<string | null>(null);
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
      <div className="phone-stage">
        <NowPlaying song={player.currentSong} currentTime={player.currentTime} duration={player.duration} />

        <ImportActions
          notice={notice ?? player.errorMessage ?? reauthorizationNotice}
          onFilesSelected={addFiles}
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

        <Playlist
          songs={player.songs}
          currentSongId={player.currentSong?.id ?? null}
          onPlaySong={player.playSong}
          onRemoveSong={player.removeSong}
          onClear={player.clearPlaylist}
        />
      </div>
    </main>
  );
}

export default App;
