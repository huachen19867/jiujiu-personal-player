# 99新自用唱机

很多歌手的歌，在众所周知的平台上不一定能下载或方便播放，所以肯定会有人需要一个专门播“手机本地音频”的播放器。

但市面上很多现成播放器要么山寨、要么粗糙、要么广告多、权限重。所以我想做一个干净、好看、手机端能用、专门播放本地歌曲的播放器。

这是一个自用 Android 本地音乐播放器项目。主工程使用 Vite + React + TypeScript，手机安装包由 Capacitor Android 封装；桌面网页端主要用于调试和补充适配。

## 主要功能

- 本地音乐播放：支持从手机本地选择音频文件并播放。
- 多歌单管理：可以把歌曲放进不同歌单，切换查看和播放范围。
- 自动读取本地：用于读取手机媒体库里的本地音频，适合几千首歌的大歌库。
- 基础播放控制：播放、暂停、上一首、下一首、进度、音量、顺序播放和随机播放。
- 后台播放能力：Android 端接入原生播放、媒体通知和前台播放服务。
- 问题反馈：应用内提供微信公众号和 GitHub 链接。

## 第一次使用

1. 安装 APK 后打开 App。
2. 点歌单卡片上的加号添加歌曲；如果本地歌曲很多，优先进入“自动读取本地”歌单读取媒体库。
3. 点歌曲左侧播放按钮开始播放。
4. 需要分组时，切换到下一个歌单再添加歌曲。
5. 在“当前播放”区域可以选择参与连续播放的歌单范围。

## 大歌库说明

手动文件选择器不适合一次选择几千首歌。Android 系统文件选择器会把大量 URI 一次性交给 App，容易造成 WebView 卡顿甚至黑屏。

现在手动多选超过保护上限时，App 会直接提示使用“自动读取本地”。“自动读取本地”走 Android MediaStore 查询，适合 4000 首这类大歌库。

## 本地开发

在项目目录里启动网页调试：

```bash
npm install
npm run dev
```

也可以在 `C:\AI\设计\自用99新唱机` 里双击 `start-player.cmd`，它会启动本地开发服务并打开 `http://127.0.0.1:5173/`。

## Android App

当前项目已接入 Capacitor Android。网页端仍是主工程，Android 原生工程在 `android/` 目录。每次修改播放器后，先构建网页产物，再同步到 Android：

```bash
npm run android:sync
```

如果本机装有 Android Studio，可以打开原生工程：

```bash
npm run android:open
```

如果本机装有 JDK 和 Android SDK，可以生成 debug APK：

```bash
npm run android:apk
```

调试 APK 会复制到：

- `C:\AI\Android\jiujiu-personal-player-debug.apk`
- `C:\AI\Android\jiujiu-personal-player-v1.0.20-debug.apk`

## 编码和提交

本仓库中文文档和源码统一使用 UTF-8。推送前建议跑：

```bash
npm run check:encoding
npm test -- --run
npm run build
```

`npm run check:encoding` 会扫描 Git 跟踪的文本文件，提前拦住 README 这类中文乱码文件，避免推到 GitHub 后才发现。

## 项目记录

- 发布和分发说明：`docs/release-and-distribution.md`
- 技术日志：`docs/tech-log/tech-log.md`

## 仓库

GitHub 地址：<https://github.com/huachen19867/jiujiu-personal-player>
