// ============================================================
//  IPTV M3U Merge Worker  —  Cloudflare Workers
//  将此文件部署到 Cloudflare Workers，并绑定一个 KV namespace
//  命名为 IPTV_KV
// ============================================================

// ---- 频道分类配置 ----
const CCTV_ORDER = [
  "CCTV1","CCTV2","CCTV3","CCTV4","CCTV5","CCTV5+","CCTV6",
  "CCTV7","CCTV8","CCTV9","CCTV10","CCTV11","CCTV12","CCTV13",
  "CCTV14","CCTV15","CCTV16","CCTV17","CCTV4K","CCTV8K"
];

const GROUP_ORDER = {
  "中国大陆 | 央视": 1,
  "中国大陆 | 卫视": 2,
  "中国大陆 | 体育": 3,
  "中国大陆 | 新闻": 4,
  "中国大陆 | 影视": 5,
  "中国大陆 | 综艺": 6,
  "中国大陆 | 其他": 9,
  "中国香港 | 综合": 10,
  "中国香港 | 新闻": 11,
  "中国香港 | 影视": 12,
  "中国香港 | 体育": 13,
  "中国香港 | 综艺": 14,
  "中国台湾 | 综合": 20,
  "中国台湾 | 新闻": 21,
  "中国台湾 | 影视": 22,
  "中国台湾 | 体育": 23,
  "中国台湾 | 综艺": 24,
  "国际频道 | 综合": 30,
  "国际频道 | 新闻": 31,
  "国际频道 | 影视": 32,
  "国际频道 | 体育": 33,
  "国际频道 | 音乐": 34,
  "国际频道 | 游戏": 35,
};

// 格式: 每行 "URL 地区"，用换行分隔（KV 中的 sources 优先于此）
const FALLBACK_SOURCES = `
https://raw.githubusercontent.com/your/repo/main/sources.m3u 中国大陆
`.trim();

// ============================================================
//  认证逻辑
// ============================================================
const AUTH_COOKIE = 'iptv_session';
const SESSION_TTL = 7 * 24 * 3600;

async function generateToken() {
  const arr = crypto.getRandomValues(new Uint8Array(32));
  return [...arr].map(b => b.toString(16).padStart(2,'0')).join('');
}

async function isAuthenticated(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`${AUTH_COOKIE}=([a-f0-9]+)`));
  if (!match) return false;
  const stored = await env.IPTV_KV.get(`session:${match[1]}`);
  return stored === '1';
}

// ============================================================
//  登录页 HTML
// ============================================================
function renderLoginPage(error = '') {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>IPTV · 登录</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #f0f2f5; color: #1a1a2e;
    font-family: 'Noto Sans SC', 'Inter', sans-serif;
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 20px;
  }
  .hero-label { display: flex; align-items: center; gap: 7px; font-size: 13px; color: #555; margin-bottom: 14px; font-weight: 500; }
  .hero-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px #22c55e30; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 3px #22c55e30; } 50% { box-shadow: 0 0 0 6px #22c55e15; } }
  h1 { font-size: 42px; font-weight: 700; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 8px; letter-spacing: -1px; text-align: center; }
  .sub { font-size: 14px; color: #888; margin-bottom: 36px; text-align: center; }
  .card { background: #fff; border-radius: 18px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 36px 32px 28px; width: 100%; max-width: 380px; }
  .card-title { font-size: 17px; font-weight: 600; color: #111; margin-bottom: 4px; }
  .card-sub { font-size: 13px; color: #888; margin-bottom: 24px; }
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 12px; font-weight: 500; color: #555; margin-bottom: 7px; }
  .field input { width: 100%; padding: 11px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 14px; color: #111; outline: none; transition: border-color .2s, box-shadow .2s; font-family: inherit; background: #fafafa; }
  .field input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px #2563eb18; background: #fff; }
  .error-msg { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626; font-size: 12px; padding: 9px 13px; margin-bottom: 14px; }
  .submit-btn { width: 100%; padding: 12px; background: linear-gradient(135deg, #2563eb, #06b6d4); border: none; border-radius: 10px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity .2s, transform .15s; }
  .submit-btn:hover { opacity: 0.9; transform: translateY(-1px); }
  .hint { text-align: center; font-size: 12px; color: #bbb; margin-top: 18px; }
</style>
</head>
<body>
  <div class="hero-label"><span class="hero-dot"></span>IPTV Merge Service</div>
  <h1>IPTV 合并服务</h1>
  <p class="sub">Powered by Cloudflare Workers</p>
  <div class="card">
    <div class="card-title">访问验证</div>
    <div class="card-sub">请输入密码以继续</div>
    ${error ? `<div class="error-msg">⚠️ ${error}</div>` : ''}
    <form method="POST" action="/login">
      <div class="field">
        <label>密码</label>
        <input type="password" name="password" placeholder="请输入访问密码" autofocus autocomplete="current-password"/>
      </div>
      <button class="submit-btn" type="submit">进入 →</button>
    </form>
    <div class="hint">登录状态保持 7 天</div>
  </div>
</body>
</html>`;
}

// ============================================================
//  工具函数
// ============================================================
function detectGroup(name, region) {
  const n = name.toUpperCase();
  const kNews    = ["新闻","NEWS","资讯","财经","早安"];
  const kSports  = ["体育","运动","足球","篮球","竞技","五星","EUROSPORT","SPORT"];
  const kMovie   = ["电影","影院","剧场","CHC","影视","剧集","MOVIE","HBO","星河"];
  const kVariety = ["综艺","娱乐","生活","时尚"];
  const kMusic   = ["音乐","MTV","MEZZO","CLASSIC"];
  const kGame    = ["游戏","电竞","动漫"];
  const has = (arr) => arr.some(x => n.includes(x));

  if (region === "中国大陆") {
    if (n.includes("CCTV") || n.includes("央视")) return "中国大陆 | 央视";
    if (n.includes("卫视"))   return "中国大陆 | 卫视";
    if (has(kSports))  return "中国大陆 | 体育";
    if (has(kNews))    return "中国大陆 | 新闻";
    if (has(kMovie))   return "中国大陆 | 影视";
    if (has(kVariety)) return "中国大陆 | 综艺";
    return "中国大陆 | 其他";
  }
  if (["香港","澳门"].some(x=>region.includes(x)) || ["TVB","PHOENIX","翡翠","凤凰"].some(x=>n.includes(x))) {
    if (has(kNews))    return "中国香港 | 新闻";
    if (has(kMovie))   return "中国香港 | 影视";
    if (has(kSports))  return "中国香港 | 体育";
    if (has(kVariety)) return "中国香港 | 综艺";
    return "中国香港 | 综合";
  }
  if (region.includes("台湾") || ["东森","中天","三立","年代","TVBS"].some(x=>n.includes(x))) {
    if (has(kNews))    return "中国台湾 | 新闻";
    if (has(kMovie))   return "中国台湾 | 影视";
    if (has(kSports))  return "中国台湾 | 体育";
    if (has(kVariety)) return "中国台湾 | 综艺";
    return "中国台湾 | 综合";
  }
  if (has(kNews))    return "国际频道 | 新闻";
  if (has(kMovie))   return "国际频道 | 影视";
  if (has(kSports))  return "国际频道 | 体育";
  if (has(kMusic))   return "国际频道 | 音乐";
  if (has(kGame))    return "国际频道 | 游戏";
  return "国际频道 | 综合";
}

// ============================================================
//  频道名称标准化（含别名映射）
// ============================================================

// 内置别名表，可在 KV admin:aliases 中覆盖/扩展
// 格式: { "原始写法（大写无空格）": "标准名称" }
const BUILTIN_ALIASES = {
  // 卫视
  "东方卫视": "东方卫视", "STV": "东方卫视", "DRAGONTV": "东方卫视",
  "北京卫视": "北京卫视", "BTV": "北京卫视",
  "湖南卫视": "湖南卫视", "HUNANTV": "湖南卫视", "芒果TV": "湖南卫视",
  "浙江卫视": "浙江卫视", "ZJTV": "浙江卫视",
  "江苏卫视": "江苏卫视", "JSTV": "江苏卫视",
  "广东卫视": "广东卫视", "GDTV": "广东卫视",
  "深圳卫视": "深圳卫视", "SZTV": "深圳卫视",
  "安徽卫视": "安徽卫视", "AHTV": "安徽卫视",
  "山东卫视": "山东卫视", "SDTV": "山东卫视",
  "四川卫视": "四川卫视", "SCTV": "四川卫视",
  "河南卫视": "河南卫视", "HNTV": "河南卫视",
  "湖北卫视": "湖北卫视", "HBTV": "湖北卫视",
  // 港台
  "翡翠台": "TVB翡翠", "TVBJADE": "TVB翡翠", "TVBJADECANTONESE": "TVB翡翠",
  "明珠台": "TVB明珠", "TVBPEARL": "TVB明珠",
  "凤凰卫视": "凤凰卫视", "PHOENIXTV": "凤凰卫视", "FHDT": "凤凰卫视",
  "凤凰资讯": "凤凰资讯台", "PHOENIXNEWS": "凤凰资讯台",
  "东森新闻": "东森新闻", "ETNEWS": "东森新闻",
  "中天新闻": "中天新闻", "CTNEWS": "中天新闻",
  "三立新闻": "三立新闻", "SETNEWS": "三立新闻",
  "TVBS新闻": "TVBS新闻",
  // 国际
  "CNNINT": "CNN", "CNNHD": "CNN",
  "BBCWORLD": "BBC World", "BBCWORLDNEWS": "BBC World",
  "NHKWORLD": "NHK World", "NHKWORLDJAPAN": "NHK World",
  "ALJAZEERAENGLISH": "Al Jazeera", "ALJAZEERA": "Al Jazeera",
};

let _aliasCache = null;

async function loadAliases(env) {
  if (_aliasCache) return _aliasCache;
  try {
    const raw = await env.IPTV_KV.get('admin:aliases');
    const custom = raw ? JSON.parse(raw) : {};
    _aliasCache = { ...BUILTIN_ALIASES, ...custom };
  } catch {
    _aliasCache = { ...BUILTIN_ALIASES };
  }
  return _aliasCache;
}

function normalizeName(raw, aliases = {}) {
  const n = raw.trim();
  const isPlus = /CCTV\s*[-_]?\s*5\s*\+|CCTV\s*[-_]?\s*5\s*PLUS/i.test(n);
  let u = n.toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '')
    .replace(/高清|超清|标清|HD|4K|8K|频道|综合|国际版?|中文版?/g, '');

  // CCTV 专项处理
  if (/CCTV[_-]?4K/i.test(n)) return 'CCTV4K';
  if (/CCTV[_-]?8K/i.test(n)) return 'CCTV8K';
  if (isPlus) return 'CCTV5+';
  const cctvMatch = u.match(/CCTV(\d{1,2})/);
  if (cctvMatch) return `CCTV${parseInt(cctvMatch[1])}`;

  // 别名映射（用处理后的大写无空格版本匹配）
  const uClean = n.toUpperCase().replace(/\s+/g, '').replace(/[-_]/g, '')
    .replace(/高清|超清|标清|HD|频道|国际版?|中文版?/g, '');
  if (aliases[uClean]) return aliases[uClean];
  // 也尝试原始大写
  if (aliases[n.toUpperCase()]) return aliases[n.toUpperCase()];

  return n;
}

// ============================================================
//  黑白名单加载
// ============================================================
async function loadFilters(env) {
  try {
    const raw = await env.IPTV_KV.get('admin:filters');
    if (!raw) return { blacklist: [], whitelist: [] };
    return JSON.parse(raw);
  } catch {
    return { blacklist: [], whitelist: [] };
  }
}

function isChannelAllowed(name, filters) {
  const n = name.toUpperCase();
  // 白名单：若有配置，只允许白名单内的频道
  if (filters.whitelist && filters.whitelist.length > 0) {
    return filters.whitelist.some(kw => n.includes(kw.toUpperCase()));
  }
  // 黑名单：匹配到则过滤
  if (filters.blacklist && filters.blacklist.length > 0) {
    return !filters.blacklist.some(kw => n.includes(kw.toUpperCase()));
  }
  return true;
}

// ============================================================
//  通用配置读取
//  KV key: admin:config  (JSON)
//  字段:
//    cronIntervalHours  number  Cron 最小触发间隔（小时），默认 6
//    m3uCacheSeconds    number  M3U 文件 Cache-Control max-age（秒），默认 1800
// ============================================================
const CONFIG_DEFAULTS = {
  cronIntervalHours: 6,
  m3uCacheSeconds:   1800,
};

async function loadConfig(env) {
  try {
    const raw = await env.IPTV_KV.get('admin:config');
    if (!raw) return { ...CONFIG_DEFAULTS };
    return { ...CONFIG_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}

// ============================================================
//  信号源管理
// ============================================================
async function loadSources(env) {
  // KV 中的 sources 优先于环境变量
  try {
    const kvSources = await env.IPTV_KV.get('admin:sources');
    if (kvSources && kvSources.trim()) return kvSources.trim();
  } catch {}
  return (env.M3U_SOURCES || FALLBACK_SOURCES).trim();
}

// ============================================================
//  M3U 解析
// ============================================================
function parseM3U(content, region, aliases, filters) {
  const extracted = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const rawName = line.includes(',') ? line.split(',').slice(1).join(',').trim() : line.split(':').pop().trim();
      if (i + 1 < lines.length) {
        const link = lines[i+1].trim();
        if (link.startsWith('http')) {
          const name  = normalizeName(rawName, aliases);
          // 过滤黑白名单
          if (!isChannelAllowed(name, filters)) continue;
          const group = detectGroup(name, region);
          extracted.push({ group, name, link });
        }
      }
    }
  }
  return extracted;
}

function sortKey(g, n) {
  const gOrder = GROUP_ORDER[g] ?? 999;
  if (g.includes("央视")) {
    const numMap = { 'CCTV5+': 5.5, 'CCTV4K': 18, 'CCTV8K': 19 };
    if (numMap[n] !== undefined) return [gOrder, 0, numMap[n], ''];
    const m = n.match(/CCTV(\d+)/i);
    if (m) return [gOrder, 0, parseInt(m[1]), ''];
    return [gOrder, 0, 99, n];
  }
  return [gOrder, 1, 0, n];
}

function buildM3UContent(items, mode) {
  const lines = ["#EXTM3U"];
  for (const [key, links] of items) {
    const [g, n] = key.split('\x00');
    const isCctv = g.includes("央视");
    const isLite = isCctv || g.includes("卫视") || g.includes("香港") || g.includes("台湾");
    if (mode === "full" || (mode === "lite" && isLite) || (mode === "cctv" && isCctv)) {
      for (const l of links) {
        lines.push(`#EXTINF:-1 group-title="${g}",${n}`, l);
      }
    }
  }
  return lines.join('\n') + '\n';
}

// ============================================================
//  Cloudflare 用量查询
// ============================================================
async function fetchUsage(env) {
  // 缓存 5 分钟，避免每次渲染状态页都打 CF GraphQL
  try {
    const cached = await env.IPTV_KV.get('usage_cache');
    if (cached) return JSON.parse(cached);
  } catch {}

  const token       = env.CF_API_TOKEN;
  const accountId   = env.CF_ACCOUNT_ID;
  const workerName  = env.CF_WORKER_NAME;
  const namespaceId = env.CF_KV_NAMESPACE_ID;

  const missing = [];
  if (!token)      missing.push('CF_API_TOKEN');
  if (!accountId)  missing.push('CF_ACCOUNT_ID');
  if (!workerName) missing.push('CF_WORKER_NAME');
  if (missing.length > 0) return { missing };

  const now     = new Date();
  const start   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end     = new Date(now.getTime() + 60000);
  const dateStr = start.toISOString().slice(0, 10);
  const dateTomorrow = new Date(start.getTime() + 86400000).toISOString().slice(0, 10);

  const workerQuery = `{
    viewer {
      accounts(filter: {accountTag: "${accountId}"}) {
        workersInvocationsAdaptive(
          limit: 1
          filter: {
            scriptName: "${workerName}"
            datetime_geq: "${start.toISOString()}"
            datetime_leq: "${end.toISOString()}"
          }
        ) {
          sum { requests errors }
        }
      }
    }
  }`;

  const kvFilter = namespaceId
    ? `namespaceId: "${namespaceId}", date_geq: "${dateStr}", date_leq: "${dateTomorrow}"`
    : `date_geq: "${dateStr}", date_leq: "${dateTomorrow}"`;

  const kvQuery = `{
    viewer {
      accounts(filter: {accountTag: "${accountId}"}) {
        kvOperationsAdaptiveGroups(
          limit: 10000
          filter: { ${kvFilter} }
        ) {
          sum { requests }
          dimensions { actionType }
        }
      }
    }
  }`;

  try {
    const [wRes, kvRes] = await Promise.all([
      fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: workerQuery })
      }),
      fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: kvQuery })
      })
    ]);

    const wData  = await wRes.json();
    const kvData = await kvRes.json();
    const wSum   = wData?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive?.[0]?.sum ?? {};
    const kvGroups = kvData?.data?.viewer?.accounts?.[0]?.kvOperationsAdaptiveGroups ?? [];
    const kvSum  = { read: 0, write: 0, delete: 0, list: 0 };
    for (const g of kvGroups) {
      const t = (g.dimensions?.actionType || '').toLowerCase();
      const n = g.sum?.requests || 0;
      if      (t === 'read')   kvSum.read   += n;
      else if (t === 'write')  kvSum.write  += n;
      else if (t === 'delete') kvSum.delete += n;
      else if (t === 'list')   kvSum.list   += n;
    }

    const result = {
      requests:  wSum.requests || 0,
      errors:    wSum.errors   || 0,
      kvReads:   kvSum.read,
      kvWrites:  kvSum.write,
      kvDeletes: kvSum.delete,
      kvLists:   kvSum.list,
      date: dateStr,
    };
    // 缓存 5 分钟
    await env.IPTV_KV.put('usage_cache', JSON.stringify(result), { expirationTtl: 300 });
    return result;
  } catch(e) {
    return { error: e.message };
  }
}

// ============================================================
//  历史记录管理（最近 7 次构建）
// ============================================================
const HISTORY_MAX = 7;
const HISTORY_KEY = 'build_history';

async function appendBuildHistory(env, meta) {
  let history = [];
  try {
    const raw = await env.IPTV_KV.get(HISTORY_KEY);
    if (raw) history = JSON.parse(raw);
  } catch {}

  history.unshift({
    lastBuild: meta.lastBuild,
    duration:  meta.duration,
    dedup:     meta.dedup,
    valid:     meta.valid,
    raw:       meta.raw,
    sourceOk:  meta.sources.filter(s => !s.error).length,
    sourceTotal: meta.sources.length,
  });

  if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
  await env.IPTV_KV.put(HISTORY_KEY, JSON.stringify(history));
  return history;
}

// ============================================================
//  频道变化 Diff
// ============================================================
function computeChannelDiff(prevMeta, currMeta) {
  if (!prevMeta || !prevMeta.channelNames || !currMeta.channelNames) return null;
  const prev = new Set(prevMeta.channelNames);
  const curr = new Set(currMeta.channelNames);
  const added   = [...curr].filter(n => !prev.has(n));
  const removed = [...prev].filter(n => !curr.has(n));
  return { added, removed };
}

// ============================================================
//  核心构建逻辑
// ============================================================
async function buildAll(env) {
  const startTime = Date.now();

  // 并行加载配置
  const [sourcesRaw, aliases, filters] = await Promise.all([
    loadSources(env),
    loadAliases(env),
    loadFilters(env),
  ]);

  const sourceLines = sourcesRaw.split('\n').filter(l => l.trim() && !l.startsWith('#'));

  const fetchResults = await Promise.allSettled(
    sourceLines.map(async (srcLine) => {
      const parts  = srcLine.trim().split(/\s+/);
      const url    = parts[0];
      const region = parts.slice(1).join(' ') || '';
      try {
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IPTV-Worker/1.0)' },
          cf: { cacheTtl: 0 }
        });
        if (!resp.ok) return { url, region, error: `HTTP ${resp.status}`, channels: [] };
        const text     = await resp.text();
        const channels = parseM3U(text, region, aliases, filters);
        return { url, region, channels, parsed: channels.length };
      } catch(e) {
        return { url, region, error: e.message, channels: [] };
      }
    })
  );

  const channelsMap = new Map();
  const seenUrls    = new Set();

  // 按源索引统计实际采用的链接数（去重后首次出现才算采用）
  const adoptedPerSource = new Array(fetchResults.length).fill(0);
  const allRaw = fetchResults.map((r, idx) =>
    r.status === 'fulfilled' ? (r.value?.channels ?? []).map(ch => ({ ...ch, srcIdx: idx })) : []
  ).flat();

  for (const { group, name, link, srcIdx } of allRaw) {
    if (!seenUrls.has(link)) {
      const key = `${group}\x00${name}`;
      if (!channelsMap.has(key)) channelsMap.set(key, []);
      channelsMap.get(key).push(link);
      seenUrls.add(link);
      adoptedPerSource[srcIdx]++;
    }
  }

  const items = [...channelsMap.entries()].sort((a, b) => {
    const [ag, an] = a[0].split('\x00');
    const [bg, bn] = b[0].split('\x00');
    const ka = sortKey(ag, an);
    const kb = sortKey(bg, bn);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });

  const fullM3u = buildM3UContent(items, "full");
  const liteM3u = buildM3UContent(items, "lite");
  const cctvM3u = buildM3UContent(items, "cctv");

  const sourcesStatus = fetchResults.map((r, idx) => ({
    url:     r.value?.url    ?? '?',
    parsed:  r.value?.parsed ?? 0,
    adopted: adoptedPerSource[idx],
    error:   r.value?.error  ?? null,
  }));

  const groupCounts = {};
  for (const [key] of items) {
    const [g] = key.split('\x00');
    groupCounts[g] = (groupCounts[g] ?? 0) + 1;
  }

  // 保存当前频道名称集合，用于下次 diff
  const channelNames = [...channelsMap.keys()].map(k => k.split('\x00')[1]);

  const meta = {
    lastBuild: new Date().toISOString(),
    duration:  ((Date.now() - startTime) / 1000).toFixed(2),
    raw:       allRaw.length,
    valid:     seenUrls.size,
    dedup:     items.length,
    sources:   sourcesStatus,
    groupCounts,
    channelNames,
    sizes: { full: fullM3u.length, lite: liteM3u.length, cctv: cctvM3u.length }
  };

  // 读取上次 meta 用于 diff
  let prevMeta = null;
  try {
    const prevStr = await env.IPTV_KV.get('meta');
    if (prevStr) prevMeta = JSON.parse(prevStr);
  } catch {}

  const diff = computeChannelDiff(prevMeta, meta);

  await Promise.all([
    env.IPTV_KV.put('full.m3u', fullM3u),
    env.IPTV_KV.put('lite.m3u', liteM3u),
    env.IPTV_KV.put('cctv.m3u', cctvM3u),
    env.IPTV_KV.put('meta', JSON.stringify(meta)),
    appendBuildHistory(env, meta),
  ]);

  return { meta, diff };
}

// ============================================================
//  Telegram 通知
// ============================================================
async function sendTelegramNotify(env, meta, trigger = 'cron', diff = null) {
  const token  = env.TG_TOKEN;
  const chatId = env.TG_CHAT_ID;
  if (!token || !chatId) return;

  const fmtDate = iso => new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const fmtSize = b => b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;

  const successSources = meta.sources.filter(s => !s.error).length;
  const failSources    = meta.sources.filter(s =>  s.error).length;
  const failLines      = meta.sources.filter(s => s.error)
    .map(s => `  ❌ ${s.url.replace(/^https?:\/\//, '').split('/')[0]}`).join('\n');

  const triggerLabel = trigger === 'cron' ? '⏰ 定时构建' : '🔧 手动构建';

  // 频道变化 diff
  let diffText = '';
  if (diff) {
    const addedCount   = diff.added.length;
    const removedCount = diff.removed.length;
    if (addedCount > 0 || removedCount > 0) {
      diffText = `\n📋 *频道变化*\n`;
      if (addedCount > 0) {
        const preview = diff.added.slice(0, 5).join('、');
        diffText += `• ✅ 新增 ${addedCount} 个：${preview}${addedCount > 5 ? ` 等` : ''}\n`;
      }
      if (removedCount > 0) {
        const preview = diff.removed.slice(0, 5).join('、');
        diffText += `• ❌ 消失 ${removedCount} 个：${preview}${removedCount > 5 ? ` 等` : ''}`;
      }
    } else {
      diffText = `\n📋 *频道变化*\n• 与上次相比无变化`;
    }
  }

  const text = [
    `📺 *IPTV 合并服务 · 构建完成*`,
    ``,
    `${triggerLabel}`,
    `🕒 时间：${fmtDate(meta.lastBuild)}`,
    `⏱ 耗时：${meta.duration}s`,
    ``,
    `📊 *构建结果*`,
    `• 原始抓取：${meta.raw} 条链接`,
    `• 有效链接：${meta.valid} 条`,
    `• 最终频道：${meta.dedup} 个`,
    diffText,
    ``,
    `📡 *信号源状态*`,
    `• ✅ 成功：${successSources} 个`,
    `• ❌ 失败：${failSources} 个`,
    failLines ? `\n失败详情：\n${failLines}` : '',
    ``,
    `💾 *文件大小*`,
    `• 完整版：${fmtSize(meta.sizes.full)}`,
    `• 精简版：${fmtSize(meta.sizes.lite)}`,
    `• 央视版：${fmtSize(meta.sizes.cctv)}`,
  ].filter(l => l !== undefined).join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
    });
  } catch(e) {
    console.error('Telegram notify failed:', e.message);
  }
}

async function sendTelegramSubscribeNotify(env, filename, ua, ip) {
  const token  = env.TG_TOKEN;
  const chatId = env.TG_CHAT_ID;
  if (!token || !chatId) return;

  const nameMap = { 'full.m3u': '完整版', 'lite.m3u': '精简版', 'cctv.m3u': '央视版' };
  const label   = nameMap[filename] || filename;
  const now     = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const uaShort = ua.length > 60 ? ua.slice(0, 60) + '…' : ua;
  // 对 IP 掩码保护（只展示前两段）
  const ipMasked = ip.split('.').length === 4
    ? ip.split('.').slice(0,2).join('.') + '.*.*'
    : ip.split(':').slice(0,3).join(':') + ':…';

  const text = [
    `📥 *IPTV 订阅更新*`,
    ``,
    `📄 文件：${label} (\`${filename}\`)`,
    `🕒 时间：${now}`,
    `🌐 IP：${ipMasked}`,
    `📱 客户端：${uaShort}`,
    ``,
    `_冷却中，1 小时内同文件不再重复通知_`,
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
    });
  } catch(e) {
    console.error('Telegram subscribe notify failed:', e.message);
  }
}

// ============================================================
//  状态页 HTML
// ============================================================
function renderStatusPage(meta, baseUrl, usage, history) {
  const fmtSize = b => b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;
  const fmtDate = iso => new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const sortedGroups = Object.entries(meta.groupCounts)
    .sort((a,b) => (GROUP_ORDER[a[0]]??999) - (GROUP_ORDER[b[0]]??999));

  const regionMap = {};
  for (const [g, c] of sortedGroups) {
    const region = g.split(' | ')[0];
    if (!regionMap[region]) regionMap[region] = [];
    regionMap[region].push([g, c]);
  }

  const regionIcons = { '中国大陆':'🇨🇳', '中国香港':'🇭🇰', '中国台湾':'🇹🇼', '国际频道':'🌐' };

  const groupSections = Object.entries(regionMap).map(([region, groups]) => {
    const cards = groups.map(([g, c]) => {
      const subName = g.split(' | ')[1] || g;
      return `<div class="g-card"><div class="g-name">${subName}</div><div class="g-count">${c}</div></div>`;
    }).join('');
    return `<div class="region-section">
      <div class="section-title">${regionIcons[region] || '📺'} ${region}</div>
      <div class="g-grid">${cards}</div>
    </div>`;
  }).join('');

  const totalAdopted = meta.valid || 1;
  const sourceItems = meta.sources.map(s => {
    const domain  = s.url.replace(/^https?:\/\//, '').split('/')[0];
    if (s.error) return `
      <div class="src-item err">
        <span class="src-dot red"></span>
        <span class="src-name" title="${s.url}">${domain}</span>
        <span class="src-tag fail">失败</span>
        <span class="src-err">${s.error.slice(0,60)}</span>
      </div>`;
    const adopted  = s.adopted ?? 0;
    const pct      = totalAdopted > 0 ? Math.round(adopted / totalAdopted * 100) : 0;
    const dupCount = s.parsed - adopted;
    return `
      <div class="src-item">
        <span class="src-dot green"></span>
        <span class="src-name" title="${s.url}">${domain}</span>
        <span class="src-tag ok">正常</span>
        <div class="src-stats">
          <span class="src-count">解析 ${s.parsed}</span>
          <span class="src-sep">·</span>
          <span class="src-adopted">采用 <b>${adopted}</b></span>
          <span class="src-pct-wrap"><span class="src-pct-bar" style="width:${pct}%"></span></span>
          <span class="src-pct-label">${pct}%</span>
          ${dupCount > 0 ? `<span class="src-dup">去重 ${dupCount}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  // 历史构建图表数据
  const historyHtml = (() => {
    if (!history || history.length < 2) return `<p style="font-size:13px;color:#aaa;padding:4px 0">构建次数不足，暂无趋势图</p>`;
    const maxDedup = Math.max(...history.map(h => h.dedup), 1);
    const bars = [...history].reverse().map((h, i) => {
      const pct = Math.round((h.dedup / maxDedup) * 100);
      const dt  = new Date(h.lastBuild).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
      const srcOkPct = h.sourceTotal > 0 ? Math.round(h.sourceOk / h.sourceTotal * 100) : 100;
      const barColor = srcOkPct < 50 ? '#ef4444' : srcOkPct < 80 ? '#f59e0b' : '#2563eb';
      return `<div class="hist-bar-wrap" title="${dt}｜${h.dedup} 频道｜耗时 ${h.duration}s">
        <div class="hist-bar-bg">
          <div class="hist-bar-fill" style="height:${pct}%;background:${barColor}"></div>
        </div>
        <div class="hist-label">${h.dedup}</div>
        <div class="hist-time">${dt.split(' ')[0]}</div>
      </div>`;
    }).join('');
    return `<div class="hist-chart">${bars}</div>
      <div class="hist-hint">颜色代表信号源成功率 <span style="color:#2563eb">●</span>正常 <span style="color:#f59e0b">●</span>偏低 <span style="color:#ef4444">●</span>较差（近 ${history.length} 次构建）</div>`;
  })();

  // 用量面板
  function usageBar(used, limit, label, unit) {
    const pct     = limit ? Math.min(100, Math.round(used / limit * 100)) : 0;
    const fillCls = pct >= 90 ? 'fill-danger' : pct >= 70 ? 'fill-warn' : 'fill-ok';
    const pctCls  = pct >= 90 ? 'pct-danger'  : pct >= 70 ? 'pct-warn'  : 'pct-ok';
    return `<div class="usage-item">
      <div class="usage-head">
        <span class="usage-name">${label}</span>
        <span class="usage-nums"><b>${used.toLocaleString()}</b> / ${limit.toLocaleString()}${unit}</span>
      </div>
      <div class="usage-bar-bg"><div class="usage-bar-fill ${fillCls}" style="width:${pct}%"></div></div>
      <div class="usage-pct ${pctCls}">${pct}%</div>
    </div>`;
  }

  let usageHtml = '';
  if (!usage) {
    usageHtml = `<p style="font-size:13px;color:#aaa;padding:4px 0">用量数据不可用</p>`;
  } else if (usage.missing) {
    const allVars = ['CF_API_TOKEN','CF_ACCOUNT_ID','CF_WORKER_NAME'];
    const rows = allVars.map(v => {
      const ok = !usage.missing.includes(v);
      return `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px;font-size:12px;">
        <span style="width:7px;height:7px;border-radius:50%;background:${ok?'#22c55e':'#ef4444'};flex-shrink:0"></span>
        <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px">${v}</code>
        <span style="color:${ok?'#16a34a':'#dc2626'}">${ok?'已配置':'未配置'}</span>
      </span>`;
    }).join('');
    usageHtml = `<div style="margin-bottom:10px">${rows}</div>
      <p style="font-size:12px;color:#aaa">请在 Worker → 设置 → 变量和机密 中补全缺失的变量后刷新页面</p>`;
  } else if (usage.error) {
    usageHtml = `<div class="usage-err">⚠️ 查询失败：${usage.error}</div>`;
  } else {
    usageHtml = `<div class="usage-grid">
      ${usageBar(usage.requests, 100000, '🌐 Worker 请求数', ' 次')}
      ${usageBar(usage.kvReads,  100000, '📖 KV 读取',      ' 次')}
      ${usageBar(usage.kvWrites, 1000,   '✏️ KV 写入',      ' 次')}
      ${usageBar(usage.kvLists + usage.kvDeletes, 1000, '🗂️ KV 列表/删除', ' 次')}
    </div>
    <div class="usage-hint">免费版每日额度 · 数据来自 Cloudflare Analytics API · ${usage.date} UTC（有 5~30 分钟延迟）</div>`;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>IPTV 合并服务</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f0f2f5; color: #1a1a2e; font-family: 'Noto Sans SC', 'Inter', sans-serif; min-height: 100vh; padding-bottom: 60px; }
  .hero { text-align: center; padding: 52px 20px 40px; }
  .hero-label { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: #666; margin-bottom: 14px; font-weight: 500; }
  .hero-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px #22c55e30; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 3px #22c55e30; } 50% { box-shadow: 0 0 0 6px #22c55e15; } }
  .hero h1 { font-size: clamp(32px, 5vw, 52px); font-weight: 700; letter-spacing: -1.5px; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1.1; margin-bottom: 10px; }
  .hero-sub { font-size: 14px; color: #888; margin-bottom: 6px; }
  .hero-meta { font-size: 12px; color: #aaa; }
  .hero-meta span { color: #2563eb; font-weight: 500; }
  .hero-actions { display: flex; gap: 10px; justify-content: center; margin-top: 18px; flex-wrap: wrap; }
  .hero-btn { display: inline-block; padding: 7px 18px; border-radius: 20px; border: 1px solid #e5e7eb; background: #fff; font-size: 12px; color: #555; text-decoration: none; transition: background .15s, color .15s, border-color .15s; cursor: pointer; font-family: inherit; }
  .hero-btn:hover { background: #f9fafb; color: #111; border-color: #d1d5db; }
  .hero-btn.admin { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
  .hero-btn.admin:hover { background: #dbeafe; }
  .container { max-width: 960px; margin: 0 auto; padding: 0 20px; }
  .stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 28px; }
  .stat { background: #fff; border-radius: 16px; padding: 22px 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); position: relative; overflow: hidden; }
  .stat::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #2563eb, #06b6d4); border-radius: 0 0 16px 16px; }
  .stat-num { font-size: 34px; font-weight: 700; color: #111; line-height: 1; letter-spacing: -1px; }
  .stat-num small { font-size: 18px; color: #aaa; font-weight: 400; }
  .stat-label { font-size: 12px; color: #888; margin-top: 6px; }
  .stat-sub { font-size: 11px; color: #bbb; margin-top: 3px; }
  .section-head { font-size: 13px; font-weight: 600; color: #444; margin: 0 0 14px; padding-left: 12px; display: flex; align-items: center; gap: 8px; position: relative; }
  .section-head::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 14px; background: linear-gradient(#2563eb, #06b6d4); border-radius: 2px; }
  .sub-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 28px; }
  .sub-card { background: #fff; border-radius: 14px; padding: 20px 18px 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.055); display: block; transition: transform .15s, box-shadow .15s; border: 1.5px solid transparent; cursor: pointer; }
  .sub-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); border-color: #2563eb30; }
  .sub-card.copied { border-color: #22c55e !important; background: #f0fdf4; }
  .copy-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(10px); background: #111; color: #fff; font-size: 13px; font-weight: 500; padding: 10px 22px; border-radius: 24px; opacity: 0; pointer-events: none; transition: opacity .25s, transform .25s; z-index: 999; white-space: nowrap; }
  .copy-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .sub-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 12px; }
  .icon-full { background: #eff6ff; } .icon-lite { background: #ecfdf5; } .icon-cctv { background: #fef2f2; }
  .sub-name { font-size: 15px; font-weight: 600; color: #111; margin-bottom: 4px; }
  .sub-desc { font-size: 12px; color: #888; margin-bottom: 10px; }
  .sub-url { font-size: 11px; color: #aaa; font-family: 'Inter', monospace; word-break: break-all; background: #f8fafc; border-radius: 6px; padding: 5px 8px; line-height: 1.5; }
  .sub-size { display: inline-block; font-size: 11px; background: #f1f5f9; color: #64748b; border-radius: 5px; padding: 2px 7px; margin-bottom: 8px; }
  .panel { background: #fff; border-radius: 16px; padding: 24px 24px 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 18px; }
  .region-section { margin-bottom: 20px; }
  .section-title { font-size: 13px; font-weight: 600; color: #555; margin-bottom: 10px; }
  .g-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
  .g-card { background: #f8fafc; border-radius: 10px; padding: 11px 14px; display: flex; align-items: center; justify-content: space-between; border: 1px solid #f1f5f9; transition: background .15s; }
  .g-card:hover { background: #eff6ff; border-color: #bfdbfe; }
  .g-name { font-size: 12px; color: #444; }
  .g-count { font-size: 13px; font-weight: 700; background: linear-gradient(135deg, #2563eb, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .src-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .src-item:last-child { border-bottom: none; }
  .src-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .src-dot.green { background: #22c55e; box-shadow: 0 0 0 3px #22c55e25; }
  .src-dot.red   { background: #ef4444; box-shadow: 0 0 0 3px #ef444425; }
  .src-name { flex: 1; font-family: 'Inter', monospace; font-size: 12px; color: #444; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .src-tag { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; flex-shrink: 0; }
  .src-tag.ok   { background: #dcfce7; color: #16a34a; }
  .src-tag.fail { background: #fee2e2; color: #dc2626; }
  .src-count { font-size: 12px; color: #aaa; flex-shrink: 0; }
  .src-err { font-size: 11px; color: #ef4444; flex-shrink: 0; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .src-stats { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .src-adopted { font-size: 12px; color: #555; flex-shrink: 0; }
  .src-adopted b { color: #2563eb; font-weight: 600; }
  .src-sep { font-size: 12px; color: #ddd; flex-shrink: 0; }
  .src-pct-wrap { width: 60px; height: 5px; background: #e5e7eb; border-radius: 3px; overflow: hidden; flex-shrink: 0; }
  .src-pct-bar { height: 100%; background: linear-gradient(90deg, #2563eb, #06b6d4); border-radius: 3px; transition: width .4s ease; }
  .src-pct-label { font-size: 11px; font-weight: 600; color: #2563eb; min-width: 28px; text-align: right; flex-shrink: 0; }
  .src-dup { font-size: 11px; color: #bbb; background: #f1f5f9; padding: 1px 6px; border-radius: 10px; flex-shrink: 0; }
  .usage-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
  .usage-item { background: #f8fafc; border-radius: 12px; padding: 14px 16px; border: 1px solid #f1f5f9; }
  .usage-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .usage-name { font-size: 12px; color: #666; font-weight: 500; }
  .usage-nums { font-size: 12px; color: #999; }
  .usage-nums b { color: #111; font-weight: 600; }
  .usage-bar-bg { height: 6px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
  .usage-bar-fill { height: 100%; border-radius: 4px; }
  .fill-ok    { background: linear-gradient(90deg, #2563eb, #06b6d4); }
  .fill-warn  { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
  .fill-danger{ background: linear-gradient(90deg, #ef4444, #f97316); }
  .usage-pct { font-size: 11px; margin-top: 5px; text-align: right; font-weight: 600; }
  .pct-ok     { color: #2563eb; } .pct-warn { color: #d97706; } .pct-danger { color: #dc2626; }
  .usage-err  { font-size: 12px; color: #ef4444; padding: 8px 0; }
  .usage-hint { font-size: 11px; color: #bbb; margin-top: 10px; text-align: right; }
  /* 历史趋势图 */
  .hist-chart { display: flex; align-items: flex-end; gap: 8px; height: 90px; }
  .hist-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: default; }
  .hist-bar-bg { width: 100%; flex: 1; display: flex; align-items: flex-end; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
  .hist-bar-fill { width: 100%; border-radius: 5px; transition: height .4s ease; min-height: 4px; }
  .hist-label { font-size: 10px; font-weight: 600; color: #555; }
  .hist-time  { font-size: 9px; color: #bbb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .hist-hint  { font-size: 11px; color: #bbb; margin-top: 10px; text-align: right; }
  footer { text-align: center; padding-top: 36px; font-size: 12px; color: #bbb; }
  footer a { color: #2563eb; text-decoration: none; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @media (max-width: 640px) {
    .stats, .sub-grid, .usage-grid { grid-template-columns: repeat(2, 1fr); }
    .g-grid { grid-template-columns: repeat(2, 1fr); }
    .src-err, .src-dup, .src-pct-wrap { display: none; }
    .hero-actions { gap: 8px; }
  }
</style>
</head>
<body>

<div class="hero">
  <div class="hero-label"><span class="hero-dot"></span>IPTV Merge Service</div>
  <h1>IPTV 合并服务</h1>
  <p class="hero-sub">Powered by Cloudflare Workers</p>
  <p class="hero-meta">最后更新：<span>${fmtDate(meta.lastBuild)}</span> · 耗时 ${meta.duration}s</p>
  <div class="hero-actions">
    <a class="hero-btn admin" href="/admin">⚙️ 管理</a>
    <a class="hero-btn" href="/logout">退出登录</a>
  </div>
</div>

<div class="container">

  <div class="stats">
    <div class="stat">
      <div class="stat-num">${meta.dedup}</div>
      <div class="stat-label">最终频道数</div>
      <div class="stat-sub">去重合并后</div>
    </div>
    <div class="stat">
      <div class="stat-num">${meta.valid}</div>
      <div class="stat-label">有效链接数</div>
      <div class="stat-sub">原始抓取 ${meta.raw} 条</div>
    </div>
    <div class="stat">
      <div class="stat-num">${meta.sources.filter(s=>!s.error).length}<small>/${meta.sources.length}</small></div>
      <div class="stat-label">源成功率</div>
      <div class="stat-sub">信号源健康状态</div>
    </div>
  </div>

  <div class="section-head">Cloudflare 免费额度 <span style="font-size:11px;font-weight:400;color:#aaa;margin-left:4px">今日 UTC</span></div>
  <div class="panel" style="margin-bottom:28px">
    ${usageHtml}
  </div>

  <div class="section-head">历史构建趋势</div>
  <div class="panel" style="margin-bottom:28px">
    ${historyHtml}
  </div>

  <div class="section-head" style="justify-content:space-between">
    <span>订阅地址</span>
    <button id="rebuild-btn" onclick="triggerRebuild()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;border:1px solid #e5e7eb;background:#fff;font-size:12px;color:#555;cursor:pointer;font-family:inherit;transition:all .15s;">
      <span id="rebuild-icon">🔄</span>
      <span id="rebuild-text">立即构建</span>
    </button>
  </div>
  <div id="rebuild-msg" style="display:none;margin-bottom:12px;padding:10px 14px;border-radius:10px;font-size:13px"></div>
  <div class="sub-grid">
    <div class="sub-card" onclick="copyUrl(this, '${baseUrl}/full.m3u')">
      <div class="sub-icon icon-full">📺</div>
      <div class="sub-name">完整版</div>
      <div class="sub-desc">全部频道</div>
      <span class="sub-size">${fmtSize(meta.sizes.full)}</span>
      <div class="sub-url">${baseUrl}/full.m3u</div>
    </div>
    <div class="sub-card" onclick="copyUrl(this, '${baseUrl}/lite.m3u')">
      <div class="sub-icon icon-lite">🍃</div>
      <div class="sub-name">精简版</div>
      <div class="sub-desc">央视 + 卫视 + 港台</div>
      <span class="sub-size">${fmtSize(meta.sizes.lite)}</span>
      <div class="sub-url">${baseUrl}/lite.m3u</div>
    </div>
    <div class="sub-card" onclick="copyUrl(this, '${baseUrl}/cctv.m3u')">
      <div class="sub-icon icon-cctv">🔴</div>
      <div class="sub-name">央视版</div>
      <div class="sub-desc">仅央视频道</div>
      <span class="sub-size">${fmtSize(meta.sizes.cctv)}</span>
      <div class="sub-url">${baseUrl}/cctv.m3u</div>
    </div>
  </div>

  <div class="section-head">频道分组</div>
  <div class="panel">${groupSections}</div>

  <div class="section-head">信号源状态</div>
  <div class="panel">${sourceItems}</div>

</div>

<footer>
  <p>Powered by <a href="https://workers.cloudflare.com">Cloudflare Workers</a> · 建议使用 TiviMate 或 APTV 订阅</p>
</footer>

<div class="copy-toast" id="toast">✅ 链接已复制到剪贴板</div>

<script>
  let toastTimer;
  function copyUrl(el, url) {
    navigator.clipboard.writeText(url).then(() => {
      el.classList.add('copied');
      setTimeout(() => el.classList.remove('copied'), 1500);
      const toast = document.getElementById('toast');
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
    }).catch(() => {
      const range = document.createRange();
      const node = el.querySelector('.sub-url');
      range.selectNode(node);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });
  }

  async function triggerRebuild() {
    const btn  = document.getElementById('rebuild-btn');
    const icon = document.getElementById('rebuild-icon');
    const text = document.getElementById('rebuild-text');
    const msg  = document.getElementById('rebuild-msg');
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';
    icon.style.animation = 'spin 1s linear infinite';
    text.textContent = '构建中...';
    msg.style.display = 'none';
    try {
      const res  = await fetch('/rebuild', { method: 'POST', headers: { 'X-Requested-With': 'fetch' } });
      const data = await res.json();
      if (data.ok) {
        msg.style.cssText = 'display:block;margin-bottom:12px;padding:10px 14px;border-radius:10px;font-size:13px;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d';
        msg.textContent = \`✅ 构建完成！共 \${data.dedup} 个频道，耗时 \${data.duration}s。正在刷新页面...\`;
        setTimeout(() => location.reload(), 1200);
      } else {
        msg.style.cssText = 'display:block;margin-bottom:12px;padding:10px 14px;border-radius:10px;font-size:13px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626';
        msg.textContent = '❌ 构建失败：' + (data.error || '未知错误');
      }
    } catch(e) {
      msg.style.cssText = 'display:block;margin-bottom:12px;padding:10px 14px;border-radius:10px;font-size:13px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626';
      msg.textContent = '❌ 请求失败：' + e.message;
    } finally {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      icon.style.animation = '';
      text.textContent = '立即构建';
    }
  }
</script>

</body>
</html>`;
}

// ============================================================
//  管理页 HTML
// ============================================================
function renderAdminPage(sources, filters, aliases, config, msg = '') {
  const sourcesVal  = (sources  || '').replace(/</g,'&lt;');
  const filtersVal  = JSON.stringify(filters  || { blacklist: [], whitelist: [] }, null, 2);
  const aliasesVal  = JSON.stringify(aliases  || {}, null, 2);
  const cfg         = config || CONFIG_DEFAULTS;
  const msgHtml = msg ? `<div class="notice ${msg.ok ? 'ok' : 'err'}">${msg.ok ? '✅' : '❌'} ${msg.text}</div>` : '';

  // 服务端用于初始渲染缓存时长的友好文字
  function formatCacheVal(minutes) {
    if (minutes < 60)   return `${minutes} 分钟`;
    if (minutes < 1440) return `${+(minutes / 60).toFixed(1)} 小时`;
    return '24 小时';
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>IPTV · 管理</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f0f2f5; color: #1a1a2e; font-family: 'Noto Sans SC', 'Inter', sans-serif; min-height: 100vh; padding-bottom: 60px; }
  .topbar { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; }
  .topbar-title { font-size: 15px; font-weight: 600; color: #111; display: flex; align-items: center; gap: 8px; }
  .topbar-back { font-size: 12px; color: #2563eb; text-decoration: none; padding: 5px 12px; border-radius: 16px; border: 1px solid #bfdbfe; background: #eff6ff; transition: background .15s; }
  .topbar-back:hover { background: #dbeafe; }
  .container { max-width: 900px; margin: 0 auto; padding: 28px 20px; }
  .notice { padding: 10px 16px; border-radius: 10px; font-size: 13px; margin-bottom: 20px; }
  .notice.ok  { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }
  .notice.err { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); padding: 24px; margin-bottom: 20px; }
  .card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .card-title { font-size: 14px; font-weight: 600; color: #111; }
  .card-desc { font-size: 12px; color: #888; margin-bottom: 14px; line-height: 1.6; }
  textarea { width: 100%; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; font-size: 12px; font-family: 'Inter', 'Menlo', monospace; color: #333; resize: vertical; outline: none; transition: border-color .2s, box-shadow .2s; background: #fafafa; line-height: 1.6; }
  textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 3px #2563eb12; background: #fff; }
  .btn { padding: 9px 20px; border-radius: 10px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity .2s, transform .15s; }
  .btn-primary { background: linear-gradient(135deg, #2563eb, #06b6d4); color: #fff; }
  .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
  .btn-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .btn-danger:hover { background: #fee2e2; }
  .btn-row { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
  .tag-list { display: flex; flex-wrap: wrap; gap: 7px; min-height: 34px; margin-bottom: 12px; }
  .tag { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .tag-black { background: #1f2937; color: #f9fafb; }
  .tag-white { background: #ecfdf5; color: #16a34a; border: 1px solid #bbf7d0; }
  .tag-alias { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
  .tag-del { cursor: pointer; color: #aaa; font-size: 14px; line-height: 1; }
  .tag-del:hover { color: #ef4444; }
  .inline-add { display: flex; gap: 8px; }
  .inline-add input { flex: 1; padding: 8px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 13px; outline: none; font-family: inherit; transition: border-color .2s; }
  .inline-add input:focus { border-color: #2563eb; }
  .alias-row { display: flex; gap: 8px; margin-bottom: 8px; }
  .alias-row input { flex: 1; padding: 7px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 12px; font-family: inherit; outline: none; transition: border-color .2s; }
  .alias-row input:focus { border-color: #2563eb; }
  .alias-label { font-size: 11px; color: #aaa; align-self: center; flex-shrink: 0; }
  .section-sep { height: 1px; background: #f1f5f9; margin: 18px 0; }
  .hint-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #92400e; margin-bottom: 14px; line-height: 1.6; }
  /* 定时配置 */
  .cfg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .cfg-item { background: #f8fafc; border-radius: 12px; padding: 16px 18px; border: 1px solid #f1f5f9; }
  .cfg-label { font-size: 13px; font-weight: 600; color: #111; margin-bottom: 5px; }
  .cfg-desc  { font-size: 11px; color: #888; margin-bottom: 14px; line-height: 1.6; }
  .slider-row { display: flex; align-items: center; gap: 10px; }
  .slider-row input[type=range] { flex: 1; accent-color: #2563eb; cursor: pointer; height: 4px; }
  .slider-val  { font-size: 20px; font-weight: 700; color: #2563eb; min-width: 36px; text-align: right; }
  .slider-unit { font-size: 12px; color: #aaa; }
  .slider-ticks { display: flex; justify-content: space-between; font-size: 10px; color: #bbb; margin-top: 4px; padding: 0 2px; }
  @media (max-width: 600px) { .cfg-grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-title">⚙️ 管理面板</div>
  <a class="topbar-back" href="/">← 返回状态页</a>
</div>

<div class="container">
  ${msgHtml}

  <!-- ===== 信号源管理 ===== -->
  <div class="card">
    <div class="card-head">
      <div class="card-title">📡 信号源管理</div>
    </div>
    <div class="card-desc">
      每行一个信号源，格式：<code>URL 地区</code>（地区可选）。保存后下次构建时生效，覆盖环境变量 M3U_SOURCES。<br>
      示例：<code>https://example.com/list.m3u 中国大陆</code>
    </div>
    <div class="hint-box">⚠️ 留空则回退到环境变量 <code>M3U_SOURCES</code>，删除所有内容即可恢复默认。</div>
    <textarea id="sources-ta" rows="8" placeholder="https://example.com/source1.m3u 中国大陆&#10;https://example.com/source2.m3u 中国香港">${sourcesVal}</textarea>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveSources()">💾 保存信号源</button>
      <button class="btn btn-danger" onclick="clearSources()">🗑️ 清空（使用环境变量）</button>
    </div>
  </div>

  <!-- ===== 黑名单 ===== -->
  <div class="card">
    <div class="card-head">
      <div class="card-title">🚫 频道黑名单</div>
    </div>
    <div class="card-desc">包含以下关键词的频道将在构建时自动过滤（不区分大小写）。适合屏蔽广告、成人、重复频道。</div>
    <div class="tag-list" id="blacklist-tags"></div>
    <div class="inline-add">
      <input id="bl-input" type="text" placeholder="输入关键词，如：购物、成人、直销" onkeydown="if(event.key==='Enter')addBlack()"/>
      <button class="btn btn-primary" onclick="addBlack()">添加</button>
    </div>

    <div class="section-sep"></div>

    <div class="card-title" style="margin-bottom:6px">✅ 频道白名单</div>
    <div class="card-desc">若填写，则<b>只保留</b>包含以下关键词的频道（优先级高于黑名单）。留空则不启用白名单。</div>
    <div class="tag-list" id="whitelist-tags"></div>
    <div class="inline-add">
      <input id="wl-input" type="text" placeholder="输入关键词，如：CCTV、卫视" onkeydown="if(event.key==='Enter')addWhite()"/>
      <button class="btn btn-primary" onclick="addWhite()">添加</button>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveFilters()">💾 保存黑白名单</button>
    </div>
  </div>

  <!-- ===== 别名映射 ===== -->
  <div class="card">
    <div class="card-head">
      <div class="card-title">🔄 频道别名映射</div>
    </div>
    <div class="card-desc">
      将不同写法映射到统一的标准名称，提升去重效果。<br>
      <b>原始写法</b>：大写、去掉空格/连字符，如 <code>DRAGONTVHD</code> → <b>标准名</b>：<code>东方卫视</code>。<br>
      内置了常见港台、卫视、国际台的映射，这里可以添加自定义扩展。
    </div>
    <div id="alias-rows"></div>
    <div class="btn-row" style="margin-top:10px">
      <button class="btn btn-primary" onclick="addAliasRow()">＋ 添加映射</button>
      <button class="btn btn-primary" onclick="saveAliases()" style="margin-left:auto">💾 保存别名</button>
    </div>
  </div>

  <!-- ===== 定时与缓存设置 ===== -->
  <div class="card">
    <div class="card-head">
      <div class="card-title">⏱️ 定时构建 & 订阅缓存</div>
    </div>
    <div class="card-desc">
      设置 Cron 触发时的最小构建间隔，以及 IPTV 客户端订阅文件的本地缓存时长。
    </div>
    <div class="hint-box">
      💡 <b>软控制原理</b>：Cron 仍按 wrangler.toml 的频率触发，但每次执行时会检查距上次构建的时间，
      未达到设定间隔则自动跳过，不执行构建也不消耗 KV 写入额度。
    </div>

    <div class="cfg-grid">
      <div class="cfg-item">
        <div class="cfg-label">🔄 Cron 最小间隔（小时）</div>
        <div class="cfg-desc">触发 Cron 后，距上次构建不足此时间则跳过。建议与 wrangler.toml 里的 Cron 频率配合使用。</div>
        <div class="slider-row">
          <input type="range" id="cron-slider" min="1" max="48" step="1"
            value="${cfg.cronIntervalHours}"
            oninput="document.getElementById('cron-val').textContent=this.value"/>
          <span class="slider-val" id="cron-val">${cfg.cronIntervalHours}</span>
          <span class="slider-unit">小时</span>
        </div>
        <div class="slider-ticks">
          <span>1h</span><span style="margin-left:auto">48h</span>
        </div>
      </div>

      <div class="cfg-item">
        <div class="cfg-label">📥 订阅缓存时长（分钟）</div>
        <div class="cfg-desc">IPTV 客户端本地缓存 M3U 文件的时间。越短越及时，越长越省流量和请求数。</div>
        <div class="slider-row">
          <input type="range" id="cache-slider" min="5" max="1440" step="5"
            value="${Math.round(cfg.m3uCacheSeconds / 60)}"
            oninput="updateCacheDisplay(this.value)"/>
          <span class="slider-val" id="cache-val">${formatCacheVal(Math.round(cfg.m3uCacheSeconds / 60))}</span>
          <span class="slider-unit" id="cache-unit"></span>
        </div>
        <div class="slider-ticks">
          <span>5m</span><span style="margin-left:auto">24h</span>
        </div>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveConfig()">💾 保存设置</button>
    </div>
  </div>

</div>

<script>
  // ---- 状态 ----
  const state = {
    blacklist: ${JSON.stringify((filters && filters.blacklist) || [])},
    whitelist: ${JSON.stringify((filters && filters.whitelist) || [])},
    aliases:   ${JSON.stringify(aliases || {})},
  };

  // 服务端注入的当前完整 config，saveConfig 时用于合并，避免覆盖其他字段
  const currentConfig = ${JSON.stringify(cfg)};

  // ---- 辅助：缓存时长友好显示 ----
  function formatCacheVal(minutes) {
    if (minutes < 60)  return minutes + ' 分钟';
    if (minutes < 1440) {
      const h = (minutes / 60).toFixed(1).replace(/\.0$/, '');
      return h + ' 小时';
    }
    return '24 小时';
  }
  function updateCacheDisplay(minutes) {
    document.getElementById('cache-val').textContent = formatCacheVal(Number(minutes));
  }

  // ---- 渲染 Tag ----
  function renderTags() {
    renderTagList('blacklist-tags', state.blacklist, 'tag-black', k => {
      state.blacklist = state.blacklist.filter(x => x !== k); renderTags();
    });
    renderTagList('whitelist-tags', state.whitelist, 'tag-white', k => {
      state.whitelist = state.whitelist.filter(x => x !== k); renderTags();
    });
  }

  function renderTagList(id, arr, cls, onDel) {
    const el = document.getElementById(id);
    el.innerHTML = arr.length === 0
      ? '<span style="font-size:12px;color:#bbb;padding:4px 0">暂无</span>'
      : arr.map(k => \`<span class="tag \${cls}">\${k}<span class="tag-del" onclick='(\${onDel.toString()})("\${k.replace(/'/g,"\\\\'")}"); event.stopPropagation()'>✕</span></span>\`).join('');
  }

  function addBlack() {
    const v = document.getElementById('bl-input').value.trim();
    if (v && !state.blacklist.includes(v)) { state.blacklist.push(v); renderTags(); }
    document.getElementById('bl-input').value = '';
  }
  function addWhite() {
    const v = document.getElementById('wl-input').value.trim();
    if (v && !state.whitelist.includes(v)) { state.whitelist.push(v); renderTags(); }
    document.getElementById('wl-input').value = '';
  }

  // ---- 别名行 ----
  function renderAliasRows() {
    const container = document.getElementById('alias-rows');
    container.innerHTML = '';
    const entries = Object.entries(state.aliases);
    if (entries.length === 0) {
      container.innerHTML = '<p style="font-size:12px;color:#bbb;padding:4px 0">暂无自定义别名</p>';
      return;
    }
    entries.forEach(([k, v], i) => {
      const row = document.createElement('div');
      row.className = 'alias-row';
      row.innerHTML = \`
        <input type="text" value="\${k}" placeholder="原始写法（大写无空格）" data-idx="\${i}" data-field="key" oninput="updateAlias(this)"/>
        <span class="alias-label">→</span>
        <input type="text" value="\${v}" placeholder="标准名称" data-idx="\${i}" data-field="val" oninput="updateAlias(this)"/>
        <button class="btn btn-danger" style="padding:6px 10px;font-size:12px" onclick="deleteAlias('\${k}')">✕</button>
      \`;
      container.appendChild(row);
    });
  }

  function addAliasRow() {
    state.aliases[''] = '';
    renderAliasRows();
  }

  function updateAlias(input) {
    const entries = Object.entries(state.aliases);
    const idx = parseInt(input.dataset.idx);
    const [oldKey, oldVal] = entries[idx];
    if (input.dataset.field === 'key') {
      delete state.aliases[oldKey];
      state.aliases[input.value] = oldVal;
    } else {
      state.aliases[oldKey] = input.value;
    }
  }

  function deleteAlias(key) {
    delete state.aliases[key];
    renderAliasRows();
  }

  // ---- 保存函数 ----
  async function apiPost(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function saveSources() {
    const val = document.getElementById('sources-ta').value.trim();
    const data = await apiPost('/admin/save', { key: 'sources', value: val });
    showMsg(data.ok, data.ok ? '信号源已保存，下次构建生效' : data.error);
  }

  async function clearSources() {
    if (!confirm('确认清空信号源？将回退到环境变量 M3U_SOURCES')) return;
    const data = await apiPost('/admin/save', { key: 'sources', value: '' });
    document.getElementById('sources-ta').value = '';
    showMsg(data.ok, data.ok ? '已清空，将使用环境变量' : data.error);
  }

  async function saveFilters() {
    const data = await apiPost('/admin/save', { key: 'filters', value: JSON.stringify({ blacklist: state.blacklist, whitelist: state.whitelist }) });
    showMsg(data.ok, data.ok ? '黑白名单已保存，下次构建生效' : data.error);
  }

  async function saveAliases() {
    // 清理空 key
    const clean = {};
    for (const [k, v] of Object.entries(state.aliases)) { if (k.trim()) clean[k.trim()] = v.trim(); }
    state.aliases = clean;
    const data = await apiPost('/admin/save', { key: 'aliases', value: JSON.stringify(clean) });
    renderAliasRows();
    showMsg(data.ok, data.ok ? '别名映射已保存，下次构建生效' : data.error);
  }

  async function saveConfig() {
    const cronIntervalHours = parseInt(document.getElementById('cron-slider').value);
    const m3uCacheSeconds   = parseInt(document.getElementById('cache-slider').value) * 60;
    // 合并到现有 config，保留未在此页面展示的其他字段
    const merged = { ...currentConfig, cronIntervalHours, m3uCacheSeconds };
    const data = await apiPost('/admin/save', {
      key: 'config',
      value: JSON.stringify(merged)
    });
    showMsg(data.ok, data.ok
      ? \`设置已保存：Cron 间隔 \${cronIntervalHours}h，订阅缓存 \${formatCacheVal(m3uCacheSeconds / 60)}（新请求立即生效）\`
      : data.error);
  }

  // ---- 消息提示 ----
  function showMsg(ok, text) {
    let el = document.getElementById('notice-top');
    if (!el) { el = document.createElement('div'); el.id = 'notice-top'; document.querySelector('.container').prepend(el); }
    el.className = 'notice ' + (ok ? 'ok' : 'err');
    el.textContent = (ok ? '✅ ' : '❌ ') + text;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---- 初始化 ----
  renderTags();
  renderAliasRows();
</script>
</body>
</html>`;
}

// ============================================================
//  请求路由
// ============================================================
export default {
  async fetch(request, env, ctx) {
    const url      = new URL(request.url);
    const path     = url.pathname;
    const baseUrl  = `${url.protocol}//${url.host}`;
    const password = env.AUTH_PASSWORD;
    const authEnabled = !!password;

    // ---- M3U 文件：公开访问 + TG 订阅通知（冷却 1 小时）----
    if (path === '/full.m3u' || path === '/lite.m3u' || path === '/cctv.m3u') {
      const key     = path.slice(1);
      const content = await env.IPTV_KV.get(key);
      if (!content) return new Response('Not Found', { status: 404 });

      ctx.waitUntil((async () => {
        try {
          const cooldownKey = `notify_cooldown:${key}`;
          const inCooldown  = await env.IPTV_KV.get(cooldownKey);
          if (inCooldown) return;
          await env.IPTV_KV.put(cooldownKey, '1', { expirationTtl: 3600 });
          const ua = request.headers.get('User-Agent') || '未知客户端';
          const ip = request.headers.get('CF-Connecting-IP') || '未知 IP';
          await sendTelegramSubscribeNotify(env, key, ua, ip);
        } catch(e) { console.error('Subscribe notify error:', e.message); }
      })());

      const cfg        = await loadConfig(env);
      const maxAge     = Math.max(60, cfg.m3uCacheSeconds);
      const swrAge     = maxAge * 2;
      return new Response(content, {
        headers: {
          'Content-Type': 'audio/x-mpegurl; charset=utf-8',
          'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${swrAge}`
        }
      });
    }

    // ---- 登录页 GET ----
    if (path === '/login' && request.method === 'GET') {
      if (authEnabled && await isAuthenticated(request, env)) {
        return new Response(null, { status: 302, headers: { 'Location': '/' } });
      }
      return new Response(renderLoginPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // ---- 登录提交 POST ----
    if (path === '/login' && request.method === 'POST') {
      const formData = await request.formData();
      const inputPwd = formData.get('password') || '';
      if (!authEnabled || inputPwd === password) {
        const token = await generateToken();
        await env.IPTV_KV.put(`session:${token}`, '1', { expirationTtl: SESSION_TTL });
        const redirectTo = url.searchParams.get('from') || '/';
        return new Response(null, {
          status: 302,
          headers: {
            'Location': redirectTo,
            'Set-Cookie': `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`
          }
        });
      }
      return new Response(renderLoginPage('密码错误，请重试'), {
        status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // ---- 登出 ----
    if (path === '/logout') {
      const cookie = request.headers.get('Cookie') || '';
      const match  = cookie.match(new RegExp(`${AUTH_COOKIE}=([a-f0-9]+)`));
      if (match) await env.IPTV_KV.delete(`session:${match[1]}`);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/login',
          'Set-Cookie': `${AUTH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
        }
      });
    }

    // ---- 以下路由需要登录 ----
    if (authEnabled && !(await isAuthenticated(request, env))) {
      return new Response(null, {
        status: 302,
        headers: { 'Location': `/login?from=${encodeURIComponent(path)}` }
      });
    }

    // ---- 手动构建（仅允许 POST）----
    if (path === '/rebuild' && request.method === 'POST') {
      try {
        const { meta, diff } = await buildAll(env);
        ctx.waitUntil(sendTelegramNotify(env, meta, 'manual', diff));
        if (request.headers.get('X-Requested-With') === 'fetch') {
          return new Response(JSON.stringify({ ok: true, dedup: meta.dedup, duration: meta.duration }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(null, { status: 302, headers: { 'Location': '/' } });
      } catch(e) {
        if (request.headers.get('X-Requested-With') === 'fetch') {
          return new Response(JSON.stringify({ ok: false, error: e.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(null, { status: 302, headers: { 'Location': '/' } });
      }
    }

    // ---- 管理页 GET ----
    if (path === '/admin' && request.method === 'GET') {
      const [sourcesRaw, filtersRaw, aliasesRaw, cfg] = await Promise.all([
        env.IPTV_KV.get('admin:sources'),
        env.IPTV_KV.get('admin:filters'),
        env.IPTV_KV.get('admin:aliases'),
        loadConfig(env),
      ]);
      const filters = filtersRaw ? JSON.parse(filtersRaw) : { blacklist: [], whitelist: [] };
      const aliases = aliasesRaw ? JSON.parse(aliasesRaw) : {};
      return new Response(renderAdminPage(sourcesRaw || '', filters, aliases, cfg), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // ---- 管理 API：保存配置 ----
    if (path === '/admin/save' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { key, value } = body;
        if (!['sources','filters','aliases','config'].includes(key)) {
          return new Response(JSON.stringify({ ok: false, error: '非法 key' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          });
        }
        const kvKey = `admin:${key}`;
        if (!value || value.trim() === '') {
          await env.IPTV_KV.delete(kvKey);
        } else {
          await env.IPTV_KV.put(kvKey, value);
        }
        // 清除别名缓存
        _aliasCache = null;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch(e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // ---- 状态页 ----
    if (path === '/' || path === '/status') {
      const metaStr = await env.IPTV_KV.get('meta');
      if (!metaStr) {
        return new Response('尚未构建，请等待定时任务执行（每天自动运行两次）', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
      const [meta, usage, historyRaw] = await Promise.all([
        Promise.resolve(JSON.parse(metaStr)),
        fetchUsage(env),
        env.IPTV_KV.get(HISTORY_KEY),
      ]);
      const history = historyRaw ? JSON.parse(historyRaw) : [];
      return new Response(renderStatusPage(meta, baseUrl, usage, history), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  // Cron 定时触发（自动重新构建 + TG 通知）
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      // 软控制：检查距上次构建是否已超过设定间隔
      try {
        const cfg = await loadConfig(env);
        const intervalMs = (cfg.cronIntervalHours || CONFIG_DEFAULTS.cronIntervalHours) * 3600 * 1000;
        const metaStr = await env.IPTV_KV.get('meta');
        if (metaStr) {
          const lastBuild = new Date(JSON.parse(metaStr).lastBuild).getTime();
          if (Date.now() - lastBuild < intervalMs) {
            console.log(`[Cron] 距上次构建不足 ${cfg.cronIntervalHours}h，跳过本次`);
            return;
          }
        }
      } catch(e) {
        console.error('[Cron] 间隔检查失败，继续构建：', e.message);
      }
      const { meta, diff } = await buildAll(env);
      await sendTelegramNotify(env, meta, 'cron', diff);
    })());
  }
};
