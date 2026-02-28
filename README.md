# IPTV 合并服务

基于 Cloudflare Workers 的 IPTV M3U 播放列表聚合工具。从多个公网 M3U 源并发抓取频道，自动分类、去重、标准化频道名称，生成三个版本的播放列表供订阅使用。

---

## 功能特性

- 多源并发抓取，自动合并去重
- 频道名称标准化（CCTV-1 / CCTV 1 HD / CCTV1综合 → CCTV1，CCTV5+ 独立保留）
- 央视频道按数字顺序排列（CCTV1、CCTV2、CCTV3…）
- 按地区 / 类型自动分类（央视、卫视、港台、国际等）
- 生成完整版 / 精简版 / 央视版三份播放列表
- 每天定时自动更新两次（Cron 触发）
- 状态页密码登录保护，M3U 订阅地址公开访问
- 状态页显示 Cloudflare 免费额度实时用量
- 点击订阅卡片一键复制链接
- 手动构建按钮，构建完成后自动刷新页面
- Telegram 通知：定时构建、手动构建、订阅拉取均推送消息
- 支持 GitHub 托管 + Cloudflare Workers 自动部署

---

## 文件结构

```
iptv-worker/
├── src/
│   └── worker.js              ← Worker 主程序
├── .github/
│   └── workflows/
│       └── deploy.yml         ← GitHub Actions 自动部署
├── wrangler.toml              ← Cloudflare 部署配置
├── package.json
├── .gitignore
└── README.md
```

---

## 部署方式一：网页手动部署（无需命令行）

### 第一步：创建 KV 存储空间

1. 登录 [dash.cloudflare.com](https://dash.cloudflare.com)
2. 左侧菜单 → **Workers 和 Pages** → **KV**
3. 点击右上角 **创建命名空间**，名称填写 `IPTV_KV`，点击 **添加**
4. 创建完成后记录 Namespace ID（进入详情页后在 URL 末尾或**设置**标签页中查看）

### 第二步：创建 Worker

1. 左侧菜单 → **Workers 和 Pages** → **创建** → **创建 Worker**
2. 名称随意填写，例如 `iptv-merger`，点击 **部署**

### 第三步：粘贴代码

1. 进入 Worker 主页 → 点击右上角 **编辑代码**
2. 删除全部默认内容，将 `src/worker.js` 内容粘贴进去
3. 点击右上角 **部署**

### 第四步：绑定 KV

1. Worker → **设置** → **绑定** → **添加** → **KV 命名空间**
2. 变量名称填写 `IPTV_KV`，选择对应的命名空间
3. 点击 **保存**

### 第五步：配置环境变量

Worker → **设置** → **变量和机密** → **添加变量**，依次填入所需变量（见文末环境变量汇总表）。

### 第六步：设置定时更新（可选）

1. Worker → **设置** → **触发器** → **Cron 触发器**
2. 添加以下两条（对应北京时间早 10 点和凌晨 2 点）：
   - `0 2 * * *`
   - `0 18 * * *`

---

## 部署方式二：GitHub + 自动部署

代码托管在 GitHub，每次推送到 `main` 分支后，GitHub Actions 自动调用 Wrangler 部署到 Cloudflare Workers。

### 第一步：准备仓库

Fork 或克隆本仓库到你的 GitHub 账户。

### 第二步：修改 wrangler.toml

将 `wrangler.toml` 中的 KV Namespace ID 替换为你自己的：

```toml
name = "iptv-merger"
main = "src/worker.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "IPTV_KV"
id = "你的KV_NAMESPACE_ID"    ← 替换这里
```

### 第三步：创建 Cloudflare API Token

此 Token 用于授权 GitHub Actions 部署 Worker：

1. Cloudflare 控制台 → 右上角头像 → **我的个人资料** → **API 令牌** → **创建令牌**
2. 拉到底部选择 **创建自定义令牌**
3. 权限配置：

   | 第一列 | 第二列 | 第三列 |
   |--------|--------|--------|
   | 账户 | Workers 脚本 | 编辑 |

4. 账户资源选择你的账户，点击创建并复制 Token

### 第四步：配置 GitHub Secrets

在 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，添加以下两个：

| Secret 名称 | 值 |
|------------|---|
| `CLOUDFLARE_API_TOKEN` | 上一步创建的 Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID（控制台右侧边栏复制）|

### 第五步：推送代码触发部署

```bash
git add .
git commit -m "deploy"
git push origin main
```

GitHub Actions 会自动运行，约 1～2 分钟完成部署。可在仓库的 **Actions** 标签页查看进度。

### 第六步：配置 KV 绑定和环境变量

自动部署只负责上传代码，KV 绑定和环境变量仍需在 Cloudflare 控制台手动配置（同部署方式一的第四、五步）。

> 环境变量不会被部署覆盖，只需配置一次。

---

## 访问地址

| 路径 | 说明 | 是否需要登录 |
|------|------|------------|
| `/` | 状态看板 | ✅ 需要 |
| `/full.m3u` | 完整版（全部频道）| ❌ 公开 |
| `/lite.m3u` | 精简版（央视 + 卫视 + 港台）| ❌ 公开 |
| `/cctv.m3u` | 央视版（仅央视）| ❌ 公开 |
| `/login` | 登录页 | — |
| `/logout` | 退出登录 | — |
| `/rebuild` | 手动触发构建 | ✅ 需要 |

---

## 配置 Telegram 通知（可选）

配置后以下三种情况会自动推送 TG 消息：

| 触发场景 | 消息内容 |
|---------|---------|
| ⏰ Cron 定时构建完成 | 频道数、信号源状态、文件大小、耗时 |
| 🔧 手动点击构建完成 | 同上 |
| 📥 有人拉取订阅文件 | 文件名、时间、IP、客户端（同一文件 1 小时内只通知一次）|

**获取 Bot Token：**
1. 在 Telegram 搜索 `@BotFather`，发送 `/newbot`
2. 按提示设置机器人名称，完成后复制返回的 Token

**获取 Chat ID：**
1. 给你的机器人发一条任意消息
2. 浏览器访问：`https://api.telegram.org/bot你的TOKEN/getUpdates`
3. 找到 `"chat":{"id": 数字}` 中的数字即为 Chat ID

---

## 配置 Cloudflare 用量监控（可选）

配置后状态页顶部显示今日 Worker 请求数、KV 读写次数及免费额度进度条，超过 70% 变黄、90% 变红预警。

**获取 CF_ACCOUNT_ID：**
登录 Cloudflare 控制台，右侧边栏「账户 ID」直接复制。

**获取 CF_API_TOKEN（用量读取专用）：**
1. 右上角头像 → **我的个人资料** → **API 令牌** → **创建令牌** → **创建自定义令牌**
2. 权限配置：

   | 第一列 | 第二列 | 第三列 |
   |--------|--------|--------|
   | 账户 | 账户分析 | 读取 |

3. 账户资源选择你的账户，创建并复制 Token（建议设为加密类型）

**获取 CF_KV_NAMESPACE_ID：**
Cloudflare 控制台 → **Workers KV** → 点击 `IPTV_KV` → 在**设置**标签页中复制 Namespace ID。

> 用量数据来自 Cloudflare Analytics API，有 5～30 分钟延迟，属正常现象。

---

## 环境变量汇总

| 变量名 | 必填 | 说明 |
|--------|:----:|------|
| `AUTH_PASSWORD` | ✅ | 状态页登录密码，建议设为加密类型 |
| `M3U_SOURCES` | ✅ | M3U 源列表，每行一条，格式：`URL 地区` |
| `TG_TOKEN` | 可选 | Telegram Bot Token |
| `TG_CHAT_ID` | 可选 | Telegram Chat ID |
| `CF_ACCOUNT_ID` | 可选 | Cloudflare 账户 ID（用量监控）|
| `CF_API_TOKEN` | 可选 | Cloudflare API Token（账户分析读取权限）|
| `CF_WORKER_NAME` | 可选 | Worker 名称，如 `iptv-merger` |
| `CF_KV_NAMESPACE_ID` | 可选 | KV 命名空间 ID |

`M3U_SOURCES` 格式示例：

```
https://example.com/source1.m3u 中国大陆
https://example.com/source2.m3u 中国香港
https://example.com/source3.m3u 中国台湾
https://example.com/source4.m3u 国际
```

支持的地区名称：`中国大陆`、`中国香港`、`中国澳门`、`中国台湾`，其余均归入国际频道。

---

## 免费版额度说明

| 资源 | 免费额度 | 说明 |
|------|---------|------|
| Worker 请求数 | 100,000 次 / 天 | 每次访问状态页或下载 M3U 消耗 1 次 |
| KV 读取 | 100,000 次 / 天 | 每次请求读取数据 |
| KV 写入 | 1,000 次 / 天 | 每次构建写入 4 次 |
| KV 列表 / 删除 | 1,000 次 / 天 | 登出时消耗 1 次删除 |
| KV 存储 | 1 GB | |

日常使用完全在免费额度内。如果源数量很多导致 Cron 构建超时（免费版单次最长 30 秒），可减少源数量或升级 Workers Paid（$5 / 月）。
