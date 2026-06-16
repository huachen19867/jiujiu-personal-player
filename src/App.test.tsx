import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

class FakeAudio {
  src = '';
  currentTime = 0;
  duration = 180;
  volume = 1;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('Audio', FakeAudio);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      configurable: true,
      value: undefined,
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the empty-state local import actions', () => {
    render(<App />);

    expect(screen.getByText('99新自用唱机')).toBeInTheDocument();
    expect(screen.getByLabelText('选歌')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导入文件夹' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '还没有歌' })).toBeInTheDocument();
  });

  it('shows that a saved playlist needs file reauthorization after refresh', () => {
    localStorage.setItem(
      'jiujiu-personal-player-library-v1',
      JSON.stringify({
        songs: [{ id: 'stored', name: 'Stored Track', type: 'audio/mpeg', size: 123 }],
        currentSongId: 'stored',
        playbackMode: 'sequence',
        volume: 0.85,
      }),
    );

    render(<App />);

    expect(screen.getByText('上次歌单有 1 首，重新选歌授权后才能播放。')).toBeInTheDocument();
    expect(localStorage.getItem('jiujiu-personal-player-library-v1')).toContain('Stored Track');
  });

  it('adds selected local audio files to the playlist', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText('选歌'), [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
      new File(['text'], 'notes.txt', { type: 'text/plain' }),
      new File(['audio'], 'Late Night.flac', { type: '' }),
    ]);

    const playlist = screen.getByRole('list', { name: '播放列表' });
    expect(await within(playlist).findByText('Blue Monday')).toBeInTheDocument();
    expect(within(playlist).getByText('Late Night')).toBeInTheDocument();
    expect(within(playlist).queryByText('notes')).not.toBeInTheDocument();
  });

  it('cycles playback mode from the transport controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText('选歌'), [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
    ]);

    const modeButton = screen.getByRole('button', { name: '播放模式：顺序播放' });
    await user.click(modeButton);

    expect(screen.getByRole('button', { name: '播放模式：列表循环' })).toBeInTheDocument();
  });

  it('removes a track from the playlist', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText('选歌'), [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
      new File(['audio'], 'Late Night.flac', { type: '' }),
    ]);

    const playlist = screen.getByRole('list', { name: '播放列表' });
    await user.click(within(playlist).getByRole('button', { name: '移除 Blue Monday' }));

    expect(within(playlist).queryByText('Blue Monday')).not.toBeInTheDocument();
    expect(within(playlist).getByText('Late Night')).toBeInTheDocument();
  });

  it('shows a fallback message when folder import is unsupported', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '导入文件夹' }));

    expect(screen.getByText('当前浏览器不支持文件夹导入，请改用选歌多选。')).toBeInTheDocument();
  });
});
