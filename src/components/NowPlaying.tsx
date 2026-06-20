import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { PlaylistGroup, Song } from '../types/music';
import { formatDuration } from '../lib/format';

interface NowPlayingProps {
  song: Song | null;
  playlistGroups: PlaylistGroup[];
  activePlaylistName: string;
  selectedPlaylistIds: string[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTogglePlaylistSelection: (playlistId: string) => void;
}

interface PlayerDiscMarkProps {
  isPlaying: boolean;
}

function PlayerDiscMark({ isPlaying }: PlayerDiscMarkProps) {
  return (
    <svg className="player-disc-mark" viewBox="0 0 180 180" role="img" aria-label={isPlaying ? '播放中的唱片动效' : '待播放唱片'}>
      <g className="wave-bars wave-bars-left" aria-hidden="true">
        <line x1="10" y1="90" x2="10" y2="90" />
        <line x1="20" y1="78" x2="20" y2="102" />
        <line x1="30" y1="66" x2="30" y2="114" />
        <line x1="40" y1="76" x2="40" y2="104" />
        <line x1="50" y1="82" x2="50" y2="98" />
      </g>
      <g className="wave-bars wave-bars-right" aria-hidden="true">
        <line x1="130" y1="82" x2="130" y2="98" />
        <line x1="140" y1="76" x2="140" y2="104" />
        <line x1="150" y1="66" x2="150" y2="114" />
        <line x1="160" y1="78" x2="160" y2="102" />
        <line x1="170" y1="90" x2="170" y2="90" />
      </g>

      <g className="disc-rings" aria-hidden="true">
        <circle className="ring ring-main" cx="90" cy="90" r="50" />
        <path className="ring ring-outer-a" d="M49 48a58 58 0 0 1 82 0" />
        <path className="ring ring-outer-b" d="M131 132a58 58 0 0 1-82 0" />
        <path className="ring ring-inner-a" d="M61 58a42 42 0 0 1 58 0" />
        <path className="ring ring-inner-b" d="M119 122a42 42 0 0 1-58 0" />
      </g>

      <g className="disc-motion" aria-hidden="true">
        <path className="motion-arc motion-arc-a" d="M55 124a54 54 0 0 1 0-68" />
        <path className="motion-arc motion-arc-b" d="M125 56a54 54 0 0 1 0 68" />
      </g>

      <g className="disc-center" aria-hidden="true">
        <circle cx="90" cy="90" r="28" />
        {isPlaying ? (
          <g className="disc-pause-mark">
            <line x1="83" y1="76" x2="83" y2="104" />
            <line x1="97" y1="76" x2="97" y2="104" />
          </g>
        ) : (
          <path className="disc-play-mark" d="M82 73v34l27-17z" />
        )}
      </g>
    </svg>
  );
}

export function NowPlaying({
  song,
  playlistGroups,
  activePlaylistName,
  selectedPlaylistIds,
  currentTime,
  duration,
  isPlaying,
  onTogglePlaylistSelection,
}: NowPlayingProps) {
  const isDiscActive = Boolean(song && isPlaying);
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(false);
  const playlistPickerRef = useRef<HTMLDivElement>(null);
  const playbackPrefix = song ? (isPlaying ? '正在播放' : '已暂停') : '还没有开始';

  useEffect(() => {
    if (!playlistMenuOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!playlistPickerRef.current?.contains(event.target as Node)) {
        setPlaylistMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPlaylistMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [playlistMenuOpen]);

  return (
    <section className="now-playing" aria-label="当前播放">
      <div className="section-heading">
        <div>
          <p className="section-kicker">{song ? 'NOW PLAYING' : 'LOCAL LIBRARY'}</p>
          <h2>{song ? '当前播放' : '本地歌单'}</h2>
        </div>
        <span>{song ? `${formatDuration(currentTime)} / ${formatDuration(duration)}` : '待选择'}</span>
      </div>

      <div className="now-playing-body">
        <div className={isDiscActive ? 'album-orb is-active' : 'album-orb'} aria-hidden="true">
          <PlayerDiscMark isPlaying={isDiscActive} />
        </div>

        <div className="track-copy">
          <div className="track-playlist-picker" ref={playlistPickerRef}>
            <button
              className="playlist-picker-trigger"
              type="button"
              aria-label="选择播放范围"
              aria-expanded={playlistMenuOpen}
              onClick={() => setPlaylistMenuOpen((open) => !open)}
            >
              <span>
                {playbackPrefix} {activePlaylistName}
              </span>
              <ChevronDown aria-hidden="true" size={16} />
            </button>
            {playlistMenuOpen ? (
              <div className="playlist-picker-menu" role="group" aria-label="播放歌单">
                {playlistGroups.map((playlist) => (
                  <label
                    className={selectedPlaylistIds.includes(playlist.id) ? 'playlist-choice is-active' : 'playlist-choice'}
                    key={playlist.id}
                  >
                    <span className="playlist-choice-check">
                      <input
                        type="checkbox"
                        aria-label={`纳入播放 ${playlist.name}`}
                        checked={selectedPlaylistIds.includes(playlist.id)}
                        onChange={() => onTogglePlaylistSelection(playlist.id)}
                      />
                      <span className="playlist-choice-box" aria-hidden="true">
                        <Check size={12} />
                      </span>
                    </span>
                    <span className="playlist-choice-main">
                      <span>{playlist.name}</span>
                      <small>{playlist.songs.length} 首歌</small>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <h1>{song?.name ?? '还没有歌'}</h1>
        </div>
      </div>
    </section>
  );
}
