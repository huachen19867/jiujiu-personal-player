import { ListRestart, Pause, Play, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import type { PlaybackMode } from '../types/music';
import { formatDuration } from '../lib/format';

interface TransportControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackMode: PlaybackMode;
  volume: number;
  disabled: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onCycleMode: () => void;
}

const modeLabels: Record<PlaybackMode, string> = {
  sequence: '顺序播放',
  'repeat-all': '列表循环',
  'repeat-one': '单曲循环',
  shuffle: '随机播放',
};

export function TransportControls({
  currentTime,
  duration,
  isPlaying,
  playbackMode,
  volume,
  disabled,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onCycleMode,
}: TransportControlsProps) {
  const safeDuration = duration || 0;

  return (
    <section className="transport" aria-label="播放控制">
      <div className="progress-row">
        <span>{formatDuration(currentTime)}</span>
        <input
          aria-label="播放进度"
          type="range"
          min="0"
          max={safeDuration || 1}
          step="1"
          value={Math.min(currentTime, safeDuration || 1)}
          disabled={disabled}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
        />
        <span>{formatDuration(safeDuration)}</span>
      </div>

      <div className="control-row">
        <button type="button" aria-label="上一首" disabled={disabled} onClick={onPrevious}>
          <SkipBack aria-hidden="true" size={23} />
        </button>
        <button className="play-button" type="button" aria-label={isPlaying ? '暂停' : '播放'} disabled={disabled} onClick={onTogglePlay}>
          {isPlaying ? <Pause aria-hidden="true" size={30} /> : <Play aria-hidden="true" size={30} />}
        </button>
        <button type="button" aria-label="下一首" disabled={disabled} onClick={onNext}>
          <SkipForward aria-hidden="true" size={23} />
        </button>
      </div>

      <div className="utility-row">
        <button
          className="mode-button"
          type="button"
          aria-label={`播放模式：${modeLabels[playbackMode]}`}
          onClick={onCycleMode}
        >
          {playbackMode === 'shuffle' ? (
            <Shuffle aria-hidden="true" size={18} />
          ) : playbackMode === 'repeat-one' ? (
            <Repeat1 aria-hidden="true" size={18} />
          ) : (
            <ListRestart aria-hidden="true" size={18} />
          )}
          <span>{modeLabels[playbackMode]}</span>
        </button>
        <label className="volume-control">
          <span>音量</span>
          <input
            aria-label="音量"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.currentTarget.value))}
          />
        </label>
      </div>
    </section>
  );
}
