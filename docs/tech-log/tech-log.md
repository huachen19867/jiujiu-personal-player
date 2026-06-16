# 2026-06-14 技术日志

## 本地音乐播放器首版决策

工作区：`C:\AI\设计\陈话音乐`

初始状态：目录为空，不是 git 仓库。由于没有仓库，设计文档和实现计划暂时只能落盘，不能提交。后续如果要维护版本，需要先 `git init` 再补首次提交。

首版选择 Vite + React + TypeScript 做手机端 PWA，不直接做 Android APK。判断原因是本地多选音频和播放主线可以直接用浏览器能力验证，封装 App 会提前引入权限、构建链和真机安装成本。

本地导入采用双入口：手动多选文件作为稳定主路径，导入文件夹作为能力增强。文件夹导入依赖 `showDirectoryPicker` 和 File System Access API，移动端兼容性不稳定，所以必须有多选文件兜底。

持久化只保存歌单元数据和偏好，不保存音频文件本体，也不假设刷新后还能直接播放。原因是 `File` 对象和 object URL 只适合当前会话，移动浏览器对持久文件句柄、存储额度和隐私授权差异很大。

测试边界：纯函数优先覆盖音频过滤、队列规则和存储恢复；Hook 覆盖播放状态和列表变更；组件测试覆盖空列表、导入入口、模式切换和移除歌曲；最后用移动视口浏览器检查控件是否重叠。

# 2026-06-15 技术日志

## CC 可用性与播放器收尾验证

`cc -p --permission-mode dontAsk` 已能正常返回，最小探针输出 `CC_OK`。本机 `cc` 依赖 `C:\AI\设计\CC switch\app\cc-switch.exe` 提供的 `127.0.0.1:15721` 代理；代理运行时请求可完成，代理未运行时会反复连接 `/v1/messages`，表现为长时间卡住。PowerShell 5 里给 `cc` 传中文前需要设置 UTF-8 输出编码，否则中文会变成问号。

本轮让 `cc` 对播放器做了只读审查，实际采纳两项：多批导入同名歌曲会生成重复 `id`，以及 `@rollup/rollup-win32-x64-msvc` 不应作为项目直接依赖。`useMusicPlayer` 里 `isPlaying` 未加入切歌 effect 依赖这一条没有直接按建议改，因为把它加入依赖会在播放状态变化时重跑 effect，可能导致当前音频被重置；后续如果要整理这块，应该改为显式的 autoplay ref 或拆分 effect，并用回归测试保护。

重复 `id` 的根因是 `createSongsFromFiles` 每次调用都从数组下标 0 生成 `local-0-name`。修复方式是在 `src/lib/musicFiles.ts` 里优先使用 `crypto.randomUUID()`，不可用时使用时间戳加递增序列兜底，同时保留文件名 slug 方便调试。新增回归测试覆盖“分两次导入相同文件名时 id 不相同”。

验证结果：

- `npm test -- --run`：6 个测试文件、25 条用例通过。
- `npm run build`：TypeScript 和 Vite 8.0.16 生产构建通过，PWA service worker 正常生成。
- `npm audit`：0 vulnerabilities。
- Browser 移动视口 `390x844` 检查：页面无横向溢出，导入按钮和播放控件可见，文件夹导入失败时能显示回退提示。

已知边界：文件夹导入依赖浏览器的 File System Access API。部分手机浏览器没有该能力，或者自动化环境能看到 API 但调用失败，所以手动多选文件仍然是稳定主路径。

## 本地启动入口

新增 `start-player.cmd` 作为 Windows 双击入口。它在项目根目录执行，先检查 `127.0.0.1:5173` 是否已有监听；如果没有，就用 `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` 启动 Vite；随后打开 `http://127.0.0.1:5173/`。适用边界是本机已安装 Node.js/npm，且项目依赖已经通过 `npm install` 安装过。

## 播放器全链路改名

播放器名称定为“99新自用唱机”。用户可见品牌名集中到 `src/config/brand.ts` 的 `APP_BRAND.displayName`，PWA 短名使用“99新唱机”，npm 包名和浏览器存储 key 使用 ASCII 标识 `jiujiu-personal-player` / `jiujiu-personal-player-library-v1`，避免中文包名或 key 在工具链中带来兼容风险。

改名覆盖入口包括 `index.html` 标题和描述、`vite.config.ts` PWA manifest 与 `zh-CN` 语言标记、`src/components/NowPlaying.tsx` 顶部品牌、`src/lib/storage.ts` 本地存储 key、`public/manifest-icon.svg` 可访问名称、`package.json` 与 `package-lock.json` 包名、`README.md` 和 `start-player.cmd` 错误提示。新增回归点：`src/App.test.tsx` 锁定界面品牌名，`src/lib/storage.test.ts` 锁定新的 storage key。

本轮尝试让 `cc` 做只读优化建议审查时 30 秒超时，符合此前“代理未稳时会卡住”的边界；后续涉及较长审查可以先用 `cc -p` 最小探针确认代理可用，再交给它做辅助判断。

## 项目优化体检

本轮目标是回答“项目还有哪些地方可以优化”，未修改源码，只做只读审查、验证和日志沉淀。当前项目仍不是 git 仓库，根目录也没有 `.gitignore`，因此如果后续进入持续迭代，第一优先级应是初始化版本管理，并明确忽略 `node_modules/`、`dist/`、本地 Vite 日志等生成或运行产物。

验证结果：`npm test -- --run` 通过，6 个测试文件、25 条用例全绿；`npm run build` 通过，Vite 生产构建和 PWA service worker 正常生成；`npm audit --audit-level=moderate` 返回 0 vulnerabilities。`cc -p --permission-mode dontAsk` 只读优化审查请求 60 秒超时，仍符合此前记录的代理不稳边界，后续长审查前应先做 `CC_OK` 最小探针。

代码层面最值得优先看的点是持久化恢复体验：`useMusicPlayer` 读取了 `loadLibraryState()`，但当前只恢复音量和播放模式，`songs` 初始仍为空；同时保存 effect 会在挂载后把空歌单写回 localStorage，可能覆盖之前保存的元数据。由于音频 `File` 不能跨会话长期持有，合理目标不是自动恢复播放，而是在刷新后展示“上次歌单记录，需要重新授权文件”的状态，或者明确只保存偏好、不保存歌单，并同步调整 README、设计说明和测试。

产品体验层面可继续补：真实手机导入大批文件时的加载状态、目录递归导入失败时的更细原因提示、长歌单搜索/定位、当前播放歌曲滚动到可见区域、以及媒体会话能力（锁屏/通知栏标题与播放控制）。这些都不影响首版可用性，但会明显提升自用播放器的长期顺手程度。

工程维护层面可补 lint/format/typecheck 脚本拆分和 CI 思路。当前 `build` 已包含 `tsc -b`，但没有单独 `typecheck`、`lint`、`format` 命令；当项目继续加歌词、封面、媒体会话或安装包阶段时，单靠测试和手动浏览器检查会越来越吃力。适用边界是：首版小项目可以先不引入复杂规范，但进入第二阶段前应补最小工程护栏。

### Claude 入口补测

老板提示 `claude` 入口也能调 CC 后，补测发现：`claude --help` 正常返回，`claude -p --permission-mode dontAsk "只输出 CLAUDE_OK"` 约 6 秒返回 `CLAUDE_OK`，说明 `claude` 命令本身可用。使用 `claude -p --permission-mode dontAsk` 让它自行做完整只读项目审查时 120 秒超时，和 `cc` 的长审查卡住表现类似；但用 `claude -p --permission-mode dontAsk --tools=` 并在 prompt 中直接提供项目摘要时，约 14 秒可返回优化建议。

后续适用边界：需要 Claude/CC 参与时，先跑最小探针；如果长审查超时，可改为由当前助手先收集文件摘要，再用 `claude --tools=` 做无工具辅助判断。对它关于“刷新后无缝继续播放”的建议要谨慎采纳，因为浏览器本地 `File` 授权和 object URL 不能可靠跨会话持久化，合理方案应是“恢复元数据并提示重新授权”或“明确只保存偏好”。

# 2026-06-16 技术日志

## 优化复查与工具入口验证

本轮目标是重新找一遍“99新自用唱机”的优化点。当前工作区为 `C:\AI\设计\自用99新唱机`，仍不是 git 仓库；README 的快速进入路径已从旧目录 `C:\AI\设计\陈话音乐` 修正为当前目录，避免后续启动指引误导。

验证命令与结果：`npm test -- --run` 通过，6 个测试文件、25 条用例全绿；`npm run build` 通过，产物约 `205.22 KiB` 预缓存；`npm audit --audit-level=moderate` 返回 0 vulnerabilities；Browser 后台移动视口 `390x844` 检查无横向溢出，首屏按钮和播放控件可见，控制台未见 warn/error。

`claude --help` 能正常返回，说明 claudecode 入口存在；但 `claude -p --permission-mode dontAsk --tools= "只输出 CLAUDE_OK"` 与 `cc -p --permission-mode dontAsk --tools= "只输出 CC_OK"` 本轮分别在 30 秒和 60 秒内超时，判断仍是模型请求链路/代理不稳，不适合作为本轮审查主依据。ZCode 入口位于 `C:\AI\Zai\ZCode\ZCode.exe`，开始菜单快捷方式存在；用隐藏窗口探针调用 `--version` 时会启动桌面主程序而不是 CLI 快速返回，5 秒后已停止探针进程。日志显示当前 ZCode 为 `3.0.1`，本机已有 `3.1.0` 更新包待安装；这属于工具环境优化，不能在项目任务中自动安装。

优先优化判断：第一优先级仍是持久化恢复语义。`useMusicPlayer` 读取了 `loadLibraryState()`，但只使用音量和播放模式；`songs` 初始为空，挂载后的保存 effect 会把空歌单写回 localStorage，可能覆盖上次保存的歌曲元数据。合理方案不是恢复 object URL 自动播放，而是二选一：要么恢复元数据并显示“需要重新授权文件”的待恢复列表，要么明确改成只保存偏好，并删除“歌单元数据可保存”的产品承诺。实施时应补测试：已有 localStorage 时首次挂载不得误清空保存记录。

第二优先级是歌单点击语义。`Playlist` 的按钮可访问名称是“播放 某歌”，但 `playSong` 当前只设置 `currentIndex`，在暂停状态下点击歌曲不会真正调用 `audio.play()`。后续修复可以把动作拆成“选择歌曲”和“选择并播放”，或引入显式 autoplay ref，避免把 `isPlaying` 直接塞进切歌 effect 依赖造成音频重置。需要补回归测试：暂停状态点击歌单播放按钮应启动播放；播放中切歌仍能继续播放且不重复重置。

工程护栏方面，项目已有测试、构建和审计，但缺少 `.gitignore`、git 初始提交、单独的 `typecheck`/`lint`/`format` 脚本。进入第二阶段（歌词、封面、媒体会话、安装包）前，应先补最小版本管理和格式检查；否则 `node_modules/`、`dist/`、本地 Vite/ZCode 探针日志这类生成物容易混入人工整理。

依赖方面，`npm outdated --json` 显示可评估的升级包括 `@vitejs/plugin-react` 6、`jsdom` 29、`lucide-react` 1、`typescript` 6，以及 `vitest` 4.1.9 patch。大版本升级可能改变编译、测试环境或图标导出，不建议混在产品优化里顺手做；比较稳的切法是先补 git，再单独开一次“依赖升级体检”，每升一组跑 `npm test -- --run` 和 `npm run build`。

体验增强可排在持久化和点歌语义之后：大批量目录导入时增加 loading/数量反馈和可取消状态；长歌单增加搜索或当前歌曲定位；播放中把当前歌曲滚入可见区域；补 Media Session API，让锁屏/通知栏显示标题并支持系统播放控制。CSS 里标题字号使用 `clamp(1.55rem, 8vw, 2.45rem)`，空列表移动视口实测无溢出，但后续处理极长歌名时建议改成更稳定的行数和容器约束。

## 持久化与点歌体验优化

本轮修复两个高优先级体验问题。第一，`useMusicPlayer` 首次挂载时不再把空的当前会话歌单直接覆盖到 localStorage；如果上次保存过歌单元数据，刷新后会保留记录，并在导入区提示“上次歌单有 N 首，重新选歌授权后才能播放”。这个设计继续遵守浏览器限制：不尝试持久化 `File` 或 object URL，只保留可序列化元数据和偏好。

第二，歌单行里的“播放某歌”按钮现在符合语义：暂停状态点击另一首歌会切换到该歌并调用 `audio.play()`；点击当前歌且未播放时也会启动播放。实现上使用 `playSelectedSongRef` 标记“下一次切歌后播放”，避免把 `isPlaying` 加进切歌 effect 依赖后造成音频源重复重置。

回归测试按 TDD 先红后绿补了 3 条：已有 localStorage 时首次挂载不得清空旧歌单元数据；刷新后界面显示重新授权提示；暂停状态从歌单点歌会真正播放。验证结果：`npm test -- src/hooks/useMusicPlayer.test.tsx --run` 8 条通过；`npm test -- src/App.test.tsx --run` 6 条通过；`npm test -- --run` 6 个测试文件、28 条用例全绿；`npm run build` 通过；`npm audit --audit-level=moderate` 返回 0 vulnerabilities。Browser 后台移动视口 `390x844` 冒烟检查无横向溢出、首屏控件可见、控制台未见 warn/error。Browser 的只读页面脚本环境无法写入 `localStorage`，所以“恢复提示带存储数据”的浏览器分支以组件测试覆盖为准。

工具辅助记录：本轮按要求调用了 claudecode 和 ZCode。`cc -p --permission-mode dontAsk --tools=` 在 180 秒预算内有响应，但输出停在其内部工具调用文本，不适合直接采纳；ZCode 位于 `C:\AI\Zai\ZCode\ZCode.exe`，隐藏窗口探针会启动桌面主程序而非 CLI 快速返回，5 秒后已停止探针进程。后续如果要让侧边栏 Claude Code 长时间审查，最好在 UI 里直接发任务并等待，不要依赖 `cc -p` 返回完整审查。

## 典雅黑胶视觉回调：去老年机感

本轮目标来自视觉反馈：上一版虽然保留了复古黑胶感，但黄铜色、窄手机壳、层层边框叠在一起后更像老年机/旧收音机，不如早期橙色元素有活力。因此本轮不再继续加重“怀旧”，而是把方向修正为黑漆唱机底色 + 暖橙交互点亮 + 桌面横向控制台。

主要修改集中在 `src/styles.css`，不改播放逻辑。关键判断是把颜色语义拆开：`--brass` 只保留给唱臂、唱片标签等装饰细节，新增 `--amber`/`--amber-hot` 承担播放按钮、导入按钮、进度条、当前播放行和可点击图标的交互语义。这样能留住黑胶的典雅，但避免所有东西都变成暗金铭牌。

布局上，移动端继续单列，但桌面端从固定约 430px 的手机壳改为约 980px 的双栏控制台：左侧是当前播放、导入和播放控制，右侧是歌单。这个改动解决了宽屏截图里“中间一台小设备”的问题，也更符合桌面本地播放器的使用场景。标题字体从偏老派的衬线回到更利落的无衬线，并移除了 `vw` 字号缩放，避免长标题和不同视口下出现不可控比例。

工具辅助记录：本轮 `claude -p` 局部只读审查在约 64 秒内返回，建议集中在恢复暖橙交互色、唱片中心暖色面积、当前曲目左侧橙色指示等点，已采纳其中适合当前方向的部分。ZCode `--version` 探针仍会启动 GUI 主程序而非 CLI 快速返回，5 秒后停止，不能作为自动审查结果来源。

验证结果：`npm test -- --run` 通过，6 个测试文件、28 条用例全绿；`npm run build` 通过，Vite/PWA 产物正常生成；`npm audit --audit-level=moderate` 返回 0 vulnerabilities。Browser 后台验证桌面 `1365x768` 与移动 `390x844` 两个视口均无横向溢出，控制台无 warn/error；桌面布局实际命中 `"player playlist" "import playlist" "transport playlist"` 双栏网格，移动端保持单列。

## 恢复橙色初版方向

老板继续反馈“完全不如最初一版”后，判断上一轮“典雅黑胶”方向本身就跑偏了：问题不只是颜色轻重，而是把“黑胶”从品牌隐喻误当成了界面主体，导致唱臂、实体唱机、横向控制台这些拟物元素不断覆盖掉最初橙色播放器的直接感。后续再做视觉优化时，除非明确要求，不应继续往实体唱机拟物上加码。

当前项目没有 git 仓库，也没有可直接恢复的旧 CSS 备份；`rg` 检查只找到当前 `src/styles.css` 和 manifest 图标里的橙色线索。因此本轮按现有 React 结构重建接近初版的橙黑移动播放器：`src/components/NowPlaying.tsx` 恢复使用 `lucide-react` 的 `Disc3` 图标，删除唱臂、唱片标签、唱针等 DOM；`src/styles.css` 整体回到橙色主视觉、深色面板、单列手机播放器布局。

视觉边界记录：橙色可以大面积出现在当前播放卡片和主播放按钮上，这是初版气质的核心；黑胶只保留为轻量唱片图标和纹理，不再做真实唱机。桌面端也恢复为居中的移动播放器形态，不再改成横向双栏控制台。这个选择牺牲一点桌面信息密度，但更贴近用户明确认可的版本。

工具辅助记录：`claude -p` 最小判断可正常返回，并确认应停止黑胶拟物、恢复早期橙色移动播放器方向；ZCode `--version` 探针仍会启动 GUI，5 秒后停止，不能作为 CLI 审查来源。

验证结果：`npm test -- --run` 通过，6 个测试文件、28 条用例全绿；`npm run build` 通过，CSS 产物约 `7.05 KiB`；`npm audit --audit-level=moderate` 返回 0 vulnerabilities；`rg "turntable|tonearm|record|vw|clamp\\(" src` 无命中，确认唱机拟物样式和视口字号缩放已撤掉。Browser 后台验证移动 `390x844` 和桌面 `1365x768` 均无横向溢出、控制台无 warn/error；DOM 中 `.turntable-deck`、`.tonearm`、`.record` 均不存在。

## Git 仓库初始化

本轮把项目从普通目录初始化为 Git 仓库，主分支使用 `main`。初始化前确认当前目录不是 Git 仓库，并检查了根目录生成物：`node_modules/`、`dist/`、`.vite-dev.log`、`.vite-dev.err.log` 都存在但不应纳入版本管理。

新增 `.gitignore`，忽略依赖、生产构建、Vite 本地日志、覆盖率、环境文件、编辑器目录和系统杂项；用 `git check-ignore -v node_modules dist .vite-dev.log .vite-dev.err.log` 验证规则命中。新增 `.gitattributes`，源码和文档默认固定 LF，`*.cmd` 使用 CRLF，避免 Windows 上后续出现大面积无意义行尾变更。

提交前验证：`npm test -- --run` 通过，6 个测试文件、28 条用例全绿；`npm run build` 通过，Vite/PWA 产物正常生成但由 `.gitignore` 排除；`npm audit --audit-level=moderate` 返回 0 vulnerabilities。首次提交应只包含源码、配置、文档、测试与启动脚本，不包含 `node_modules/`、`dist/` 和本地运行日志。
