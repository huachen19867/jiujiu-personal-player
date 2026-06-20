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

function fileInputFor(playlistName = '歌单一') {
  return screen.getByLabelText(`给${playlistName}添加歌曲`);
}

async function revealPlaylistActions(user: ReturnType<typeof userEvent.setup>, playlistName = '歌单一') {
  await user.click(screen.getByRole('button', { name: `查看 ${playlistName}` }));
}

async function uploadFilesToPlaylist(
  user: ReturnType<typeof userEvent.setup>,
  files: File[],
  playlistName = '歌单一',
) {
  await revealPlaylistActions(user, playlistName);
  await user.upload(fileInputFor(playlistName), files);
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

  it('renders the empty-state local import actions', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('99新自用唱机')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '歌单切换' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看 歌单一' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '本地导入' })).not.toBeInTheDocument();
    expect(screen.queryByText(/添加到：/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('给歌单一添加歌曲')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重命名 歌单一' })).not.toBeInTheDocument();

    await revealPlaylistActions(user);

    expect(screen.getByLabelText('给歌单一添加歌曲')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重命名 歌单一' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /文件夹导入/ })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '问题反馈' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '问题反馈' })).toBeInTheDocument();
    expect(screen.queryByText('微信公众号：陈化AI札记')).not.toBeInTheDocument();
    expect(screen.queryByText('个人导航')).not.toBeInTheDocument();
    expect(screen.queryByText(/\+----------------/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '还没有歌' })).toBeInTheDocument();
    expect(
      screen
        .getByRole('region', { name: '播放控制' })
        .compareDocumentPosition(screen.getByRole('region', { name: '歌单切换' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('hides playlist actions after tapping outside the switcher', async () => {
    const user = userEvent.setup();
    render(<App />);

    await revealPlaylistActions(user);
    expect(screen.getByLabelText('给歌单一添加歌曲')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重命名 歌单一' })).toBeInTheDocument();

    await user.click(screen.getByText('99新自用唱机'));

    expect(screen.queryByLabelText('给歌单一添加歌曲')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重命名 歌单一' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看 歌单一' })).toBeInTheDocument();
  });

  it('opens the feedback contact card from the bottom profile panel', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: '问题反馈' }));

    expect(screen.getByText('微信公众号是：')).toBeInTheDocument();
    expect(screen.getByText('陈化AI札记')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '陈化AI札记微信公众号二维码' })).toHaveAttribute(
      'src',
      '/feedback-qr.jpg',
    );
    await user.click(screen.getByRole('button', { name: '复制公众号名' }));
    expect(writeText).toHaveBeenCalledWith('陈化AI札记');

    expect(screen.getByText('GitHub链接')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'https://github.com/huachen19867/jiujiu-personal-player' }),
    ).toHaveAttribute('href', 'https://github.com/huachen19867/jiujiu-personal-player');

    await user.click(screen.getByRole('button', { name: '复制 GitHub 链接' }));

    expect(writeText).toHaveBeenCalledWith('https://github.com/huachen19867/jiujiu-personal-player');
    expect(screen.getByRole('button', { name: '已复制 GitHub 链接' })).toBeInTheDocument();
  });

  it('keeps feedback links usable when clipboard permission is blocked', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: '问题反馈' }));
    await user.click(screen.getByRole('button', { name: '复制 GitHub 链接' }));

    expect(screen.queryByText('复制失败')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '长按复制 GitHub 链接' })).toBeInTheDocument();
    expect(screen.getByText('复制不成功时，长按链接手动复制。')).toBeInTheDocument();
  });

  it('restores Android native songs after refresh', async () => {
    localStorage.setItem(
      'jiujiu-personal-player-library-v1',
      JSON.stringify({
        songs: [
          {
            id: 'stored-native',
            name: '白嫁衣',
            type: 'audio/mpeg',
            size: 123,
            source: 'android-native',
            nativeUri: 'content://media/audio/stored-native',
          },
        ],
        currentSongId: 'stored-native',
        playbackMode: 'sequence',
        volume: 0.85,
      }),
    );

    render(<App />);

    const playlist = screen.getByRole('list', { name: '播放列表' });
    expect(await within(playlist).findByText('白嫁衣')).toBeInTheDocument();
    expect(screen.queryByText(/重新选歌授权/)).not.toBeInTheDocument();
  });

  it('adds selected local audio files to the playlist', async () => {
    const user = userEvent.setup();
    render(<App />);

    await uploadFilesToPlaylist(user, [
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

    await revealPlaylistActions(user);
    await user.click(screen.getByRole('button', { name: '给歌单一添加歌曲' }));

    expect(pickAudioFiles).toHaveBeenCalled();
    const playlist = screen.getByRole('list', { name: '播放列表' });
    expect(await within(playlist).findByText('白嫁衣')).toBeInTheDocument();
    expect(within(playlist).getByText('青花瓷')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '歌单一：2 首歌' })).toBeInTheDocument();
  });

  it('creates the next playlist after the current playlist receives songs', async () => {
    const user = userEvent.setup();
    const pickAudioFiles = vi
      .fn()
      .mockResolvedValueOnce({
        songs: [
          {
            id: 'native-one',
            name: '白嫁衣.mp3',
            type: 'audio/ffmpeg',
            size: 4096,
            uri: 'content://media/audio/1',
          },
        ],
      })
      .mockResolvedValueOnce({
        songs: [
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

    await revealPlaylistActions(user);
    await user.click(screen.getByRole('button', { name: '给歌单一添加歌曲' }));
    expect(await screen.findByRole('heading', { name: '歌单一：1 首歌' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看 歌单二' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '给歌单一添加歌曲' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重命名 歌单一' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '给歌单二添加歌曲' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重命名 歌单二' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '查看 歌单二' }));
    expect(screen.getByRole('heading', { name: '歌单二：0 首歌' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '给歌单二添加歌曲' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重命名 歌单二' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '给歌单一添加歌曲' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '给歌单二添加歌曲' }));
    expect(await screen.findByRole('heading', { name: '歌单二：1 首歌' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: '查看 歌单三' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '选择播放范围' }));
    const playbackRangeMenu = screen.getByRole('group', { name: '播放歌单' });
    expect(screen.getByRole('checkbox', { name: '纳入播放 歌单一' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '纳入播放 歌单三' })).not.toBeChecked();
    expect(within(playbackRangeMenu).queryByRole('button', { name: '查看 歌单三' })).not.toBeInTheDocument();
  });

  it('renames the active playlist from the playlist switcher', async () => {
    const user = userEvent.setup();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('古风');
    render(<App />);

    await uploadFilesToPlaylist(user, [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
    ]);
    await user.click(screen.getByRole('button', { name: '重命名 歌单一' }));

    expect(prompt).toHaveBeenCalledWith('重命名歌单', '歌单一');
    expect(screen.getByRole('button', { name: '查看 古风' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '古风：1 首歌' })).toBeInTheDocument();
    expect(screen.getByLabelText('给古风添加歌曲')).toBeInTheDocument();
  });

  it('collapses and expands the playlist without deleting songs', async () => {
    const user = userEvent.setup();
    render(<App />);

    await uploadFilesToPlaylist(user, [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
    ]);

    const playlistPanel = screen.getByRole('region', { name: '歌单' });
    expect(await within(playlistPanel).findByText('Blue Monday')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '折叠歌单' }));

    expect(within(playlistPanel).queryByText('Blue Monday')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '展开歌单' }));

    expect(within(playlistPanel).getByText('Blue Monday')).toBeInTheDocument();
  });

  it('can include another playlist for playback without interrupting the current song', async () => {
    const user = userEvent.setup();
    const pickAudioFiles = vi
      .fn()
      .mockResolvedValueOnce({
        songs: [
          {
            id: 'native-one',
            name: '白嫁衣.mp3',
            type: 'audio/ffmpeg',
            size: 4096,
            uri: 'content://media/audio/1',
          },
        ],
      })
      .mockResolvedValueOnce({
        songs: [
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

    await revealPlaylistActions(user);
    await user.click(screen.getByRole('button', { name: '给歌单一添加歌曲' }));
    await user.click(screen.getByRole('button', { name: '播放' }));
    expect(await screen.findByText('正在播放 歌单一')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '查看 歌单二' }));
    expect(screen.getByRole('button', { name: '给歌单二添加歌曲' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '给歌单二添加歌曲' }));

    await user.click(screen.getByRole('button', { name: '选择播放范围' }));
    await user.click(screen.getByRole('checkbox', { name: '纳入播放 歌单二' }));

    expect(screen.getByText('正在播放 歌单一')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '纳入播放 歌单二' })).toBeChecked();
  });

  it('closes the playback range menu after tapping outside it', async () => {
    const user = userEvent.setup();
    render(<App />);

    await uploadFilesToPlaylist(user, [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
    ]);

    await user.click(screen.getByRole('button', { name: '选择播放范围' }));
    expect(screen.getByRole('group', { name: '播放歌单' })).toBeInTheDocument();

    await user.click(screen.getByText('99新自用唱机'));

    expect(screen.queryByRole('group', { name: '播放歌单' })).not.toBeInTheDocument();
  });

  it('cycles playback mode from the transport controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    await uploadFilesToPlaylist(user, [
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

    await uploadFilesToPlaylist(user, [
      new File(['audio'], 'Blue Monday.mp3', { type: 'audio/mpeg' }),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Blue Monday' })).toBeInTheDocument();
    expect(container.querySelector('.disc-play-mark')).toBeInTheDocument();
    expect(container.querySelector('.disc-pause-mark')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '播放' }));

    expect(await screen.findByText('正在播放 歌单一')).toBeInTheDocument();
    expect(container.querySelector('.disc-pause-mark')).toBeInTheDocument();
    expect(container.querySelector('.disc-play-mark')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '暂停' }));

    expect(await screen.findByText('已暂停 歌单一')).toBeInTheDocument();
    expect(container.querySelector('.disc-play-mark')).toBeInTheDocument();
    expect(container.querySelector('.disc-pause-mark')).not.toBeInTheDocument();
  });

  it('asks for confirmation before removing a track from the playlist', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);

    await uploadFilesToPlaylist(user, [
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

    await uploadFilesToPlaylist(user, [
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

    await uploadFilesToPlaylist(user, [
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
