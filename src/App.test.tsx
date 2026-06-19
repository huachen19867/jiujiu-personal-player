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
    Object.defineProperty(globalThis, 'Capacitor', {
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
    expect(screen.getByLabelText('选歌，可多选')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '文件夹导入暂不可用' })).toBeDisabled();
    expect(screen.getByRole('navigation', { name: '个人导航' })).toBeInTheDocument();
    expect(screen.getByText('公众号：待填写')).toBeInTheDocument();
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

    await user.upload(screen.getByLabelText('选歌，可多选'), [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
      new File(['text'], 'notes.txt', { type: 'text/plain' }),
      new File(['audio'], 'Late Night.flac', { type: '' }),
    ]);

    const playlist = screen.getByRole('list', { name: '播放列表' });
    expect(await within(playlist).findByText('Blue Monday')).toBeInTheDocument();
    expect(within(playlist).getByText('Late Night')).toBeInTheDocument();
    expect(within(playlist).queryByText('notes')).not.toBeInTheDocument();
  });

  it('uses the Android native multi picker when it is available', async () => {
    const user = userEvent.setup();
    const pickAudioFiles = vi.fn().mockResolvedValue({
      songs: [
        {
          id: 'native-one',
          name: '白嫁衣.mp3',
          type: 'audio/ffmpeg',
          size: 4096,
          uri: 'content://media/audio/1',
        },
        {
          id: 'native-two',
          name: '青花瓷.mp3',
          type: 'audio/ffmpeg',
          size: 8192,
          uri: 'content://media/audio/2',
        },
      ],
    });
    Object.defineProperty(globalThis, 'Capacitor', {
      configurable: true,
      value: {
        Plugins: {
          LocalMusicPicker: { pickAudioFiles },
        },
      },
    });

    render(<App />);

    await user.click(screen.getByRole('button', { name: '选歌，可多选' }));

    expect(pickAudioFiles).toHaveBeenCalled();
    const playlist = screen.getByRole('list', { name: '播放列表' });
    expect(await within(playlist).findByText('白嫁衣')).toBeInTheDocument();
    expect(within(playlist).getByText('青花瓷')).toBeInTheDocument();
  });

  it('cycles playback mode from the transport controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText('选歌，可多选'), [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
    ]);

    const modeButton = screen.getByRole('button', { name: '播放模式：顺序播放' });
    await user.click(modeButton);

    expect(screen.getByRole('button', { name: '播放模式：列表循环' })).toBeInTheDocument();
  });

  it('switches the album center mark only while playback is active', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    expect(container.querySelector('.disc-play-mark')).toBeInTheDocument();
    expect(container.querySelector('.disc-pause-mark')).not.toBeInTheDocument();

    await user.upload(screen.getByLabelText('选歌，可多选'), [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Blue Monday' })).toBeInTheDocument();
    expect(container.querySelector('.disc-play-mark')).toBeInTheDocument();
    expect(container.querySelector('.disc-pause-mark')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '播放' }));

    expect(await screen.findByText('正在播放')).toBeInTheDocument();
    expect(container.querySelector('.disc-pause-mark')).toBeInTheDocument();
    expect(container.querySelector('.disc-play-mark')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '暂停' }));

    expect(await screen.findByText('已暂停')).toBeInTheDocument();
    expect(container.querySelector('.disc-play-mark')).toBeInTheDocument();
    expect(container.querySelector('.disc-pause-mark')).not.toBeInTheDocument();
  });

  it('asks for confirmation before removing a track from the playlist', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);

    await user.upload(screen.getByLabelText('选歌，可多选'), [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
      new File(['audio'], 'Late Night.flac', { type: '' }),
    ]);

    const playlist = screen.getByRole('list', { name: '播放列表' });
    await user.click(within(playlist).getByRole('button', { name: '移除 Blue Monday' }));

    expect(confirm).toHaveBeenCalledWith('确定要删除「Blue Monday」吗？');
    expect(within(playlist).getByText('Blue Monday')).toBeInTheDocument();

    confirm.mockReturnValue(true);
    await user.click(within(playlist).getByRole('button', { name: '移除 Blue Monday' }));

    expect(within(playlist).queryByText('Blue Monday')).not.toBeInTheDocument();
    expect(within(playlist).getByText('Late Night')).toBeInTheDocument();
  });

  it('removes selected tracks after confirmation', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    await user.upload(screen.getByLabelText('选歌，可多选'), [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
      new File(['audio'], 'Late Night.flac', { type: '' }),
      new File(['audio'], 'Third Song.wav', { type: 'audio/wav' }),
    ]);

    await user.click(screen.getByRole('button', { name: '多选' }));
    await user.click(screen.getByRole('checkbox', { name: '选择 Blue Monday' }));
    await user.click(screen.getByRole('checkbox', { name: '选择 Late Night' }));
    await user.click(screen.getByRole('button', { name: '删除所选 2 首' }));

    expect(confirm).toHaveBeenCalledWith('确定要删除选中的 2 首歌吗？');
    const playlist = screen.getByRole('list', { name: '播放列表' });
    expect(within(playlist).queryByText('Blue Monday')).not.toBeInTheDocument();
    expect(within(playlist).queryByText('Late Night')).not.toBeInTheDocument();
    expect(within(playlist).getByText('Third Song')).toBeInTheDocument();
  });

  it('keeps selected tracks when batch deletion is canceled', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);

    await user.upload(screen.getByLabelText('选歌，可多选'), [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
      new File(['audio'], 'Late Night.flac', { type: '' }),
    ]);

    await user.click(screen.getByRole('button', { name: '多选' }));
    await user.click(screen.getByRole('checkbox', { name: '选择 Blue Monday' }));
    await user.click(screen.getByRole('button', { name: '删除所选 1 首' }));

    const playlist = screen.getByRole('list', { name: '播放列表' });
    expect(within(playlist).getByText('Blue Monday')).toBeInTheDocument();
    expect(within(playlist).getByText('Late Night')).toBeInTheDocument();
  });
});
