# 📺 IPTV M3U Merge Worker

基于 Cloudflare Workers 的 IPTV 直播源聚合服务。自动抓取多个 M3U 信号源，去重合并后输出三种规格的订阅文件，并提供 Web 管理界面。

---

## 功能特性

- **多源聚合**：并发抓取多个 M3U 信号源，自动去重合并
- **智能分组**：自动识别频道所属地区与分类（央视 / 卫视 / 港台 / 国际）
- **频道标准化**：内置别名映射，将同一频道的不同写法统一（如 `DRAGONTV` → `东方卫视`）
- **三档订阅**：输出完整版、精简版（央视+卫视+港台）、央视版三种 M3U 文件
- **Web 管理页**：无需重新部署即可管理信号源、黑白名单、别名、构建频率
- **定时自动构建**：Cron 定时触发 + 软控制最小间隔，灵活控制更新频率
- **Telegram 通知**：构建完成后推送结果，包含频道变化 Diff（新增/消失频道）
- **历史构建趋势**：保留最近 7 次构建记录，状态页可视化展示
- **Cloudflare 用量监控**：实时显示 Worker 请求数和 KV 操作数（需配置 API Token）

---

## 部署步骤

### 1. 创建 KV 命名空间

在 Cloudflare 控制台 → Workers & Pages → KV，创建一个命名空间，记录其 ID。

### 2. 配置 wrangler.toml

```toml
name = "iptv-worker"
main = "worker.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "IPTV_KV"
id = "你的KV命名空间ID"

[triggers]
# 每小时触发一次作为检查器，实际构建间隔由管理页控制
crons = ["0 * * * *"]
```

### 3. 配置环境变量

在 Cloudflare 控制台 → Worker → 设置 → 变量和机密 中添加：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `AUTH_PASSWORD` | 否 | 管理页访问密码，留空则不需要登录 |
| `M3U_SOURCES` | 否 | 初始信号源列表（见格式说明），可在管理页覆盖 |
| `TG_TOKEN` | 否 | Telegram Bot Token，用于构建通知 |
| `TG_CHAT_ID` | 否 | Telegram 接收通知的 Chat ID |
| `CF_API_TOKEN` | 否 | Cloudflare API Token，用于用量监控 |
| `CF_ACCOUNT_ID` | 否 | Cloudflare 账号 ID，用于用量监控 |
| `CF_WORKER_NAME` | 否 | Worker 名称，用于用量监控 |
| `CF_KV_NAMESPACE_ID` | 否 | KV 命名空间 ID，用于精确的 KV 用量统计 |

**`M3U_SOURCES` 格式**（每行一个，格式为 `URL 地区`）：

```
https://example.com/source1.m3u 中国大陆
https://example.com/source2.m3u 中国香港
https://example.com/source3.m3u 中国台湾
```

### 4. 部署

```bash
wrangler deploy
```

### 5. 首次构建

部署后访问 Worker 域名，登录后点击「立即构建」，或等待 Cron 自动触发。

---

## 路由说明

| 路径 | 访问权限 | 说明 |
|------|----------|------|
| `/` | 需登录 | 状态页，显示频道统计、信号源状态、历史趋势等 |
| `/full.m3u` | 公开 | 完整订阅，包含所有频道 |
| `/lite.m3u` | 公开 | 精简订阅，仅含央视、卫视、港台 |
| `/cctv.m3u` | 公开 | 央视订阅，仅含 CCTV 系列频道 |
| `/admin` | 需登录 | 管理页，配置信号源、黑白名单、别名映射、定时设置 |
| `/rebuild` | 需登录（POST）| 手动触发构建 |
| `/login` | 公开 | 登录页 |
| `/logout` | 公开 | 退出登录 |

订阅地址填写示例（在 TiviMate / APTV 等客户端中使用）：

```
https://your-worker.workers.dev/full.m3u
```

---

## 管理页功能

访问 `https://your-worker.workers.dev/admin` 进入管理页，无需重新部署即可调整以下配置：

### 📡 信号源管理

- 在文本框中编辑信号源列表，每行一个 `URL 地区`
- 保存后下次构建时生效，**优先级高于环境变量 `M3U_SOURCES`**
- 清空后自动回退使用环境变量

### 🚫 频道黑白名单

- **黑名单**：包含关键词的频道在构建时自动过滤（不区分大小写）
  - 适合屏蔽购物、广告、成人等频道
- **白名单**：若填写，则只保留包含关键词的频道（优先级高于黑名单）
  - 留空则不启用白名单

### 🔄 频道别名映射

将不同来源的同名频道统一标准名称，提升去重效果。

- **原始写法**：填写大写、去掉空格和连字符的形式，如 `DRAGONTVHD`
- **标准名称**：填写希望统一显示的名称，如 `东方卫视`

内置了常见卫视、港台、国际台的映射，管理页只需添加自定义扩展。

### ⏱️ 定时构建 & 订阅缓存

| 设置 | 默认值 | 说明 |
|------|--------|------|
| Cron 最小间隔 | 6 小时 | Cron 触发后，距上次构建不足此时间则跳过 |
| 订阅缓存时长 | 30 分钟 | IPTV 客户端本地缓存 M3U 文件的时间，修改后新请求立即生效 |

**软控制原理**：Cron 按 `wrangler.toml` 中的频率触发（建议每小时一次），每次触发时 Worker 检查距上次构建的时间，未达到设定间隔则自动跳过，不执行构建，也不消耗 KV 写入额度。

---

## KV 数据结构

| Key | 说明 |
|-----|------|
| `full.m3u` | 完整版订阅内容 |
| `lite.m3u` | 精简版订阅内容 |
| `cctv.m3u` | 央视版订阅内容 |
| `meta` | 最近一次构建的元数据（JSON） |
| `build_history` | 最近 7 次构建记录（JSON 数组） |
| `admin:sources` | 管理页配置的信号源列表 |
| `admin:filters` | 黑白名单配置（JSON） |
| `admin:aliases` | 自定义别名映射（JSON） |
| `admin:config` | 定时与缓存配置（JSON） |
| `usage_cache` | CF 用量查询缓存（5 分钟 TTL） |
| `session:<token>` | 登录会话（7 天 TTL） |
| `notify_cooldown:<file>` | 订阅通知冷却标记（1 小时 TTL） |

---

## Telegram 通知

配置 `TG_TOKEN` 和 `TG_CHAT_ID` 后，以下情况会推送通知：

- **构建完成**（定时或手动）：包含频道总数、信号源成功率、文件大小、与上次构建的频道 Diff
- **订阅访问**：M3U 文件被下载时通知（同一文件 1 小时内只通知一次）

### 创建 Telegram Bot

1. 与 [@BotFather](https://t.me/BotFather) 对话，发送 `/newbot` 创建 Bot
2. 获取 `TG_TOKEN`（格式如 `123456789:AAxxxxxx`）
3. 将 Bot 添加到目标群组或与 Bot 私聊，发送任意消息
4. 访问 `https://api.telegram.org/bot<TG_TOKEN>/getUpdates` 获取 `chat.id` 作为 `TG_CHAT_ID`

---

## 频道分组规则

频道按以下规则自动归类，排序按地区和分类权重排列：

| 地区 | 分类 |
|------|------|
| 中国大陆 | 央视、卫视、体育、新闻、影视、综艺、其他 |
| 中国香港 | 综合、新闻、影视、体育、综艺 |
| 中国台湾 | 综合、新闻、影视、体育、综艺 |
| 国际频道 | 综合、新闻、影视、体育、音乐、游戏 |

识别逻辑基于频道名称关键词匹配（如含「卫视」归入卫视，含「体育」归入体育），无法匹配则归入地区的「综合」或「其他」分类。

---

## 注意事项

- M3U 文件公开访问，无需登录，建议订阅链接不要泄露
- Cloudflare Workers 免费版每日限额：10 万次请求、KV 读取 10 万次、KV 写入 1000 次
- 构建一次约消耗：KV 写入 5～6 次（4 个文件 + meta + history）
- 建议 Cron 间隔不低于 4 小时，避免消耗 KV 写入额度
- `channelNames` 字段存于 `meta` 中用于 Diff 计算，频道数多时 meta 体积会增大

---

## License

MIT
