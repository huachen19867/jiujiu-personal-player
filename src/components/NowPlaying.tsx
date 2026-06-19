import type { Song } from '../types/music';
import { formatDuration } from '../lib/format';

interface NowPlayingProps {
  song: Song | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
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

export function NowPlaying({ song, currentTime, duration, isPlaying }: NowPlayingProps) {
  const isDiscActive = Boolean(song && isPlaying);

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
          <p className="track-kicker">{song ? (isPlaying ? '正在播放' : '已暂停') : '还没有开始'}</p>
          <h1>{song?.name ?? '还没有歌'}</h1>
          <p>{song ? '来自当前本地歌单' : '从本地选几首歌'}</p>
        </div>
      </div>
    </section>
  );
}
