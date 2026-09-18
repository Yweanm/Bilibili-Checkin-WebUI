# Bilibili Checkin WebUI

基于 [dangks/bilibili_checkin](https://github.com/dangks/bilibili_checkin) 的二开版本，添加 WebUI 可视化操作：查看运行日志、在线修改仓库配置

> 仅供学习交流使用

## 目录

- [界面预览](#界面预览)
- [功能](#功能)
- [目录结构](#目录结构)
- [配置参考](#配置参考)
- [快速开始](#快速开始)
- [WebUI 控制台用法](#webui-控制台用法)
- [Cookie 获取](#cookie-获取)
- [本地运行](#本地运行)
- [常见问题](#常见问题)

## 界面预览

![](docs/images/img1.png)

![](docs/images/img2.png)

## 功能

- **签到与任务**：直播签到、漫画签到、分享视频、视频投币；观看视频为固定任务，始终执行
- **多账号**：`BILIBILI_COOKIE` / `BILIBILI_REFRESH_TOKEN` 按 `###` 分隔
- **Cookie 保活**：官方刷新链 `info→refresh→confirm`，`ac_time_value` 自动续期并回写 Secrets
- **投币策略**：动态 / 排行榜选片，超上限、硬币不足自动跳过，可选同时点赞
- **推送**：PushPlus 微信推送任务报告，日志用户名 / UID 脱敏、北京时间输出
- **WebUI 控制台**：连接仓库、保存配置、改 CRON、手动触发、查看日志，中英双语、深浅主题、移动端适配

## 目录结构

```text
├── main.py               # 入口：多账号调度、自动刷新、投币与推送
├── bilibili.py           # B 站任务 API 封装
├── cookie_refresh.py     # Cookie 官方刷新链
├── push.py               # PushPlus 推送
├── requirements.txt      # Python 依赖
├── .github/workflows/    # Actions 定时与手动触发
└── console/              # WebUI 控制台
```

## 配置参考

所有配置只涉及 4 个 Secret 与 4 个 Variable，名称、默认值均与代码一致。配置方式二选一，效果完全相同：

1. **推荐用 WebUI 控制台**：页面填写后保存，自动写入仓库，见「[WebUI 控制台用法](#webui-控制台用法)」
2. **GitHub 手动配置**：`Settings → Secrets and variables → Actions`，按下表添加

### Secrets

| Secret | 必填 | 说明 |
| :--- | :---: | :--- |
| `BILIBILI_COOKIE` | 是 | B 站 Cookie，需含 `SESSDATA`、`bili_jct`、`DedeUserID`，多账号用 `###` 分隔 |
| `BILIBILI_REFRESH_TOKEN` | 可选 | 浏览器 `localStorage` 的 `ac_time_value`，多账号与 Cookie 一一对应<br>配置后任务前自动刷新并回写；留空则不自动刷新，3 天左右过期 |
| `PUSH_PLUS_TOKEN` | 否 | [pushplus.plus](https://www.pushplus.plus) Token，不填则不推送 |
| `COOKIE_REFRESH_PAT` | 回写用 | 刷新后自动回写 Secrets 的 PAT：经典勾 `repo`，或细粒度给 `Secrets` 读写<br>不配只是新 Cookie 无法自动写回，需按日志手动更新 |

> 用 WebUI 保存时，Secret 留空表示不修改原值

### Variables

| 变量 | 默认值 / 取值 | 说明 |
| :--- | :--- | :--- |
| `TASK_CONFIG` | `直播签到,漫画签到,分享视频,视频投币` | 要执行的任务，逗号分隔；留空执行全部默认任务，未知任务名被忽略 |
| `COIN_ADD_NUM` | `1`，`0`–`5` | 每日投币数量，`0` 跳过；实际取「配置值、硬币余额、5」的最小值 |
| `COIN_SELECT_LIKE` | `1` 是 / `0` 否 | 投币时是否同时点赞 |
| `COIN_VIDEO_SOURCE` | `动态` / `排行榜` | 投币目标来源：动态 / 排行榜 |

> 观看视频为固定任务，不受 `TASK_CONFIG` 控制

## 快速开始

1. **Fork / 导入本仓库**到你的 GitHub
2. **配置**：按「[配置参考](#配置参考)」完成 Secrets 与 Variables，推荐直接用 WebUI 控制台
3. **运行**：
   - 自动：默认 `cron: '0 3 * * *'`，5 段式，GitHub 按 UTC 解析，即北京时间每天 11:00；定时触发可能延迟数分钟，仓库 60 天无活动会被自动停用
   - 手动：Actions 页 → `Bilibili Checkin WebUI` → `Run workflow`

## WebUI 控制台用法

将 `console/` 部署到 Cloudflare Pages / GitHub Pages 等静态托管后访问：

1. **连接仓库**：填 `owner/repo` + PAT，经典 Token 勾 `repo`，Fine-grained 给 `Actions`、`Variables`、`Secrets`、`Contents` 读写。Token 只存本机 `localStorage`，勿在公共设备使用
2. **定时计划**：读取 workflow 中的 `cron` 并换算北京时间，保存即提交一次 commit
3. **任务配置**：填写 Cookie / RefreshToken / PushPlus Token，勾选任务与投币设置；Secrets 留空 = 不修改，任务与投币写入 Variables
4. **运行控制**：`立即运行`、`刷新记录`、跳转 GitHub
5. **运行日志**：点某条运行的 `日志`，拉取 jobs 日志，默认最后 1200 行，`ERROR` / `WARNING` 高亮

## Cookie 获取

1. 无痕窗口登录 `bilibili.com`，推荐小号，登录后别再用该窗口手动刷 B 站，避免双端互踢
2. `F12` → Network → 任一请求 → Request Headers，复制 `Cookie`，确认含 `SESSDATA`、`bili_jct`、`DedeUserID`
3. `F12` → Application → Local Storage → `https://www.bilibili.com`，复制 `ac_time_value` 填入 `BILIBILI_REFRESH_TOKEN`，多账号用 `###` 与 Cookie 一一对应
4. 取完关闭无痕窗口。之后每天任务前自动 `info→refresh→confirm`，刷新后 Actions 自动回写，需配 `COOKIE_REFRESH_PAT`；本地运行需手动回填

> 仅在接口返回 `refresh=true` 时刷新、不强刷；返回 `-101/86095` 表示需手动重登，原理见 `cookie_refresh.py`

## 本地运行

```bash
pip install -r requirements.txt
$env:BILIBILI_COOKIE="SESSDATA=xxx; bili_jct=xxx; DedeUserID=xxx"
$env:BILIBILI_REFRESH_TOKEN="ac_time_value_xxx"  # 可选，配了才自动刷新，多账号用 ### 分隔
$env:TASK_CONFIG="直播签到,漫画签到,分享视频,视频投币"
$env:COIN_ADD_NUM="1"; $env:COIN_SELECT_LIKE="1"; $env:COIN_VIDEO_SOURCE="动态"
# $env:PUSH_PLUS_TOKEN="xxx"  # 可选
python main.py
```

环境变量与「[配置参考](#配置参考)」一一对应，未设置时使用默认值

## 常见问题

| 现象 | 排查 |
| :--- | :--- |
| `Cookie失效或网络问题` | Cookie 过期，重新抓取并更新 `BILIBILI_COOKIE` |
| `Bili_jct(csrf) 未找到` | Cookie 缺 `bili_jct` 字段 |
| 连接报 401 / 403 / 404 | Token 无效 / 过期，或仓库名错、缺少 `repo` 权限 |
| libsodium 加载失败 | 加密组件已内置本地，刷新页面后重试保存 Secrets |
| 今日投币上限已满 | 正常跳过，B 站每日投币上限 5 枚 |

## 安全与免责

- Token / Cookie 只存浏览器 `localStorage` 和 GitHub Secrets，不经第三方服务器；日志已脱敏，但仍勿在公共设备使用控制台
- 仅供学习交流，频繁调用或违反 B 站规则导致的封号等后果自负

## License

[MIT License](LICENSE)
