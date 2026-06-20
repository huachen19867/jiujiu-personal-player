# 99新自用唱机

自用 Android 本地音乐播放器项目。主工程使用 Vite + React + TypeScript，手机安装包由 Capacitor Android 封装；桌面端只作为调试和补充适配。

## 快速进入

在 `C:\AI\设计\自用99新唱机` 里双击 `start-player.cmd`，它会启动本地开发服务并打开 `http://127.0.0.1:5173/`。

## 手机 App

当前项目已接入 Capacitor Android。网页端仍是主工程，Android 原生工程在 `android/` 目录；每次修改播放器后，先构建网页产物，再同步到 Android：

```bash
npm run android:sync
```

如果本机装有 Android Studio，可打开原生工程：

```bash
npm run android:open
```

如果本机装有 JDK 和 Android SDK，可尝试生成 debug APK：

```bash
npm run android:apk
```

当前调试 APK 会复制到两个位置：

- `C:\AI\Android\jiujiu-personal-player-debug.apk`
- `C:\AI\Android\jiujiu-personal-player-v1.0.6-debug.apk`

优先把带版本号的文件发到 Android 手机，允许“安装未知来源应用”即可安装打开。后续每次发包都要递增 Android `versionCode`，否则部分手机可能不会把新包稳定识别为覆盖升级。

当前推荐路线是先做 Android；iOS 需要 macOS + Xcode，后续再单独处理。

更多发布、更新、GitHub Release 和下载网站取舍见 `docs/release-and-distribution.md`。

## 首版范围

- PWA 播放器，最终以手机端窄屏触控体验为主，同时保留桌面调试布局。
- Android App 内支持原生多选音频文件；网页/桌面调试环境回退到浏览器多选文件。
- 支持多歌单分离：当前歌单选过歌后，自动露出下一个空歌单。
- 支持播放、暂停、上一首、下一首、进度拖动、音量、顺序/循环/随机模式。
- 支持当前播放高亮、移除歌曲、清空列表。
- 播放列表元数据可保存到浏览器本地；音频文件本体不上传、不长期保存。

## 已知边界

Android App 内选歌与播放已经优先走原生能力：多选使用 `ACTION_OPEN_DOCUMENT`，播放使用 Android `MediaPlayer`，因此比单纯 WebView `<audio>` 更适合手机端。当前还没有做通知栏/锁屏媒体控制与前台服务；如果应用被系统强杀或从任务列表划掉，后台播放仍可能停止。

## 项目记录

- 设计说明：`docs/superpowers/specs/2026-06-14-local-music-pwa-design.md`
- 实现计划：`docs/superpowers/plans/2026-06-14-local-music-pwa.md`
- 发布说明：`docs/release-and-distribution.md`
- 技术日志：`docs/tech-log/tech-log.md`
