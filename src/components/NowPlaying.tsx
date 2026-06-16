import { Disc3 } from 'lucide-react';
import type { Song } from '../types/music';
import { formatDuration } from '../lib/format';
import { APP_BRAND } from '../config/brand';

interface NowPlayingProps {
  song: Song | null;
  currentTime: number;
  duration: number;
}

export function NowPlaying({ song, currentTime, duration }: NowPlayingProps) {
  return (
    <section className="now-playing" aria-label="当前播放">
      <div className="brand-line">
        <span>{APP_BRAND.displayName}</span>
        <span>LOCAL PLAYER</span>
      </div>

      <div className={song ? 'album-orb is-active' : 'album-orb'} aria-hidden="true">
        <Disc3 size={82} strokeWidth={1.45} />
      </div>

      <div className="track-copy">
        <p className="track-kicker">{song ? '正在播放' : '本地歌单'}</p>
        <h1>{song?.name ?? '还没有歌'}</h1>
        <p>{song ? `${formatDuration(currentTime)} / ${formatDuration(duration)}` : '从手机里选几首歌'}</p>
      </div>
    </section>
  );
}
