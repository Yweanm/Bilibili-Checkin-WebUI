const $ = s => document.querySelector(s);
const API = 'https://api.github.com';
const LS = { repo: 'gh-ci-repo', token: 'gh-ci-token', theme: 'bili-webui-theme', lang: 'bili-console-lang' };

const GITHUB_API_VERSION = '2022-11-28';
const POLL_INTERVAL_MS = 30000;
const RUNS_PER_PAGE = 15;
const LOG_MAX_LINES = 1200;

const state = {
  repo: null, token: null, defaultBranch: null,
  workflow: null, file: null, runs: [], connected: false,
  connState: 'none', connErr: '', cron: '', cronErr: ''
};

let LANG = 'zh';

const I18N = {
  zh: {
    docTitle: 'Bilibili Checkin WebUI',
    themeAria: '切换深浅主题', langAria: '切换语言', themeDark: '深色', themeLight: '浅色', helpClose: '关闭', helpTag: '说明',
    h1: '云端签到控制台',
    secRepo: '连接仓库', secSchedule: '定时计划', secConfig: '任务配置', secRuns: '运行控制', secLogs: '运行日志',
    repoLabel: '仓库',
    tokenLabel: '访问令牌',
    btnConnect: '连接',
    notConnected: '未连接',
    connOk: '已连接 {repo} · {name} · 分支 {branch}',
    connFail: '连接失败: ',
    cronCur: '未加载',
    cronLabel: 'CRON 表达式',
    btnSaveCron: '保存定时',
    cookieLabel: 'B站 Cookie',
    tasksLabel: '执行任务',
    taskLive: '直播签到', taskManga: '漫画签到', taskShare: '分享视频', taskCoin: '视频投币',
    coinNumLabel: '投币数量',
    coinSourceLabel: '投币来源',
    srcDynamic: '动态', srcRanking: '排行榜',
    likeLabel: '投币点赞', likeOpt: '同时点赞',
    pushLabel: 'PushPlus Token',
    btnSaveCfg: '保存配置',
    btnRun: '立即运行', btnRefresh: '刷新记录', ghLink: 'GitHub↗',
    runsEmptyInit: '连接后显示运行记录', runsEmpty: '暂无运行记录',
    logsEmpty: '点击运行记录的「日志」查看', logLoading: '日志加载中…', noJobs: '该运行暂无 Job',
    logBtn: '日志', runDetails: '详情↗',
    phRepo: 'yourname/bilibili_checkin',
    phToken: 'ghp_xxx / github_pat_xxx',
    phCookie: 'SESSDATA=xxx; bili_jct=xxx; DedeUserID=xxx  多账号用 ### 分隔',
    phPush: '用于微信推送',
    phCron: '0 3 * * *',
    footer: 'Token 存储于浏览器 localStorage · 请勿在公共设备使用 · 仅供学习交流使用',
    stQueued: '排队中', stRunning: '运行中', stCompleted: '已完成',
    ccSuccess: '成功', ccFailure: '失败', ccCancelled: '已取消', ccSkipped: '跳过', ccTimedOut: '超时', ccStartup: '启动失败', ccAction: '需操作',
    evSchedule: '定时', evDispatch: '手动',
    badgeIdle: '空闲', badgeLastOk: '上次成功', badgeLastFailPrefix: '上次',
    toNeedRepo: '请填写仓库与 Token', toRepoFmt: '仓库格式应为 owner/repo',
    errNoWorkflow: '仓库中未找到可用的 workflow',
    toTriggered: '已触发运行，稍后自动刷新', toTriggerFail: '触发失败：', toConnected: '连接成功',
    toSaveFail: '保存失败：', toVarsSaved: '仓库变量已保存', toCookieUpd: 'Cookie 已更新', toPushUpd: 'PushPlus 已更新',
    toVarsLoadFail: '仓库变量读取失败：',
    toCronBad: 'Cron 格式不正确，应为 5 段式，如 0 3 * * *', toCronSaved: '定时已保存（commit 已提交）',
    errCoinRange: '每日投币数量必须是 0–5 的整数', errSource: '投币来源只能是 dynamic（动态）或 ranking（排行榜）', errTaskChars: '执行任务选项包含非法字符',
    runsLoadFail: '运行记录加载失败: ', logFetchFail: '日志获取失败: ', secretLoadFail: '仓库密钥状态读取失败: ',
    secCookieLabel: 'B站 Cookie', secPushLabel: 'PushPlus Token',
    secretSet: '已设置 · 更新于 ', secretUnset: '未设置',
    cronLoadFail: '定时读取失败', noSchedule: '未配置定时',
    dailyAt: '北京时间每天 {time}'
  },
  en: {
    docTitle: 'Bilibili Checkin WebUI',
    themeAria: 'Toggle dark mode', langAria: 'Switch language', themeDark: 'Dark', themeLight: 'Light', helpClose: 'Close', helpTag: 'Info',
    h1: 'Cloud Check-in Console',
    secRepo: 'Repository', secSchedule: 'Schedule', secConfig: 'Task Config', secRuns: 'Runs', secLogs: 'Logs',
    repoLabel: 'Repository',
    tokenLabel: 'Access Token',
    btnConnect: 'Connect',
    notConnected: 'Not connected',
    connOk: 'Connected {repo} · {name} · branch {branch}',
    connFail: 'Connection failed: ',
    cronCur: 'Not loaded',
    cronLabel: 'Cron expression',
    btnSaveCron: 'Save schedule',
    cookieLabel: 'Bilibili Cookie',
    tasksLabel: 'Tasks',
    taskLive: 'Live sign-in', taskManga: 'Manga sign-in', taskShare: 'Share video', taskCoin: 'Add coin',
    coinNumLabel: 'Coins per day',
    coinSourceLabel: 'Coin video source',
    srcDynamic: 'Dynamic', srcRanking: 'Ranking',
    likeLabel: 'Coin & like', likeOpt: 'Also like',
    pushLabel: 'PushPlus Token',
    btnSaveCfg: 'Save config',
    btnRun: 'Run now', btnRefresh: 'Refresh', ghLink: 'GitHub↗',
    runsEmptyInit: 'Connect to view runs', runsEmpty: 'No runs yet',
    logsEmpty: 'Click "Log" on a run to view its log', logLoading: 'Loading logs…', noJobs: 'No jobs in this run',
    logBtn: 'Log', runDetails: 'Details↗',
    phRepo: 'yourname/bilibili_checkin',
    phToken: 'ghp_xxx / github_pat_xxx',
    phCookie: 'SESSDATA=xxx; bili_jct=xxx; DedeUserID=xxx  separate accounts with ###',
    phPush: 'For WeChat push notification',
    phCron: '0 3 * * *',
    footer: 'Token is stored in browser localStorage · Do not use on shared devices · For learning purposes only',
    stQueued: 'Queued', stRunning: 'Running', stCompleted: 'Completed',
    ccSuccess: 'Success', ccFailure: 'Failure', ccCancelled: 'Cancelled', ccSkipped: 'Skipped', ccTimedOut: 'Timed out', ccStartup: 'Startup failure', ccAction: 'Action required',
    evSchedule: 'Schedule', evDispatch: 'Manual',
    badgeIdle: 'Idle', badgeLastOk: 'Last succeeded', badgeLastFailPrefix: 'Last ',
    toNeedRepo: 'Please fill in the repository and token', toRepoFmt: 'Repository must be in owner/repo format',
    errNoWorkflow: 'No active workflow found in this repository',
    toTriggered: 'Triggered, refreshing shortly', toTriggerFail: 'Trigger failed: ', toConnected: 'Connected',
    toSaveFail: 'Save failed: ', toVarsSaved: 'Repository variables saved', toCookieUpd: 'Cookie updated', toPushUpd: 'PushPlus token updated',
    toVarsLoadFail: 'Failed to load variables: ',
    toCronBad: 'Invalid cron, expected 5 fields, e.g. 0 3 * * *', toCronSaved: 'Schedule saved (commit pushed)',
    errCoinRange: 'Coins per day must be an integer from 0 to 5', errSource: 'Source must be dynamic or ranking', errTaskChars: 'Task list contains invalid characters',
    runsLoadFail: 'Failed to load runs: ', logFetchFail: 'Failed to fetch log: ', secretLoadFail: 'Failed to load secrets: ',
    secCookieLabel: 'Bilibili Cookie', secPushLabel: 'PushPlus Token',
    secretSet: 'Set · updated ', secretUnset: 'Not set',
    cronLoadFail: 'Failed to load schedule', noSchedule: 'No schedule configured',
    dailyAt: 'Daily at {time} (Beijing time)'
  }
};

const HELP = {
  zh: {
    repo: { t: '仓库', n: 'owner/repo', b: 'GitHub 仓库地址，格式为 用户名/仓库名，例如 yourname/bilibili_checkin。签到任务通过该仓库的 GitHub Actions 运行' },
    token: { t: '访问令牌', n: 'PERSONAL ACCESS TOKEN', b: 'GitHub 个人访问令牌：经典 Token 勾选 repo 权限；Fine-grained Token 勾选 Actions、Variables、Secrets、Contents 的读写权限。令牌仅保存在本浏览器 localStorage，不会上传到任何第三方，请勿在公共设备使用' },
    cookie: { t: 'B站 Cookie', n: 'BILIBILI_COOKIE · Secret 密钥', b: '浏览器登录 B 站后按 F12，从网络请求标头中复制 Cookie，需包含 SESSDATA、bili_jct、DedeUserID 字段。多账号用 ### 分隔。以密文写入仓库 Secrets，只可覆盖、不可读取；留空表示不修改' },
    tasks: { t: '执行任务', n: 'TASK_CONFIG · Variable 变量', b: '控制每次执行的任务，用英文逗号分隔：live_sign 直播签到、manga_sign 漫画签到、share_video 分享视频、add_coin 视频投币。删除或留空该变量时执行全部默认任务，未知任务名会被忽略；观看视频为固定任务，始终执行' },
    coinNum: { t: '投币数量', n: 'COIN_ADD_NUM · Variable 变量', b: '每日投币数量，0–5 的整数，填 0 表示不投币。实际投币数取配置值、硬币余额与 5 的最小值，硬币不足或当日投币达到上限时会自动跳过' },
    coinSource: { t: '投币来源', n: 'COIN_VIDEO_SOURCE · Variable 变量', b: '投币目标视频的来源：dynamic 取自动态视频列表，ranking 取自排行榜视频' },
    like: { t: '投币点赞', n: 'COIN_SELECT_LIKE · Variable 变量', b: '投币时是否同时为视频点赞：1 是，0 否' },
    push: { t: 'PushPlus Token', n: 'PUSH_PLUS_TOKEN · Secret 密钥', b: '用于在微信上接收任务报告，Token 在 pushplus.plus 获取。以密文写入仓库 Secrets，只可覆盖、不可读取；留空表示不修改，不配置则不推送' },
    cron: { t: '定时计划', n: 'CRON · UTC 时区', b: 'GitHub Actions 定时表达式，5 段式（分 时 日 月 周），例如 0 3 * * * 即北京时间每天 11:00 执行。保存会向仓库提交一次 commit；定时触发可能有数分钟延迟；仓库 60 天无活动会被自动停用定时' }
  },
  en: {
    repo: { t: 'Repository', n: 'owner/repo', b: 'GitHub repository in the form username/repo, e.g. yourname/bilibili_checkin. Check-in tasks run via the GitHub Actions of this repository' },
    token: { t: 'Access Token', n: 'PERSONAL ACCESS TOKEN', b: 'GitHub personal access token: classic token needs the repo scope; fine-grained token needs read/write for Actions, Variables, Secrets and Contents. The token is stored only in this browser (localStorage), never sent to any third party. Do not use on shared devices' },
    cookie: { t: 'Bilibili Cookie', n: 'BILIBILI_COOKIE · Secret', b: 'Log in to bilibili.com in a browser, press F12 and copy the Cookie from a request header. It must contain SESSDATA, bili_jct and DedeUserID. Separate multiple accounts with ###. Stored encrypted as a repository Secret (overwrite only, never readable); leave empty to keep unchanged' },
    tasks: { t: 'Tasks', n: 'TASK_CONFIG · Variable', b: 'Controls which tasks run each time, comma separated: live_sign (live sign-in), manga_sign (manga sign-in), share_video (share video), add_coin (add coin). Removing or clearing the variable runs all default tasks; unknown task names are ignored. Watching videos is a fixed task that always runs' },
    coinNum: { t: 'Coins per day', n: 'COIN_ADD_NUM · Variable', b: 'Number of coins per day, integer from 0 to 5; 0 disables coin dropping. The actual count is the minimum of the configured value, your coin balance and 5; it skips automatically when coins are insufficient or the daily limit is reached' },
    coinSource: { t: 'Coin video source', n: 'COIN_VIDEO_SOURCE · Variable', b: 'Where the coin target videos come from: dynamic (dynamic feed) or ranking (ranking list)' },
    like: { t: 'Coin & like', n: 'COIN_SELECT_LIKE · Variable', b: 'Whether to also like the video when dropping a coin: 1 yes, 0 no' },
    push: { t: 'PushPlus Token', n: 'PUSH_PLUS_TOKEN · Secret', b: 'Receives the task report in WeChat. Get the token at pushplus.plus. Stored encrypted as a repository Secret (overwrite only, never readable); leave empty to keep unchanged, and no push is sent when unset' },
    cron: { t: 'Schedule', n: 'CRON · UTC', b: 'GitHub Actions cron expression with 5 fields (minute hour day month weekday), e.g. 0 3 * * * runs daily at 11:00 Beijing time. Saving commits a change to the workflow file; scheduled runs may start a few minutes late; schedules are disabled after 60 days of repository inactivity' }
  }
};

function t(key) {
  const d = I18N[LANG] || I18N.zh;
  return (d[key] != null) ? d[key] : (I18N.zh[key] != null ? I18N.zh[key] : key);
}

let toastTimer = null;
function toast(msg, ok) {
  const t0 = $('#toast');
  t0.textContent = msg;
  t0.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t0.style.display = 'none', 3200);
}

let helpKey = null;
function openHelp(key) {
  helpKey = key;
  fillHelp();
  $('#helpMask').classList.add('open');
}
function fillHelp() {
  const h = (HELP[LANG] || HELP.zh)[helpKey] || HELP.zh[helpKey];
  if (!h) return;
  $('#helpTitle').textContent = h.t;
  $('#helpVar').textContent = h.n;
  $('#helpBody').textContent = h.b;
}
function closeHelp() {
  $('#helpMask').classList.remove('open');
  helpKey = null;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeHelp(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList && e.target.classList.contains('q')) {
    e.preventDefault();
    e.target.click();
  }
});

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const txt = $('#themeTxt');
  if (txt) txt.textContent = theme === 'dark' ? t('themeLight') : t('themeDark');
}
function toggleTheme() {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(LS.theme, theme); } catch (e) {}
  applyTheme(theme);
}

function applyLang(lang) {
  LANG = lang;
  try { localStorage.setItem(LS.lang, lang); } catch (e) {}
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('docTitle');
  $('#langTxt').textContent = lang === 'zh' ? 'EN' : '中文';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  applyTheme(document.documentElement.dataset.theme || 'light');
  if (state.connState === 'ok') setConnOk();
  else if (state.connState === 'err') setConnErr();
  else $('#connStatus').textContent = t('notConnected');
  if (helpKey) fillHelp();
  if (state.connected) { renderRuns(); updateBadge(); loadSecrets(); updateCronDisplay(); }
}

function toggleLang() {
  applyLang(LANG === 'zh' ? 'en' : 'zh');
}

function runStatusText(s) {
  const m = { queued: t('stQueued'), in_progress: t('stRunning'), completed: t('stCompleted') };
  return m[s] || s;
}
function runConclText(c) {
  const m = { success: t('ccSuccess'), failure: t('ccFailure'), cancelled: t('ccCancelled'), skipped: t('ccSkipped'), timed_out: t('ccTimedOut'), startup_failure: t('ccStartup'), action_required: t('ccAction') };
  return m[c] || c;
}
function runEventText(e) {
  const m = { schedule: t('evSchedule'), workflow_dispatch: t('evDispatch') };
  return m[e] || e;
}

function b64encodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function b64decodeUtf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function ghHeaders(json) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': 'Bearer ' + state.token,
    'X-GitHub-Api-Version': GITHUB_API_VERSION
  };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function gh(path, opts = {}) {
  if (!state.repo || !state.token) throw new Error('GitHub API: ' + (LANG === 'zh' ? '请先连接仓库' : 'connect first'));
  const res = await fetch(API + path, { method: opts.method || 'GET', headers: ghHeaders(!!opts.body), body: opts.body });
  if (res.status === 204) return { status: 204, data: null };
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    let msg = (data && data.message) ? data.message : ('HTTP ' + res.status);
    if (res.status === 401) msg = (LANG === 'zh' ? 'Token 无效或已过期' : 'Token invalid or expired');
    else if (res.status === 403) msg = (LANG === 'zh' ? '无权限或速率受限：' : 'No permission or rate limited: ') + msg;
    else if (res.status === 404) msg = (LANG === 'zh' ? '未找到（检查仓库名与 Token 权限）：' : 'Not found (check repo and token permissions): ') + msg;
    else if (res.status === 422) msg = (LANG === 'zh' ? '请求被拒绝：' : 'Request rejected: ') + msg;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return { status: res.status, data };
}

async function ghText(path) {
  if (!state.repo || !state.token) throw new Error('GitHub API');
  const res = await fetch(API + path, { headers: ghHeaders(false) });
  if (!res.ok) throw new Error(t('logFetchFail') + 'HTTP ' + res.status);
  return await res.text();
}

const SODIUM_SOURCES = [
  ['sodium-core.js', 'sodium.js'],
  ['https://cdn.jsdelivr.net/gh/jedisct1/libsodium.js@0.7.15/dist/modules/libsodium.js',
   'https://cdn.jsdelivr.net/gh/jedisct1/libsodium.js@0.7.15/dist/browsers/sodium.js'],
  ['https://fastly.jsdelivr.net/gh/jedisct1/libsodium.js@0.7.15/dist/modules/libsodium.js',
   'https://fastly.jsdelivr.net/gh/jedisct1/libsodium.js@0.7.15/dist/browsers/sodium.js']
];

let sodiumPromise = null;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('load failed: ' + src));
    document.head.appendChild(s);
  });
}
function loadSodium() {
  if (window.sodium && window.sodium.ready) return window.sodium.ready.then(() => window.sodium);
  if (!sodiumPromise) {
    sodiumPromise = (async () => {
      for (const [coreSrc, wrapperSrc] of SODIUM_SOURCES) {
        try {
          await loadScript(coreSrc);
          await loadScript(wrapperSrc);
          if (!window.sodium || !window.sodium.ready) throw new Error('bad payload: ' + wrapperSrc);
          await window.sodium.ready;
          return window.sodium;
        } catch (e) { /* try next source */ }
      }
      throw new Error(LANG === 'zh' ? 'libsodium 加载失败，无法加密保存密钥' : 'Failed to load libsodium, cannot encrypt secrets');
    })();
  }
  return sodiumPromise;
}

function fmtTime(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString(LANG === 'zh' ? 'zh-CN' : 'en-US', {
      timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  } catch (e) { return iso; }
}

function fmtDur(run) {
  const start = run.run_started_at || run.created_at;
  if (!start) return '-';
  const end = run.status === 'completed' ? (run.updated_at || Date.now()) : Date.now();
  let ms = new Date(end) - new Date(start);
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  return h ? (h + 'h' + (m % 60) + 'm') : (m ? (m + 'm' + (s % 60) + 's') : (s + 's'));
}

function setConnOk() {
  $('#connStatus').style.color = '';
  $('#connStatus').textContent = t('connOk')
    .replace('{repo}', state.repo || '')
    .replace('{name}', state.workflow ? state.workflow.name : '')
    .replace('{branch}', state.defaultBranch || '');
}

function setConnErr() {
  $('#connStatus').style.color = 'var(--danger)';
  $('#connStatus').textContent = t('connFail') + (state.connErr || '');
}

function setActionsEnabled(on) {
  ['#btnRun', '#btnRefresh', '#btnSaveCfg', '#btnSaveCron'].forEach(s => {
    const el = $(s);
    if (el) el.disabled = !on;
  });
}

async function connect(silent) {
  const repo = $('#repo').value.trim();
  const token = $('#token').value.trim();
  if (!repo || !token) { if (!silent) toast(t('toNeedRepo'), false); return false; }
  if (!/^[^\/\s]+\/[^\/\s]+$/.test(repo)) { if (!silent) toast(t('toRepoFmt'), false); return false; }
  state.repo = repo;
  state.token = token;
  try {
    const info = await gh('/repos/' + repo);
    state.defaultBranch = info.data.default_branch || 'main';
    const wfs = await gh('/repos/' + repo + '/actions/workflows');
    const all = wfs.data.workflows || [];
    const active = all.filter(w => w.state === 'active');
    const isBili = w => /bilibili/i.test(w.name) || /bilibili/i.test(w.path);
    const pick = active.find(isBili) || active[0] || all.find(isBili) || all[0];
    if (!pick) throw new Error(t('errNoWorkflow'));
    state.workflow = pick;
    state.connected = true;
    state.connState = 'ok';
    try { localStorage.setItem(LS.repo, repo); localStorage.setItem(LS.token, token); } catch (e) {}
    setConnOk();
    $('#ghLink').href = 'https://github.com/' + repo + '/actions';
    $('#ghLink').setAttribute('aria-disabled', 'false');
    setActionsEnabled(true);
    await Promise.all([loadRuns(), loadVariables(), loadSecrets(), loadCron()]);
    if (!silent) toast(t('toConnected'));
    return true;
  } catch (e) {
    state.connected = false;
    state.connState = 'err';
    state.connErr = e.message;
    setActionsEnabled(false);
    setConnErr();
    if (!silent) toast(t('connFail') + e.message, false);
    return false;
  }
}

async function runNow() {
  if (!state.connected) return;
  $('#btnRun').disabled = true;
  try {
    await gh('/repos/' + state.repo + '/actions/workflows/' + state.workflow.id + '/dispatches', {
      method: 'POST',
      body: JSON.stringify({ ref: state.defaultBranch })
    });
    toast(t('toTriggered'));
    setTimeout(loadRuns, 4000);
    setTimeout(loadRuns, 12000);
  } catch (e) {
    toast(t('toTriggerFail') + e.message, false);
  } finally {
    $('#btnRun').disabled = false;
  }
}

function runStateText(run) {
  if (run.status !== 'completed') return runStatusText(run.status);
  if (run.conclusion === 'success') return t('ccSuccess');
  return runConclText(run.conclusion) || t('stCompleted');
}

function runStateCls(run) {
  if (run.status !== 'completed') return 'warn';
  return run.conclusion === 'success' ? 'ok' : 'fail';
}

function updateBadge() {
  const badge = $('#badge');
  const r = state.runs[0];
  let key = 'idle', text = state.connected ? t('badgeIdle') : t('notConnected');
  if (r) {
    if (r.status !== 'completed') { key = 'running'; text = runStatusText(r.status); }
    else if (r.conclusion === 'success') { key = 'success'; text = t('badgeLastOk'); }
    else { key = 'failed'; text = t('badgeLastFailPrefix') + runConclText(r.conclusion); }
  }
  badge.className = 'status ' + key;
  $('#badgeText').textContent = text;
}

function renderRuns() {
  const box = $('#runs');
  if (!state.runs.length) {
    box.innerHTML = '<div class="empty">' + esc(t('runsEmpty')) + '</div>';
    return;
  }
  box.innerHTML = state.runs.map(run => {
    const logBtn = run.status === 'completed' || run.status === 'in_progress'
      ? `<button onclick="viewLog(${run.id})">${esc(t('logBtn'))}</button>` : '';
    return `<div class="run-row">` +
      `<span class="rid">#${run.run_number}</span>` +
      `<span class="rev">${esc(runEventText(run.event))}</span>` +
      `<span class="rst ${runStateCls(run)}">${esc(runStateText(run))}</span>` +
      `<span class="rtm">${fmtTime(run.run_started_at || run.created_at)}</span>` +
      `<span class="rdur">${fmtDur(run)}</span>` +
      `<span class="ract">${logBtn}` +
      `<a href="${esc(run.html_url)}" target="_blank" rel="noopener">${esc(t('runDetails'))}</a></span>` +
      `</div>`;
  }).join('');
}

async function loadRuns() {
  if (!state.connected) return;
  try {
    const r = await gh('/repos/' + state.repo + '/actions/workflows/' + state.workflow.id + '/runs?per_page=' + RUNS_PER_PAGE);
    state.runs = r.data.workflow_runs || [];
    renderRuns();
    updateBadge();
  } catch (e) {
    $('#runs').innerHTML = '<div class="empty">' + esc(t('runsLoadFail') + e.message) + '</div>';
  }
}

async function viewLog(runId) {
  const box = $('#log');
  box.innerHTML = '<div class="empty">' + esc(t('logLoading')) + '</div>';
  const run = state.runs.find(r => r.id === runId);
  const runUrl = run ? run.html_url : '';
  const hint = runUrl ? ((LANG === 'zh' ? '完整日志请前往 GitHub 查看：' : 'View full logs on GitHub: ') + runUrl) : '';
  try {
    const jobs = await gh('/repos/' + state.repo + '/actions/runs/' + runId + '/jobs');
    const list = jobs.data.jobs || [];
    if (!list.length) { box.innerHTML = '<div class="empty">' + esc(t('noJobs')) + '</div>'; return; }
    let text = '';
    for (const j of list) {
      const st = runStatusText(j.status);
      const cc = j.conclusion ? (' · ' + runConclText(j.conclusion)) : '';
      text += '===== ' + j.name + ' (' + st + cc + ') =====\n';
      try { text += await ghText('/repos/' + state.repo + '/actions/jobs/' + j.id + '/logs'); }
      catch (e) { text += '(' + e.message + ')\n' + hint + '\n'; }
      text += '\n';
    }
    const lines = text.split(/\r?\n/);
    box.innerHTML = lines.slice(-LOG_MAX_LINES).map(line => {
      let cls = '';
      if (/##\[error\]|\bERROR\b/.test(line)) cls = 'lv-ERROR';
      else if (/##\[warning\]|\bWARNING\b/.test(line)) cls = 'lv-WARNING';
      return cls ? '<div class="' + cls + '">' + esc(line) + '</div>' : '<div>' + esc(line) + '</div>';
    }).join('');
    box.scrollTop = box.scrollHeight;
  } catch (e) {
    box.innerHTML = '<div class="empty">' + esc(e.message + (hint ? ' · ' + hint : '')) + '</div>';
  }
}

function collectTasks() {
  return Array.from(document.querySelectorAll('#taskChips input:checked')).map(cb => cb.value).join(',');
}

function validateLocal(tasks, coinNum, source) {
  if (!/^\d+$/.test(coinNum) || +coinNum < 0 || +coinNum > 5) return t('errCoinRange');
  if (source !== 'dynamic' && source !== 'ranking') return t('errSource');
  if (tasks && /[^a-z_,\s]/i.test(tasks)) return t('errTaskChars');
  return null;
}

async function upsertVariable(name, value) {
  try {
    await gh('/repos/' + state.repo + '/actions/variables/' + name, {
      method: 'PATCH', body: JSON.stringify({ name, value })
    });
  } catch (e) {
    if (e.status !== 404) throw e;
    await gh('/repos/' + state.repo + '/actions/variables', {
      method: 'POST', body: JSON.stringify({ name, value })
    });
  }
}

async function deleteVariable(name) {
  try {
    await gh('/repos/' + state.repo + '/actions/variables/' + name, { method: 'DELETE' });
  } catch (e) {}
}

async function saveConfig() {
  if (!state.connected) return;
  const tasks = collectTasks();
  const coinNum = ($('#coinNum').value.trim() || '1');
  const source = (document.querySelector('#coinSourceOpts input:checked') || {}).value || 'dynamic';
  const like = $('#coinLike').checked ? '1' : '0';
  const err = validateLocal(tasks, coinNum, source);
  if (err) { toast(err, false); return; }

  $('#btnSaveCfg').disabled = true;
  try {
    if (tasks) await upsertVariable('TASK_CONFIG', tasks);
    else await deleteVariable('TASK_CONFIG');
    await upsertVariable('COIN_ADD_NUM', coinNum);
    await upsertVariable('COIN_SELECT_LIKE', like);
    await upsertVariable('COIN_VIDEO_SOURCE', source);

    const cookie = $('#cookie').value.trim();
    const pushToken = $('#pushToken').value.trim();
    const saved = [t('toVarsSaved')];
    if (cookie) { await saveSecret('BILIBILI_COOKIE', cookie); saved.push(t('toCookieUpd')); $('#cookie').value = ''; }
    if (pushToken) { await saveSecret('PUSH_PLUS_TOKEN', pushToken); saved.push(t('toPushUpd')); $('#pushToken').value = ''; }
    await loadSecrets();
    toast(saved.join(' · '));
  } catch (e) {
    toast(t('toSaveFail') + e.message, false);
  } finally {
    $('#btnSaveCfg').disabled = false;
  }
}

async function saveSecret(name, value) {
  const sodium = await loadSodium();
  const pk = await gh('/repos/' + state.repo + '/actions/secrets/public-key');
  const keyBytes = Uint8Array.from(atob(pk.data.key), c => c.charCodeAt(0));
  const msgBytes = new TextEncoder().encode(value);
  // seal 的 base64 输出是 URL-safe 且无填充，GitHub 只接受标准 base64，这里转码并补齐
  const sealed = sodium.crypto_box_seal(msgBytes, keyBytes, 'base64');
  const encrypted_value = sealed.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - sealed.length % 4) % 4);
  await gh('/repos/' + state.repo + '/actions/secrets/' + name, {
    method: 'PUT',
    body: JSON.stringify({ encrypted_value, key_id: pk.data.key_id })
  });
}

function defaultTaskMap() {
  return { live_sign: true, manga_sign: true, share_video: true, add_coin: true };
}

async function loadVariables() {
  try {
    const r = await gh('/repos/' + state.repo + '/actions/variables');
    const map = {};
    (r.data.variables || []).forEach(v => map[v.name] = v.value);
    const defaults = defaultTaskMap();
    const tasks = String(!map.TASK_CONFIG ? Object.keys(defaults).join(',') : map.TASK_CONFIG)
      .split(',').map(s => s.trim()).filter(Boolean);
    document.querySelectorAll('#taskChips input').forEach(cb => {
      cb.checked = tasks.includes(cb.value);
    });
    $('#coinNum').value = map.COIN_ADD_NUM != null ? map.COIN_ADD_NUM : '1';
    $('#coinLike').checked = (map.COIN_SELECT_LIKE != null ? map.COIN_SELECT_LIKE : '1') === '1';
    const src = map.COIN_VIDEO_SOURCE != null ? map.COIN_VIDEO_SOURCE : 'dynamic';
    document.querySelectorAll('#coinSourceOpts input').forEach(rb => rb.checked = rb.value === src);
  } catch (e) {
    toast(t('toVarsLoadFail') + e.message, false);
  }
}

async function loadSecrets() {
  const box = $('#secretStatus');
  try {
    const r = await gh('/repos/' + state.repo + '/actions/secrets');
    const map = {};
    (r.data.secrets || []).forEach(s => map[s.name] = s.updated_at);
    const labels = { BILIBILI_COOKIE: t('secCookieLabel'), PUSH_PLUS_TOKEN: t('secPushLabel') };
    const names = ['BILIBILI_COOKIE', 'PUSH_PLUS_TOKEN'];
    box.innerHTML = names.map(n => {
      const set = map[n];
      const v = set ? (t('secretSet') + fmtTime(set)) : t('secretUnset');
      return '<div class="secret-line"><span class="k">' + labels[n] + ' · ' + n + '</span><span class="v">' + esc(v) + '</span></div>';
    }).join('');
  } catch (e) {
    box.innerHTML = '<div class="secret-line"><span class="v">' + esc(t('secretLoadFail') + e.message) + '</span></div>';
  }
}

function parseCst(cron) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return '';
  if (parts.slice(2).join(' ') !== '* * *') return '';
  if (!/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) return '';
  const h = String((+parts[1] + 8) % 24).padStart(2, '0');
  const m = String(parts[0]).padStart(2, '0');
  return t('dailyAt').replace('{time}', h + ':' + m);
}

function updateCronDisplay() {
  if (state.cronErr) {
    $('#cronCur').textContent = t('cronLoadFail');
    $('#cronCst').textContent = state.cronErr;
    return;
  }
  $('#cronCur').textContent = state.cron ? (state.cron + ' (UTC)') : t('noSchedule');
  $('#cronCst').textContent = state.cron ? parseCst(state.cron) : '';
}

async function loadCron() {
  if (!state.workflow || !state.workflow.path) return;
  try {
    const seg = state.workflow.path.split('/').map(encodeURIComponent).join('/');
    const r = await gh('/repos/' + state.repo + '/contents/' + seg + '?ref=' + encodeURIComponent(state.defaultBranch));
    state.file = { sha: r.data.sha, content: b64decodeUtf8(r.data.content) };
    const m = state.file.content.match(/cron:\s*'?([\d\*\/\,\-]+)'?/);
    state.cron = m ? m[1] : '';
    state.cronErr = '';
  } catch (e) {
    state.cron = '';
    state.cronErr = e.message;
  }
  updateCronDisplay();
}

async function saveCron() {
  if (!state.connected) return;
  if (!state.file) { toast(t('cronLoadFail'), false); return; }
  const val = $('#cronInput').value.trim();
  const fields = val.split(/\s+/);
  if (fields.length !== 5 || !fields.every(f => /^[\d\*\/\,\-]+$/.test(f))) {
    toast(t('toCronBad'), false);
    return;
  }
  $('#btnSaveCron').disabled = true;
  try {
    const q = /cron:\s*'[^']*'/.test(state.file.content)
      ? state.file.content.replace(/cron:\s*'[^']*'/, "cron: '" + val + "'")
      : state.file.content.replace(/cron:\s*[^\s#]+/, 'cron: ' + val);
    const seg = state.workflow.path.split('/').map(encodeURIComponent).join('/');
    await gh('/repos/' + state.repo + '/contents/' + seg, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'chore: adjust check-in schedule to ' + val,
        content: b64encodeUtf8(q),
        sha: state.file.sha,
        branch: state.defaultBranch
      })
    });
    toast(t('toCronSaved'));
    setTimeout(loadCron, 2000);
  } catch (e) {
    toast(t('toSaveFail') + e.message, false);
  } finally {
    $('#btnSaveCron').disabled = false;
  }
}

(function init() {
  let savedLang = '';
  try { savedLang = localStorage.getItem(LS.lang) || ''; } catch (e) {}
  LANG = (savedLang === 'en' || savedLang === 'zh')
    ? savedLang
    : ((navigator.language || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en');
  applyTheme(document.documentElement.dataset.theme || 'light');
  applyLang(LANG);

  let savedRepo = '', savedToken = '';
  try {
    savedRepo = localStorage.getItem(LS.repo) || '';
    savedToken = localStorage.getItem(LS.token) || '';
  } catch (e) {}
  const q = new URLSearchParams(location.search).get('repo');
  if (q) savedRepo = q;
  if (savedRepo) $('#repo').value = savedRepo;
  if (savedToken) $('#token').value = savedToken;
  if (savedRepo && savedToken) connect(true);
  setInterval(() => { if (state.connected) loadRuns(); }, POLL_INTERVAL_MS);
})();
