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

# 2026-06-18 技术日志

## 降低橙色饱和度与覆盖面积

本轮目标来自视觉反馈：“颜色太重，太夕阳红”。判断问题不在于保留橙色识别，而是上一版把高饱和红橙同时用于页面背景、当前播放大卡、主按钮、导入按钮、当前行和焦点态，导致暖色覆盖面积过大且偏红。

修改集中在 `src/styles.css`，不改组件结构和播放逻辑。色板从 `#ff6a3d/#ff8a3d/#c43d24` 调整为低饱和杏橙 `#d98d58/#efb273/#8e5740`，并把正文背景的橙色光从 `0.22` 降到 `0.08`。当前播放卡不再整块红橙铺底，改为深灰蓝主底，只在左上保留 `rgba(217, 141, 88, 0.28)` 的轻微暖光。

交互色也同步收敛：导入按钮边框和背景透明度降低，主播放按钮保留杏橙渐变但阴影从红橙光改成更轻的暖色阴影，当前播放行高亮从 `0.16` 降到 `0.11`。这个边界适用于后续视觉迭代：橙色只做识别和交互，不再大面积当背景主色。

工具辅助记录：本轮按要求调用 claudecode 和 ZCode。`claude -p` 局部审查在 120 秒预算内超时，仍符合此前“长审查不稳定”的边界；ZCode `--version` 探针仍会启动 GUI，5 秒后停止，不能作为 CLI 审查来源。

验证结果：`npm test -- --run` 通过，6 个测试文件、28 条用例全绿；`npm run build` 通过，Vite/PWA 产物正常生成；`npm audit --audit-level=moderate` 返回 0 vulnerabilities；`rg` 检查确认旧高饱和红橙硬编码已清掉。Browser 后台验证移动与桌面视口均无横向溢出，控制台无 warn/error；本轮 Browser 截图捕获连续超时，因此视觉验收以 DOM 计算样式和页面指标为准，未声称完成截图验收。

## 页面外层改为白底

本轮根据反馈把页面背景改为白色。修改范围仍集中在 `src/styles.css`：`:root` 和 `body` 的背景改为 `#fff`，并关闭 `body::before` 的暗色纹理层；播放器本体的深色卡片、当前播放卡片和杏橙交互色保持不变，避免整套控件被白底洗平。

工具辅助记录：本轮 `claude -p` 最小建议 60 秒超时，ZCode `--version` 探针仍启动 GUI 并在 5 秒后停止；两者均未作为实现依据。

验证结果：`npm test -- --run` 通过，6 个测试文件、28 条用例全绿；`npm run build` 通过；`npm audit --audit-level=moderate` 返回 0 vulnerabilities。Browser 后台移动视口验证 `body.backgroundColor` 与根背景均为 `rgb(255, 255, 255)`，`body.backgroundImage` 为 `none`，`body::before` 为 `display: none`，页面无横向溢出，控制台无 warn/error。

## 参考 luoxiaoshan.cn 重做播放器 UI

本轮根据反馈“项目砍掉，重新做播放器”，不删除项目和播放逻辑，而是砍掉上一轮黑胶/老年机/重橙色视觉方向。参考站点为 `https://luoxiaoshan.cn/#articles`，提炼出的可复用设计语法是：浅灰白页面背景、白色内容卡片、细边框、中文衬线标题、内容型分区标题、小面积蓝色交互色、轻阴影和克制留白。不要复刻站点内容，只复用它的页面秩序和审美比例。

实现范围集中在 `src/App.tsx`、`src/components/NowPlaying.tsx` 和 `src/styles.css`。`App.tsx` 从固定手机壳 `.phone-stage` 改为站点式 `.player-page` + `.site-header` + `.player-layout`；桌面端为左侧当前播放/导入/控制、右侧歌单的双栏内容布局，移动端回到单列。`NowPlaying` 去掉品牌行拟物中心，改为分区标题、抽象小唱片和当前歌曲文案；黑胶只作为轻量符号，不再支配界面。

CSS 色板回到 `#f9fafb` 页面、`#ffffff` 卡片、`#111827/#4b5563/#9ca3af` 文本层级、`#2563eb` 交互色，卡片统一 8px 圆角和 `#e5e7eb` 细线。移动端首次检查发现当前播放卡过高，播放三键贴近首屏底部；后续把唱片符号和标题改为并排，卡片高度从约 318px 压到约 259px，让播放器操作区更早出现。

工具辅助记录：本轮延续使用 claudecode/ZCode 的边界判断。`claude -p` 已作为审美参考辅助但不能依赖侧边栏会话；ZCode `--version` 仍是启动 GUI 后停止，不能提供 CLI 审查输出。参考站外部页面的真实浏览器脚本一度超时，因此设计提炼以已抓取 HTML/CSS 和可访问页面视觉特征为依据。

验证结果：`npm test -- --run` 通过，6 个测试文件、28 条用例全绿；`npm run build` 通过，PWA 产物正常生成；`npm audit --audit-level=moderate` 返回 0 vulnerabilities。Vite 本轮因 5173 被占用自动使用 `http://127.0.0.1:5174/`；Browser 验证桌面 `1365x768` 命中双栏 `496.8px 583.2px`、移动 `390x844` 命中单栏 `351.2px`，两个视口均无横向溢出。控制台只有 `/favicon.ico` 404，不是应用运行错误。

## 手机端优先与唱片图标方向

本轮确认一个必须长期遵守的产品边界：`99新自用唱机` 最终使用场景是手机端，桌面端只作为调试、展示和补充适配。后续视觉修改、控件密度、首屏高度、按钮触控面积、图标尺寸，都应以 390px 和 320px 等窄屏视口为主要验收对象；桌面双栏不能反过来定义产品形态。

当前抽象唱片图标仍显笨重，后续替换时不要继续做传统黑胶拟物。更合适的方向是：轻量、白底、细线、适合手机端小尺寸识别；可以用“唱片/声波/圆形节奏/本地音乐”做隐喻，但避免金属唱臂、真实唱机、厚重暗色材质和大面积纹理。

飞书提示词库尝试记录：入口 `https://my.feishu.cn/wiki/XurXwatJPi7BQlkQSoZcENgonUd?fromScene=spaceOverview` 可通过 bot 解析到标题“提示词”、类型 `docx`、真实 token `ESgcdlJOJoOuHtxiTy1cUuYBnIg`；正文只有 `<sub-page-list ...>`，进一步搜索子页面需要 user 授权，当前未继续阻塞任务。后续若要系统引用库内样式，需要先完成 `docs +search` 或 wiki 子页面读取授权。

后续补充：子页 `https://my.feishu.cn/wiki/BjwmwSFAai5lZ0k0GFacZKrxnlf` 解析结果为多维表格 Base，标题“绘图提示词”，真实 `base-token` 为 `BeEcb6zT2aqLCdso82KcNLvZnlc`。用户完成 OAuth 后，`lark-cli auth check --scope "wiki:node:read base:app:read base:table:read base:field:read base:record:read search:docs:read"` 全部 granted；`插画` 表 `tbl3lrbGogbGr0BK` 可读，字段为“效果 / 小技巧 / 提示词 / 标签”。后续生成图标或视觉提示词时，可优先从 `插画` 表取“提示词”和“标签”字段做风格参考。

同轮环境判断：GitHub CLI 当前不可用不是登录问题，而是本机 PATH 中没有 `gh`。`where.exe gh` 返回未找到，`gh --version` 在 PowerShell 报“无法将 gh 项识别为 cmdlet、函数、脚本文件或可运行程序”。本机有 `winget`，如需启用 GitHub CLI，可安装 `GitHub.cli` 后再执行 `gh auth login`。

## 接入 pic 图标资源

本轮用户确认 `pic/` 里的三张图方向可用：`3.png` 更适合做 app 图标，`1.png` 和 `2.png` 更适合做播放器里的唱片/当前播放视觉。实现时保留 `pic/` 作为源素材目录，生成运行期资源到 `public/`，避免应用直接依赖临时素材路径。

当前落地选择：`pic/3.png` 生成 `public/icons/app-icon-192.png`、`public/icons/app-icon-512.png` 和 `public/favicon.png`；`pic/2.png` 经过内容边界裁切后生成 `public/player-disc.png`，用于 `NowPlaying` 当前播放卡片。`pic/1.png` 暂未接入，作为后续 app splash、封面变体或更大尺寸唱片图备用。

代码层面，`src/components/NowPlaying.tsx` 移除 `lucide-react` 的 `Disc3` 临时图标，改用 `/player-disc.png`；`src/styles.css` 取消整图旋转，改为轻微浮动，避免播放三角和声波一起旋转产生违和感。PWA 配置改为 png 图标，并把 `favicon.png`、`player-disc.png`、两个 app icon 加入 `includeAssets`，保证安装和离线缓存时资源完整。

后续根据动效反馈调整：静态 `player-disc.png` 无法让“大圆小圆中间两条曲线”独立旋转变色，也无法让左右音波动态跳动，因此当前播放图改为内联 SVG 组件 `PlayerDiscMark`。中间两条弧线使用 `disc-rotate` 旋转和 `arc-glow` 颜色/线宽呼吸，左右音波使用 `wave-pulse` 分段延迟跳动。`public/player-disc.png` 已从运行期资源中移除，`pic/2.png` 继续作为视觉参考源保留。

色彩也从蓝色体系改为接近 ColaOS 图标的浅橙：`--accent` 为 `#f4772a`，`--accent-strong` 为 `#e85f1b`，`--accent-soft` 为 `#fff3e8`，`--accent-muted` 为 `#f8b17a`。按钮、进度条、导入图标、播放模式、歌单当前行、焦点态和分区 kicker 统一走这套橙色。`pic/3.png` 生成的 PWA 图标和 favicon 也做了蓝色像素到浅橙的替换，避免安装图标仍残留蓝点。

再次修正动效边界：唱机动效必须绑定真实播放状态，而不是有歌就动。`App.tsx` 将 `player.isPlaying` 传给 `NowPlaying`，只有 `song && isPlaying` 时才给 `.album-orb` 加 `is-active`；暂停或未播放时，唱机、弧线和音波全部静止，文案显示“已暂停”或“还没有开始”。CSS 中 `disc-rotate`、`arc-glow`、`wave-pulse` 都收敛到 `.album-orb.is-active` 后代选择器下，避免静态状态误动。

视觉细化：上一版橙色线条太粗，容易像 PS 涂鸦。当前将主圆环线宽从 2.6px 降到 1.9px，内外弧线降到 1.45px，橙色运动弧线降到 2.35px，播放三角降到 2.6px，音波降到 2.2px 并降低默认透明度。适用边界是：手机端 108px 左右显示时，橙色只做轻节奏，不应压过黑色圆环结构和文字层级。

## 播放态中心符号与动效回归

本轮修复播放时唱片中心符号没有随状态变化的问题。根因是上一轮虽然把外层动效收敛到了 `song && isPlaying`，但中心 SVG 符号本身没有完整绑定到播放语义，且 CSS 只覆盖了 `.disc-center path`，新画的暂停双竖线如果使用 `line` 元素会缺少统一描边样式。

实现上，`src/components/NowPlaying.tsx` 继续以 `isDiscActive = Boolean(song && isPlaying)` 作为唯一状态源：未播放、暂停、空歌单都渲染 `.disc-play-mark` 播放三角；真正播放时才渲染 `.disc-pause-mark` 两条竖线。`src/styles.css` 将中心符号样式改为同时覆盖 `.disc-play-mark` 和 `.disc-pause-mark line`，保证状态变了以后视觉也真的可见。

回归测试补在 `src/App.test.tsx`：空歌单是播放三角，导入歌曲但未播放仍是播放三角，点击主播放按钮后切到暂停双竖线，再次暂停后回到播放三角。为确认测试不是摆设，临时把 `PlayerDiscMark` 的 `isPlaying` 固定为 `false` 时，目标测试按预期在“播放时找不到 `.disc-pause-mark`”处失败；恢复绑定后通过。

验证结果：`npm test -- src/App.test.tsx --run -t "album center mark"` 通过；`npm test -- --run` 6 个测试文件、29 条用例通过；`npm run build` 通过；`npm audit --audit-level=moderate` 返回 0 vulnerabilities。浏览器验证使用本机 Chrome 通道和移动视口 `390x844`，真实上传有效 WAV 后确认：initial/uploaded/paused 三种状态均无动画且显示播放三角，playing 状态显示暂停双竖线并启用 `album-breathe`、`disc-rotate`、`arc-glow`、`wave-pulse`，页面无横向溢出。

## 手机 App 打包路线判断

当前项目已经具备 PWA 基础：`vite-plugin-pwa` 已配置 manifest、standalone 显示模式、portrait 方向、png 图标和 service worker 预缓存。因此最快的手机使用方式不是重写，而是先部署到 HTTPS，再通过手机浏览器“添加到主屏幕”。这个路线成本最低，适合先验证手机触控、首屏高度、本地选歌和播放体验，但它不是 APK/IPA，系统权限和应用商店分发能力有限。

如果要做成可安装包，推荐在现有 Vite + React 项目上加 Capacitor，而不是改成 React Native。Capacitor 的优势是复用当前 UI 和播放逻辑，新增 `android/`、`ios/` 原生工程作为外壳；后续每次改网页端先 `npm run build`，再 `npx cap sync` 同步到原生工程。Android 路线可在当前 Windows 机器继续推进；iOS 路线需要 macOS + Xcode 才能本地构建和真机调试。

本播放器的关键边界是手机本地音乐访问。当前多选文件入口适合继续保留为主路；文件夹导入依赖浏览器/WebView 能力，在手机端不能当稳定主链路。如果后续要像真正音乐 App 那样扫描系统音乐库，Android 需要走 MediaStore 或原生文件/权限插件，iOS 则更受系统沙盒限制，通常应优先走 Files 选择器或显式导入，而不是承诺自动扫全机音乐。

## Capacitor Android 试接入

本轮按“先试试做成手机 App”的目标，在现有 Vite + React 项目上接入 Capacitor Android，而不是重写播放逻辑。新增依赖 `@capacitor/core`、`@capacitor/android`、`@capacitor/cli`，生成 `capacitor.config.ts`，配置 `appId` 为 `cn.jiujiu.personalplayer`、`appName` 为 `99新自用唱机`、`webDir` 为 `dist`。

执行 `npx cap add android` 成功生成 `android/` 原生工程，并用 `npm run android:sync` 跑通完整链路：`npm run build` 构建 Vite/PWA 产物，再由 Capacitor 将 `dist` 复制到 `android/app/src/main/assets/public`。同时把 Android launcher icon 各密度资源替换为 `public/icons/app-icon-512.png` 缩放版本，并将 adaptive icon 背景改为白底，避免默认 Capacitor 模板图标进入手机桌面。

新增 npm 脚本：`android:sync` 用于日常同步；`android:open` 用于打开 Android Studio；`android:apk` 用于尝试生成 debug APK。当前本机 Capacitor 平台检查通过：`npx cap doctor android` 显示 core/cli/android 均为 `8.4.0`，Android 平台状态正常。

实际 APK 打包在本机环境处阻塞：`npm run android:apk` 已完成构建和同步，但 Gradle 阶段报 `JAVA_HOME is not set and no 'java' command could be found in your PATH`；`npm run android:open` 报 `Unable to launch Android Studio. Is it installed?`。结论是项目 App 壳已生成且同步链路可用，但这台 Windows 机器还缺 JDK、Android SDK/Android Studio，暂不能直接产出 APK 或真机安装包。

验证结果：`npm run android:sync` 通过；`npx cap doctor android` 通过；`npm test -- --run` 6 个测试文件、29 条用例通过；`npm audit --audit-level=moderate` 返回 0 vulnerabilities。后续若继续推进 APK，先安装 JDK 与 Android Studio/SDK，再重新执行 `npm run android:apk` 或用 Android Studio 打开 `android/` 工程运行真机。

## 产出可安装 Android APK

本轮继续把 Android 包做完到可发手机安装的状态。由于本机没有 Android Studio，也没有现成 Java/SDK，采用命令行工具链：通过 `winget` 安装 Eclipse Temurin JDK 21 到 `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`；Android SDK command-line tools 安装到 `C:\AI\Android\sdk`，并安装 `platforms;android-36`、`build-tools;36.0.0`、`platform-tools`。SDK 许可证已通过 `sdkmanager --licenses` 接受。

构建中遇到两个环境坑：第一，项目路径 `C:\AI\设计\自用99新唱机` 含中文，Android Gradle Plugin 在 Windows 上默认拦截非 ASCII 路径；处理方式是在 `android/gradle.properties` 加 `android.overridePathCheck=true`。第二，Capacitor Android 8.4.0 的 Java 编译使用 source release 21，JDK 17 会报“无效的源发行版：21”；处理方式是改用 JDK 21，并在 `android:apk` 脚本里显式设置 `JAVA_HOME`、`ANDROID_HOME` 和 PATH，避免当前终端环境未刷新。

最终 APK 产物为 `C:\AI\Android\jiujiu-personal-player-debug.apk`，由 `npm run android:apk` 自动构建并复制。该包是 debug 签名包，适合直接发到 Android 手机手动安装和测试；不是应用商店发布用的 release/aab。安装时手机需要允许“安装未知来源应用”。当前 ADB 设备列表为空，因此没有执行 USB 直装。

验证结果：`npm run android:apk` 通过，Gradle `assembleDebug` 显示 `BUILD SUCCESSFUL`；`apksigner verify --verbose C:\AI\Android\jiujiu-personal-player-debug.apk` 通过，APK Signature Scheme v2 为 `true`，signer 数量为 1；`aapt dump badging` 显示包名 `cn.jiujiu.personalplayer`、应用名 `99新自用唱机`、`minSdkVersion=24`、`targetSdkVersion=36`；`zipalign -c -p 4` 无错误输出；SHA256 为 `5D4B4F2D2A40DC6F0176970B821A412C54CBF07B03D52D0166EE9CF59187E1E7`。

## 手机 App 分发、导入边界与批量删除体验

本轮目标来自手机端真实使用前的产品复查：明确后续更新方式、解释文件夹导入在手机上不可用的原因、优化开屏图标一致性，并补齐播放列表删除确认和批量删除。

架构判断已经沉淀到 `docs/release-and-distribution.md`：当前项目是 Vite + React 前端播放器，加 Capacitor Android 原生壳；没有独立后端，也没有热更新。每次改播放器代码后应重新 `npm run android:apk` 产出 APK。只要包名与签名保持一致，Android 会把新包视为同一个应用的升级；当前 debug APK 适合自测和朋友试用，正式上架前必须改为 release 签名并长期保存签名文件。第一版不建议做远程热更新，避免为一个本地播放器引入额外服务端、审核风险和维护成本。

分发判断：GitHub Releases 适合技术用户和版本归档，手机可直接下载 release asset；给普通朋友用时更适合做一个独立下载页，下载按钮可以仍然指向 GitHub Release。若后续正式分发，需要准备 release/AAB、隐私政策、截图、图标和基础资料，应用表述应强调“播放用户已经合法保存到本地的音频文件”，避免暗示获取侵权音乐。

手机端“导入文件夹”不可用的根因是网页目录选择依赖 File System Access API（例如 `showDirectoryPicker`），该能力在 Android WebView 和多数手机浏览器里不可用。实现上给 `ImportActions` 增加 `directoryImportSupported`，不支持时禁用文件夹按钮并显示“文件夹导入暂不可用”；稳定主入口保持普通文件选择器，并明确标注“选歌，可多选”。

播放列表体验补了两个安全边界：单首删除、清空、批量删除都先走 `window.confirm`，避免误触；`Playlist` 增加多选模式、选中计数和“删除所选 N 首”。底层 `useMusicPlayer` 新增 `removeSongs(songIds)`，会统一撤销 object URL、删除歌曲，并在删掉当前歌曲时选择下一首可用歌曲；如果歌单被删空则暂停并清空当前索引。

视觉和上架准备方面，使用 `pic/3.png` 重新生成了纯白底 app icon、favicon 与 Android launcher/splash 资源，并将蓝色声波替换为 ColaOS 风格浅橙色。开屏图标背景已与外层纯白融合，避免原先图标与背景不和谐。同时新增 `ProfilePanel` 作为“个人导航”模块，最初暂用 ASCII 草图和“公众号：待填写”占位，后续应替换为正式反馈入口。

本轮新增/更新的测试覆盖点包括：手机端文件导入入口应为多选；不支持文件夹导入时按钮禁用；个人导航模块存在；单首删除取消确认时不删除；批量删除确认后删除所选歌曲；批量删除取消确认时保留歌曲；hook 层批量删除当前歌曲时保持后继歌曲可用。

打包复查时发现一个 Windows cmd 脚本坑：旧的 `android:apk` 末尾写成 `if not exist C:\AI\Android mkdir C:\AI\Android && copy ...`，当 `C:\AI\Android` 已经存在时，`copy` 会跟着被跳过，导致 Gradle 生成了新 `app-debug.apk`，但外发路径 `C:\AI\Android\jiujiu-personal-player-debug.apk` 仍可能是旧包。处理方式是新增 `android:copy-apk`，用 PowerShell 的 `New-Item -Force` 和 `Copy-Item -Force` 独立完成复制；`android:apk` 构建完成后调用该脚本。

本轮 APK 重新产出后，外发包路径为 `C:\AI\Android\jiujiu-personal-player-debug.apk`，SHA256 为 `13E0AD6FECF40FFFF3814F5E1DB0B81C5305F539E841BBF61DEE6354B4FD2231`。已用 `apksigner` 验证 v2 签名通过，`aapt dump badging` 确认包名仍为 `cn.jiujiu.personalplayer`、应用名仍为 `99新自用唱机`，`zipalign -c -p 4` 通过；解包探针确认 APK 内网页产物包含“文件夹导入暂不可用”“删除所选”和“个人导航”等新版字符串。

## 真机反馈后的 Android 原生化修正

本轮来自真机截图反馈：文件选择器显示“已选择 1/1”，新 APK 安装时没有稳定覆盖旧包，切后台音乐停止，`audio/ffmpeg` 类型歌曲播放失败，系统确认框按钮仍是青绿色，Android 开屏背景和图标不融合。

根因拆分如下：网页 `<input type="file" multiple>` 虽然在代码里写了 `multiple`，Capacitor 的 WebView 也会把 `MODE_OPEN_MULTIPLE` 转成 `EXTRA_ALLOW_MULTIPLE`，但最终 UI 取决于手机文件管理器，不能保证每台手机都给多选体验。处理方式是新增 Android 原生 `LocalMusicPickerPlugin`，使用 `ACTION_OPEN_DOCUMENT`、`CATEGORY_OPENABLE`、`EXTRA_ALLOW_MULTIPLE` 和音频 MIME 列表作为手机端主入口；网页/桌面环境才回退到原来的 input。

播放失败截图里的 MIME 是 `audio/ffmpeg`，这不是标准 MP3 MIME。部分 Android 文件管理器会把 `.mp3` 报成该类型，WebView `<audio>` 根据 Blob type 解码时可能失败。处理方式有两层：Web 文件导入时按扩展名把 `.mp3` 纠正为 `audio/mpeg`；Android 原生选择器导入的 `content://` 歌曲不再交给 WebView audio，而是交给新增 `NativeAudioPlayerPlugin`，用 Android `MediaPlayer` 播放。

后台播放问题本质上不是 CSS 或普通网页逻辑能解决的。`1.0.1` 版开始，Android 原生选择器导入的歌曲由 `MediaPlayer` 持有和播放，切出应用界面后不再依赖 WebView `<audio>`。当前实现还不是完整音乐 App 后台架构：没有 MediaSession、通知栏/锁屏控制和 foreground service；如果从任务列表划掉应用或系统回收进程，仍可能停止。后续要做正式播放器，应继续补媒体会话和前台服务。

覆盖安装问题来自 Android `versionCode` 一直停在 1，部分手机对同版本 debug APK 覆盖安装体验不稳定，也容易被浏览器下载缓存干扰。本轮把 `versionCode` 升到 2、`versionName` 升到 `1.0.1`，并让 `android:copy-apk` 同时产出 `C:\AI\Android\jiujiu-personal-player-v1.0.1-debug.apk`，方便用户明确下载新版。

系统确认框按钮色来自 Android AlertDialog，不受网页 CSS 控制。项目 `styles.xml` 引用了 `colorAccent`，但此前没有自定义 `colors.xml`，因此按钮落到系统/依赖默认青绿色。本轮新增 `colors.xml`，将 `colorPrimary`、`colorPrimaryDark`、`colorAccent` 统一为橙色系。Android 开屏也从只设置 `android:background` 改为 Theme.SplashScreen 的 `windowSplashScreenBackground`、`windowSplashScreenAnimatedIcon` 和 `postSplashScreenTheme`，背景固定纯白，并新增 `splash_icon.png` 供系统开屏使用。

新增测试覆盖：`audio/ffmpeg + .mp3` 会纠正为 `audio/mpeg`；Android 原生 picker 返回的歌曲能进入歌单；native content URI 歌曲播放时调用 `NativeAudioPlayer.load/play` 而不是 Web Audio。验证结果：`npm test -- --run` 6 个测试文件、35 条用例通过；`npm run build` 通过；`npm audit --audit-level=moderate` 返回 0 vulnerabilities；`npm run android:apk` 成功产出 `1.0.1` debug APK。

## 问题反馈入口与公众号二维码

本轮把底部 `ProfilePanel` 的占位 ASCII 模块改成正式两层入口：第一层只显示“问题反馈”，保持底部信息轻，不把公众号和二维码直接铺在主界面；点开后第二层显示“微信公众号：陈化AI札记”和二维码。二维码源文件来自用户提供的微信图片，复制为 `public/feedback-qr.jpg`，由 Vite/Capacitor 打包进 APK，避免运行时依赖外部链接。

实现上让 `ProfilePanel` 自己维护展开状态，按钮使用 `aria-label="问题反馈"` 和 `aria-expanded`，可被测试和读屏识别；视觉上用普通产品化按钮和 8px 细边框卡片保证手机端触控面积，避免再把 ASCII 草图留在正式界面。新增回归测试覆盖初始不展示公众号、点击“问题反馈”后展示公众号名和二维码图片，避免以后又退回“待填写”占位。

由于本轮会重新产出手机安装包，同时将 Android `versionCode` 从 2 递增到 3、`versionName` 从 `1.0.1` 递增到 `1.0.2`，并把 `android:copy-apk` 的版本化输出改为 `C:\AI\Android\jiujiu-personal-player-v1.0.2-debug.apk`。后续每次给手机下载的新包都应重复这个动作，否则真机容易继续遇到“下载了新包但不像覆盖升级”的混乱体验。

## 歌单持久化与分组修正

本轮修复真机反馈里的两个产品硬伤。刷新后丢歌的根因是 `useMusicPlayer` 虽然把 Android 原生选择器返回的 `content://` URI 写进本地存储，但启动时仍把 `songs` 初始化为空，只用保存的数量显示“重新授权”提示。现在 `LibraryState` 改为 `playlists + activePlaylistId`，启动时会把带 `nativeUri` 的 Android 歌曲恢复成可播放的 `Song`，旧版扁平歌单会迁移到“歌单一”。没有 `nativeUri` 的旧网页文件记录仍无法跨会话恢复播放，只保留数量提示，边界是浏览器 `File` 授权本身不能长期保存。

手机端“文件夹导入”入口已从界面和代码中移除。它依赖 `showDirectoryPicker`/File System Access API，在 Android WebView 里不可靠；既然用户最终在手机上使用，就不应该继续放一个多数情况下不可用的按钮。稳定主路径保持“选歌，可多选”，Android App 内继续优先走原生 `ACTION_OPEN_DOCUMENT` 多选。

歌单分离按手机端使用方式落地：播放列表标题显示“歌单一：x 首歌”；当前播放区显示“正在播放 歌单一 / 歌名”，并去掉“来自当前本地歌单”的小字。当前播放区可点开切换歌单，列表显示“歌单一：N 首歌”“歌单二：N 首歌”等；当当前歌单选入歌曲后，系统会自动露出下一个空歌单，形成“歌单一有歌后出现歌单二、歌单二有歌后出现歌单三”的轻量分组逻辑。

本轮还把反馈模块从“个人导航”改为正式“问题反馈”，移除 ASCII 草图，只保留产品化入口；点开后显示“微信公众号：陈化AI札记”和 `public/feedback-qr.jpg`。测试覆盖刷新恢复 Android native 歌曲、移除文件夹入口、反馈模块文案、歌单自动追加、歌单选择器和旧存储迁移。发布版本递增到 `versionCode=4`、`versionName=1.0.3`，外发包路径为 `C:\AI\Android\jiujiu-personal-player-v1.0.3-debug.apk`。

验证结果：`npm test -- --run` 6 个测试文件、37 条用例通过；`npm run build` 通过；`npm audit --audit-level=moderate` 返回 0 vulnerabilities；`npm run android:apk` 成功产出 APK。APK 复查显示包名 `cn.jiujiu.personalplayer`、`versionCode=4`、`versionName=1.0.3`、应用名 `99新自用唱机`，`apksigner` v2 签名验证通过，`zipalign -c -p 4` 通过。包内资源探针确认包含 `feedback-qr.jpg` 和新版“歌单一/问题反馈”字符串，不再包含“个人导航”“文件夹导入暂不可用”或“来自当前本地歌单”。本次 APK SHA256 为 `41679E57DFBD2DF5108C57791DC4E767515949D04D25C9B055EF00588CAD7C93`。

## 后台续播与歌单选择器修正

本轮真机反馈显示：Android 后台播完一首后自动停在下一首开头。根因不是按钮图标，而是原生播放结束路径的状态顺序有问题：`NativeAudioPlayerPlugin` 的 `MediaPlayer` 完成播放时只把 `ended=true` 存起来，前端靠轮询发现后又先 `setIsPlaying(false)` 再 `next()`，导致下一首即使被选中也按暂停状态加载。现在原生层在 `setOnCompletionListener` 里主动 `notifyListeners("ended")`，前端收到事件或轮询兜底时都走同一个 `advanceAfterTrackEnd()`，先标记下一首需要继续播放，再切歌，避免自动续播被暂停状态吃掉。

歌单状态也做了拆分：`activePlaylistId` 表示当前正在查看/导入的歌单，`currentPlaylistId` 表示当前正在播放的歌单。这样在播放歌单一时打开菜单查看歌单二、给歌单二导入歌曲，或者勾选歌单二进入播放范围，都不会打断正在播放的歌。下一首/自动续播会基于被勾选的歌单生成轻量播放队列；如果用户没有额外勾选，则退回当前播放歌单。

界面上，反馈模块将“微信公众号是：”和“陈化AI札记”拆成两行，避免手机窄屏挤在二维码左侧；播放列表标题区新增“折叠/展开”按钮，方便长歌单时先收起列表；当前播放区的歌单菜单改为窄宽度、右对齐、可滚动的“复选框 + 查看歌单”行，避免上版菜单跑出截图边界。移动视口 `390x844` 冒烟检查显示页面 `scrollWidth=clientWidth=375`，歌单菜单宽约 224px，未出现横向溢出。

新增/更新测试覆盖：原生 `ended` 事件后自动切到下一首并保持播放；反馈公众号换行；歌单折叠不删除歌曲；歌单菜单出现“纳入播放 歌单x”复选框和“查看 歌单x”按钮；勾选另一个歌单不会中断当前播放。验证结果：`npm test -- --run` 6 个测试文件、40 条用例通过；`npm run build` 通过；`npm audit --audit-level=moderate` 返回 0 vulnerabilities。本轮准备重新产出 `versionCode=5`、`versionName=1.0.4` 的 APK，外发路径为 `C:\AI\Android\jiujiu-personal-player-v1.0.4-debug.apk`。

## 歌单导入目标与播放范围拆分

本轮针对真机反馈里的“选歌到底选进哪个歌单”做了产品结构修正。原先把“纳入播放”和“查看歌单”塞在当前播放区下拉菜单里，短期能用，但语义混杂：正在播放歌单一时，如果想给歌单二加歌，就容易误以为切换菜单会打断播放，也容易让导入按钮默认继续指向歌单一。现在新增独立 `PlaylistSwitcher`，它只表示“当前正在查看/导入的歌单”；`NowPlaying` 里的下拉只保留“播放范围”复选框，用于决定下一首/自动续播可从哪些歌单取歌。

实现边界是：`activePlaylistId` 继续负责视图和导入目标，`currentPlaylistId` 继续负责实际正在播放的歌单。切换 `PlaylistSwitcher` 不会暂停、换歌或重置进度；导入按钮文案改为“添加到：歌单x / 选歌，可多选”，让手机端用户在点击前就能知道文件会进哪个分组。当歌单一有歌后，歌单二会直接出现在切换条；歌单二有歌后再露出歌单三，由 `ensureTrailingEmptyPlaylist` 维持这个尾部空歌单模型。

新增测试覆盖：初始渲染存在“歌单切换”区域；导入按钮显示并暴露“添加到：歌单一，选歌，可多选”；歌单一导入后出现可查看的歌单二；切到歌单二后导入目标变成歌单二；歌单二导入后出现歌单三；播放范围菜单只显示“纳入播放 歌单x”复选框，不再承担查看歌单职责；播放中切换查看歌单二并导入歌曲，不会中断正在播放的歌单一。

验证结果：`npm test -- --run src/App.test.tsx` 13 条用例通过；`npm test -- --run` 6 个测试文件、40 条用例通过；`npm run build` 通过；`npm audit --audit-level=moderate` 返回 0 vulnerabilities。移动视口 `390x844` 用本机 Chrome + Playwright 冒烟检查，`clientWidth=390`、`scrollWidth=390`，新切换条可见，导入按钮显示“添加到：歌单一”，没有横向溢出。

发布版本递增到 `versionCode=6`、`versionName=1.0.5`，外发包路径为 `C:\AI\Android\jiujiu-personal-player-v1.0.5-debug.apk`。APK 复查结果：`apksigner verify --verbose` 通过，v2 签名为 `true`；`aapt dump badging` 显示包名 `cn.jiujiu.personalplayer`、应用名 `99新自用唱机`、`minSdkVersion=24`、`targetSdkVersion=36`；`zipalign -c -p 4` 通过。同步进 Android 的资源中已确认包含“歌单切换”“添加到：歌单一”“选择播放范围”，没有旧的“选择播放歌单”。本次 APK SHA256 为 `F1B6E71BB5A281851AD0B74019295E57F95428A8AEF60E81D782F5CD28D5A335`。

## 手机端歌单浮层与横向溢出修正

本轮来自真机截图反馈：播放范围浮层打开后点屏幕其它区域不会收起；歌单切换条的高亮 tab 顶部被裁；歌单数量增多后页面整体被横向撑开，用户能把整个播放器拖到屏幕外。根因分别是：`NowPlaying` 只在触发按钮上切换 `playlistMenuOpen`，没有外部点击监听；`.playlist-tab.is-active` 使用 `translateY(-1px)`，而横向滚动容器会裁剪纵向溢出；`.playlist-switcher-track` 缺少外层宽度封顶和页面级横向溢出保护，部分 WebView 会把内部滚动宽度算进整页宽度。

处理方式：`NowPlaying` 增加 `playlistPickerRef`，菜单打开时监听 `document.pointerdown` 和 `Escape`，点击浮层外部或按 Esc 即关闭，点击复选框和按钮内部不受影响。歌单切换条去掉高亮态的垂直位移，改为边框和 inset shadow 表示选中；外层 `.playlist-switcher` 设定 `width/max-width/min-width` 与 `overflow: hidden`，内层 `.playlist-switcher-track` 固定为自身横向滚动，启用 `overscroll-behavior-x: contain` 和 `-webkit-overflow-scrolling: touch`，并给 tab 使用固定响应式 flex 宽度，确保新增歌单只增加内部横滑距离，不改变页面布局。

新增回归测试覆盖：打开“选择播放范围”后点击页面标题，`播放歌单` 浮层应从 DOM 中消失。验证结果：该测试先红后绿；`npm test -- --run` 6 个测试文件、41 条用例通过；`npm run build` 通过；`npm audit --audit-level=moderate` 返回 0 vulnerabilities。移动视口 `390x844` 用本机 Chrome + Playwright 构造 5 个歌单验证，整页 `clientWidth=390`、`scrollWidth=390`、`bodyScrollWidth=390`、`windowScrollX=0`；歌单条自身 `clientWidth=338`、`scrollWidth=636`、设置 `scrollLeft` 后能内部滑动；active tab 顶部在容器内可见，导入按钮显示“添加到：歌单三”。

发布版本递增到 `versionCode=7`、`versionName=1.0.6`，外发包路径为 `C:\AI\Android\jiujiu-personal-player-v1.0.6-debug.apk`。APK 复查结果：`apksigner verify --verbose` 通过，v2 签名为 `true`；`aapt dump badging` 显示包名 `cn.jiujiu.personalplayer`、应用名 `99新自用唱机`、`minSdkVersion=24`、`targetSdkVersion=36`；`zipalign -c -p 4` 通过。同步进 Android 的资源中已确认包含 `overscroll-behavior-x`、`playlist-tab-spacer`、`pointerdown` 和“选择播放范围”。本次 APK SHA256 为 `C99A8C8791F9C0CAAFE4B2E7ECD531642C6D32C785738E386331333660BCC8D0`。

## 公开仓库文案收敛

本轮复盘到一个边界问题：此前整理过的公开文案草稿不应跟随项目代码出现在 public GitHub 仓库。处理方式是从当前仓库版本删除该草稿文件，移除 README 中对该草稿的引用，并把 README 首页开头从产品宣传口径改回工程说明口径。GitHub 仓库 About 描述同步收敛为“自用 Android 本地音乐播放器项目”。
