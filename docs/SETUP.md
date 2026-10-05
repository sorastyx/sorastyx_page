# 使用与修改

这是 GitHub README 主页初稿，制作仓库为 `sorastyx/sorastyx_page`。配色与顶部图片取自 Forest，喜欢的作品按用户给定顺序固定显示。

## 查看

仓库首页的 README 即实际 GitHub 展示版本。运行 `npm ci`、`npm run build:offline`、`npm run preview` 可在 `http://127.0.0.1:4173/` 查看本地布局预览。预览近似 GitHub README 容器，最终效果以 GitHub 渲染为准。

## 修改内容

- `profile.config.json`：昵称、签名、作品清单、展示数量与项目。
- `scripts/build.mjs`：卡片样式、排版与文字。
- `assets/source/forest-with-title.png`：已确认的 Forest 标题适配图。
- README 由生成器输出；长期修改应修改生成器或配置，避免下次更新覆盖。
- 横幅已按用户要求移除学校、研究方向、兴趣标签两行。

## 自动更新

`Update profile` 每天北京时间约 06:15 更新，也可以在 Actions 中手动运行。公开 GitHub 与 Bangumi 数据不需要手动提供访问令牌，GitHub Actions 使用自动提供的 GITHUB_TOKEN。GitHub 定时任务可能延迟；长时间无仓库活动也可能暂停定时任务。

Bangumi 收藏更新使用公开 API，读取：游戏收藏、游戏正在游玩、动画正在追番、角色收藏页面。保留原收藏条目，不把所有游戏冒充为视觉小说。已玩／看过数量分别按收藏状态 2 计算；正在进行按状态 3 计算。喜欢的作品与评分、状态无关。

角色收藏首次读取为空时显示留白提示；之后收藏角色会在更新时显示。头像墙显示前 16 位关注者和被关注者，入口链接通往完整列表。

缓存会在短暂网络失败时保留旧数据；`data/build-report.json` 记录各数据源日期与下载问题。访问计数是图片请求计数，会受到 GitHub 图片缓存影响，不是准确的独立访客数。

## 更详细的 Metrics

主要公开统计卡、贡献日历、头像墙不依赖 Metrics。`lowlighter/metrics` 的语言分布、3D 日历等扩展放在折叠区。

要启用扩展，请在仓库 Settings → Secrets and variables → Actions 设置 `METRICS_TOKEN`，再运行 `Detailed Metrics`，然后运行 `Update profile`。令牌由你在 GitHub 设置中创建，不要贴到聊天或提交到仓库。仅公开资料一般不需额外权限，具体插件要求以官方文档为准。

上游说明：https://github.com/lowlighter/metrics/blob/master/.github/readme/partials/documentation/setup/action.md

## 接到 GitHub 个人简介

GitHub 个人简介必须使用同名仓库 `sorastyx/sorastyx` 中的 README。本仓库的名字是 `sorastyx_page`，不会自动替换个人简介。

确认初稿后，可将本仓库 README 放进同名仓库；其中的图片已使用本仓库的绝对地址。也可在同名仓库加入同步流程，在本仓库 README 更新时获取新内容。

## 检查

`npm run check` 校验七部作品的唯一 ID、作品收藏对应关系、贡献日历数据、全部生成图片是否可解码、README 的仓库图片路径。
