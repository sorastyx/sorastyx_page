# 使用与修改

这是 GitHub README 主页初稿，制作仓库为 `sorastyx/sorastyx_page`。布局采用白底、蓝色栏目名和细分隔线；顶部保留 Forest 图片，喜欢的作品按用户给定顺序固定显示。

## 查看

仓库首页的 README 即实际 GitHub 展示版本。运行 `npm ci`、`npm run build:offline`、`npm run preview` 可在 `http://127.0.0.1:4173/` 查看本地布局预览。预览近似 GitHub README 容器，最终效果以 GitHub 渲染为准。

## 修改内容

- `profile.config.json`：昵称、签名、作品清单、展示数量与项目。
- `scripts/render.mjs`：卡片样式；`scripts/readme.mjs`：栏目与折叠排版；`scripts/build.mjs`：公开数据读取。
- `assets/source/forest-banner-wide.png`：约 2.8:1 的 Forest 通栏横幅；原竖版标题图保留在 `forest-with-title.png`。
- 横幅按原始比例显示，不拉伸或裁切。名字与签名放在横幅下方，用 GitHub 原生文字显示。
- README 由生成器输出；长期修改应修改生成器或配置，避免下次更新覆盖。
- 横幅已按用户要求移除学校、研究方向、兴趣标签两行。
- 按用户最新意见删去装饰、双语抒情标题、打字欢迎语和结束语。学校与研究方向不出现在横幅中；签名为用户提供的原文。
- 概览采用 38% / 62% 双栏：左栏为 GitHub 概况、语言与项目；右栏为七部喜欢作品的封面和各两部游玩／追番条目。
- “更多”默认折叠，展示贡献曲线、社区与收藏记录：收藏概况、6 部已玩、最多 5 部看过；想玩／想看在其内部单独折叠。记录使用 GitHub 原生文字和小封面，作品名可点击。
- 已玩／看过优先按个人评分降序，同分按收藏更新时间降序；计划清单按收藏更新时间排序。记录排除首页固定喜欢的七部作品，也不展示进行中的条目。数量在配置中调整。
- detailExcludedSubjects 排除同一作品的其他版本；当前排除 Ever17 重制版 38979，首页使用原版 1126，避免看起来重复。
- 没有收藏角色时隐藏该栏目。初音计数器保留原主题与原计数名称。
- 连续贡献记录按展示的年度区间计算；语言比例为自有仓库公开代码字节占比，排除本主页制作仓库，不能用于判断熟练程度。

## 自动更新

`Update profile` 每天北京时间约 06:15 更新，也可以在 Actions 中手动运行。公开 GitHub 与 Bangumi 数据不需要手动提供访问令牌，GitHub Actions 使用自动提供的 GITHUB_TOKEN。GitHub 定时任务可能延迟；长时间无仓库活动也可能暂停定时任务。

Bangumi 收藏更新使用公开 API，读取：游戏收藏、游戏正在游玩、动画正在追番、角色收藏页面。保留原收藏条目，不把所有游戏冒充为视觉小说。已玩／看过数量分别按收藏状态 2 计算；正在进行按状态 3 计算。喜欢的作品与评分、状态无关。

角色收藏为空时隐藏；之后收藏角色会在更新时显示。头像墙显示前 16 位关注者和被关注者，入口链接通往完整列表。

缓存会在短暂网络失败时保留旧数据；`data/build-report.json` 记录各数据源日期与下载问题。访问计数是图片请求计数，会受到 GitHub 图片缓存影响，不是准确的独立访客数。

## 更详细的 Metrics

主要公开统计卡、贡献日历、头像墙不依赖 Metrics。`lowlighter/metrics` 的语言分布、3D 日历等扩展放在折叠区。

要启用扩展，请在仓库 Settings → Secrets and variables → Actions 设置 `METRICS_TOKEN`，再运行 `Detailed Metrics`，然后运行 `Update profile`。令牌由你在 GitHub 设置中创建，不要贴到聊天或提交到仓库。仅公开资料一般不需额外权限，具体插件要求以官方文档为准。

上游说明：https://github.com/lowlighter/metrics/blob/master/.github/readme/partials/documentation/setup/action.md

## 接到 GitHub 个人简介

GitHub 个人简介必须使用同名仓库 `sorastyx/sorastyx` 中的 README。本仓库的名字是 `sorastyx_page`，不会自动替换个人简介。

个人简介仓库 `sorastyx/sorastyx` 使用同一套生成器、素材和每日更新流程，配置中的 repository 指向个人简介仓库自身。制作仓库 `sorastyx_page` 保留初稿与源码。后续版式修改需要同时更新两者的生成器；定时刷新数据由各仓库独立执行，不需要跨仓库令牌。

## 检查

`npm run check` 校验七部作品的唯一 ID、作品收藏对应关系、贡献日历数据、全部生成图片是否可解码、README 的仓库图片路径。
