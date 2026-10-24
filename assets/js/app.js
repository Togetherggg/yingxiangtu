/* ==========================================================================
   效果图网址 · 风格灵感库  —  主脚本
   纯前端 · 无第三方依赖 · 支持 file:// 与本地服务两种存储模式
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- 工具 */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const ico = (name, cls) => '<svg class="ico ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  const uid = (p) => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const debounce = (fn, ms) => { let t; return function () { const a = arguments, self = this; clearTimeout(t); t = setTimeout(() => fn.apply(self, a), ms); }; };
  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const diff = (Date.now() - d.getTime()) / 86400000;
    if (diff < 1) return '今天';
    if (diff < 2) return '昨天';
    if (diff < 7) return Math.floor(diff) + ' 天前';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const stamp = () => {
    const d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  };

  const LS = {
    lib: 'yingxiangtu.library.v1',
    theme: 'yingxiangtu.theme',
    view: 'yingxiangtu.view',
    sort: 'yingxiangtu.sort'
  };
  const SITES = {
    'vr.justeasy.cn': '建E全景',
    'vr.3d66.com': '3D66全景',
    'vr.zhiouwang.com': '知欧全景',
    'vr.1miba.com': '米吧全景',
    'vr.shinewonder.com': 'ShineWonder'
  };
  const PALETTE = ['#C9A227', '#B08968', '#8A7CFF', '#4FC3F7', '#5FD3B4', '#D9A066',
    '#F2B8B5', '#F2D8A8', '#C3A6E8', '#9AA7B8', '#A8B5A2', '#D7E1EA'];

  const state = {
    mode: 'local',
    token: null,
    lib: null,
    scope: 'home',
    query: '',
    sort: 'default',
    view: 'grid',
    theme: 'dark',
    ready: false,
    readOnly: false,
    baseUpdatedAt: '',
    savingUntil: 0,
    lastError: null
  };

  /* ---------------------------------------------------------------- 数据 */
  const SEED = window.SEED_LIBRARY || null;
  const SEED_VERSION = (SEED && Number(SEED.version)) || 1;

  function siteOf(link) {
    return link.site || SITES[link.source] || String(link.source || '').replace(/^www\./, '') || '未知来源';
  }
  function catOf(id) {
    return state.lib.categories.filter((c) => c.id === id)[0] || null;
  }
  function catColor(id) {
    const c = catOf(id);
    return (c && c.color) || PALETTE[0];
  }
  function catName(id) {
    const c = catOf(id);
    return c ? c.name : '未分类';
  }
  function sortedCategories() {
    return state.lib.categories.slice().sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name), 'zh'));
  }
  function ensureUncat() {
    let c = state.lib.categories.filter((x) => x.id === 'uncategorized')[0];
    if (!c) {
      c = { id: 'uncategorized', name: '待分类', color: '#8B95A7', order: 999, system: true };
      state.lib.categories.push(c);
    }
    return c;
  }

  function normalizeLibrary(raw, opts) {
    const lib = {
      version: 1,
      updatedAt: new Date().toISOString(),
      categories: [],
      links: [],
      schedule: [],
      board: { schedule: true, weather: true, calendar: true, fengshui: true },
      tombstones: [],
      buildInfo: null,
      seedVersion: (opts && opts.seedVersion) || 0
    };
    if (!raw || typeof raw !== 'object') return lib;
    if (raw.buildInfo) lib.buildInfo = raw.buildInfo;
    if (typeof raw.seedVersion === 'number') lib.seedVersion = raw.seedVersion;

    const catIds = {};
    (Array.isArray(raw.categories) ? raw.categories : []).forEach((c, i) => {
      if (!c || typeof c !== 'object') return;
      const name = String(c.name == null ? '' : c.name).trim();
      if (!name) return;
      let id = String(c.id || '').trim() || ('c' + (i + 1) + Math.random().toString(36).slice(2, 5));
      if (catIds[id]) id = id + Math.random().toString(36).slice(2, 5);
      catIds[id] = 1;
      lib.categories.push({
        id: id,
        name: name.slice(0, 24),
        color: /^#[0-9a-fA-F]{6}$/.test(c.color || '') ? c.color : PALETTE[lib.categories.length % PALETTE.length],
        order: Number.isFinite(c.order) ? c.order : lib.categories.length,
        system: !!c.system
      });
    });
    if (!lib.categories.length) {
      lib.categories.push({ id: 'c1', name: '未分类', color: PALETTE[0], order: 0 });
    }

    if (Array.isArray(raw.tombstones)) {
      lib.tombstones = raw.tombstones.filter((u) => typeof u === 'string').slice(0, 5000);
    }

    if (Array.isArray(raw.schedule)) {
      lib.schedule = raw.schedule.filter((e) => e && typeof e === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(e.date || ''))).map((e, i) => ({
        id: String(e.id || ('e' + (i + 1))).trim() || ('e' + (i + 1)),
        date: String(e.date).slice(0, 10),
        time: /^\d{2}:\d{2}$/.test(String(e.time || '')) ? String(e.time).slice(0, 5) : '',
        title: String(e.title || '').slice(0, 60),
        type: ['量房', '方案', '施工', '客户', '其他'].indexOf(e.type) >= 0 ? e.type : '其他',
        note: String(e.note || '').slice(0, 160),
        done: !!e.done
      })).filter((e) => e.title && e.date >= localDateStr(new Date())).slice(0, 500);
    }
    if (raw.board && typeof raw.board === 'object') {
      ['schedule', 'weather', 'calendar', 'fengshui'].forEach((k) => {
        if (typeof raw.board[k] === 'boolean') lib.board[k] = raw.board[k];
      });
    }

    const urlSeen = {};
    const idSeen = {};
    (Array.isArray(raw.links) ? raw.links : []).forEach((l, i) => {
      if (!l || typeof l !== 'object') return;
      const url = String(l.url == null ? '' : l.url).trim();
      if (!/^https?:\/\/[^\s]+$/i.test(url)) return;
      if (urlSeen[url]) return;
      urlSeen[url] = 1;
      let id = String(l.id || '').trim() || ('l' + (i + 1));
      if (idSeen[id]) id = uid('l');
      idSeen[id] = 1;
      let categoryId = String(l.categoryId || '');
      if (!catIds[categoryId]) categoryId = lib.categories[0].id;
      let host = '';
      try { host = new URL(url).hostname.toLowerCase(); } catch (e) { return; }
      const title = typeof l.title === 'string' ? l.title.slice(0, 80) : '';
      lib.links.push({
        id: id,
        categoryId: categoryId,
        url: url,
        title: title,
        note: typeof l.note === 'string' ? l.note.slice(0, 300) : '',
        thumb: sanitizeThumb(l.thumb),
        source: String(l.source || host).slice(0, 80),
        site: String(l.site || '').slice(0, 40),
        status: ['ok', 'warn', 'fail', 'unknown'].indexOf(l.status) >= 0 ? l.status : 'unknown',
        statusCheckedAt: typeof l.statusCheckedAt === 'string' ? l.statusCheckedAt : '',
        addedAt: typeof l.addedAt === 'string' ? l.addedAt : new Date().toISOString(),
        order: Number.isFinite(l.order) ? l.order : i,
        pendingStyle: typeof l.pendingStyle === 'string' ? l.pendingStyle.slice(0, 40) : ''
      });
    });
    if (!lib.buildInfo && SEED && SEED.buildInfo) lib.buildInfo = SEED.buildInfo;
    return lib;
  }

  function sanitizeThumb(t) {
    const s = String(t || '').trim();
    if (!s) return '';
    if (/^assets\/thumbs\/[a-zA-Z0-9._-]+$/.test(s)) return s;
    if (/^https?:\/\//i.test(s)) return s;
    return '';
  }

  function seedLibrary() {
    const lib = normalizeLibrary(SEED || { categories: [{ id: 'c1', name: '未分类', color: PALETTE[0], order: 0 }], links: [] });
    lib.seedVersion = SEED_VERSION;
    lib.updatedAt = new Date().toISOString();
    return lib;
  }

  /* 新版本内置数据合并（不覆盖用户内容，尊重已删除记录） */
  function mergeSeed(lib) {
    if (!SEED || !Array.isArray(SEED.links)) return false;
    const versionChanged = Number(lib.seedVersion || 0) !== SEED_VERSION;
    if (!versionChanged) return false;
    let changed = false;
    (SEED.categories || []).forEach((sc) => {
      if (!lib.categories.some((c) => c.name === sc.name)) {
        lib.categories.push({
          id: uid('c'), name: sc.name, color: sc.color || PALETTE[lib.categories.length % PALETTE.length],
          order: lib.categories.length
        });
        changed = true;
      }
    });
    const seedCatName = {};
    (SEED.categories || []).forEach((c) => { seedCatName[c.id] = c.name; });
    (SEED.links || []).forEach((sl) => {
      if (!sl || !sl.url) return;
      if (lib.links.some((l) => l.url === sl.url)) return;
      if (lib.tombstones.indexOf(sl.url) >= 0) return;
      const target = lib.categories.filter((c) => c.name === seedCatName[sl.categoryId])[0] || lib.categories[0];
      lib.links.push(Object.assign({}, sl, {
        id: uid('l'),
        categoryId: target.id,
        order: lib.links.length
      }));
      changed = true;
    });
    lib.seedVersion = SEED_VERSION;
    return changed || versionChanged;
  }

  /* ---------------------------------------------------------------- 存储 */
  const api = {
    avail: false,
    token: null,
    async call(path, opts) {
      opts = opts || {};
      const headers = Object.assign({}, opts.headers || {});
      if (api.token) headers['X-Token'] = api.token;
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeout || 8000) : null;
      try {
        const res = await fetch(path, {
          method: opts.method || 'GET',
          headers: headers,
          body: opts.body,
          cache: 'no-store',
          signal: ctrl ? ctrl.signal : undefined
        });
        if (timer) clearTimeout(timer);
        if (res.status === 409) {
          const conflictText = await res.text();
          return conflictText ? JSON.parse(conflictText) : { conflict: true };
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  };

  let saveChain = Promise.resolve();

  async function saveLibrary() {
    if (!state.lib || state.readOnly || state.mode === 'public') return;
    state.lib.updatedAt = new Date().toISOString();
    state.savingUntil = Date.now() + 2500;
    const payload = JSON.stringify(state.lib);
    saveChain = saveChain.then(() => doSave(payload)).catch(() => {});
    return saveChain;
  }

  async function doSave(payload) {
    if (state.mode === 'api') {
      try {
        let res = await api.call('api/library', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Base-Updated': state.baseUpdatedAt || '' },
          body: payload,
          timeout: 7000
        });
        if (res && res.conflict && res.library) {
          // 其他设备（手机/电脑）已修改数据：合并后再提交一次
          const remoteRaw = res.library;
          const remoteVer = String(remoteRaw.updatedAt || res.updatedAt || '');
          const remote = normalizeLibrary(remoteRaw);
          state.lib = mergeLibraries(remote, state.lib);
          state.baseUpdatedAt = remoteVer;
          state.lib.updatedAt = new Date().toISOString();
          const retry = await api.call('api/library', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Base-Updated': state.baseUpdatedAt || '' },
            body: JSON.stringify(state.lib),
            timeout: 7000
          });
          if (retry && retry.conflict) {
            const latestRaw = retry.library || {};
            const latest = normalizeLibrary(latestRaw);
            state.lib = latest;
            state.baseUpdatedAt = String(latestRaw.updatedAt || '');
            renderAll(false);
            toast('数据已在其他设备更新，已载入最新版本，请重试刚才的操作', { type: 'warn', duration: 5200 });
            return;
          }
          state.baseUpdatedAt = (retry && retry.updatedAt) || state.lib.updatedAt;
          renderAll(false);
          toast('已合并其他设备上的修改', { duration: 2800 });
        } else if (res && res.updatedAt) {
          state.baseUpdatedAt = res.updatedAt;
        }
        markSaved();
        return;
      } catch (err) {
        state.mode = 'local';
        api.avail = false;
        updateModeChip();
        toast('共享存储暂时不可用，已切换为浏览器本地保存', { type: 'warn', duration: 4200 });
      }
    }
    try {
      localStorage.setItem(LS.lib, payload);
      markSaved();
    } catch (err) {
      toast('浏览器存储写入失败，请先导出备份', { type: 'err', duration: 5200 });
    }
  }

  function mergeLibraries(remote, local) {
    const catByName = {};
    remote.categories.forEach((c) => { catByName[c.name] = c; });
    local.categories.forEach((c) => {
      if (!catByName[c.name]) {
        const nc = { id: uid('c'), name: c.name, color: c.color, order: remote.categories.length };
        remote.categories.push(nc);
        catByName[c.name] = nc;
      }
    });
    const localCatName = {};
    local.categories.forEach((c) => { localCatName[c.id] = c.name; });
    const remoteUrls = {};
    remote.links.forEach((l) => { remoteUrls[l.url] = 1; });
    const remoteTomb = remote.tombstones || [];
    const localTomb = local.tombstones || [];

    // 本地已经删除、但远端还留着的链接，按本地的删除处理
    remote.links = remote.links.filter((l) => localTomb.indexOf(l.url) < 0);

    local.links.forEach((l) => {
      if (remoteUrls[l.url]) return;
      if (remoteTomb.indexOf(l.url) >= 0 || localTomb.indexOf(l.url) >= 0) return;
      const catName = localCatName[l.categoryId];
      const cat = remote.categories.filter((c) => c.name === catName)[0] || remote.categories[0];
      remote.links.push(Object.assign({}, l, { id: uid('l'), categoryId: cat.id }));
    });

    const allTomb = {};
    remoteTomb.concat(localTomb).forEach((u) => { allTomb[u] = 1; });
    remote.tombstones = Object.keys(allTomb);
    return remote;
  }

  async function syncFromServer() {
    if (!((state.mode === 'api' || state.mode === 'public') && api.avail)) return;
    if (document.visibilityState !== 'visible') return;
    if (modalStack.length) return;
    if (state.mode === 'api' && Date.now() < state.savingUntil) return;
    try {
      const raw = await api.call('api/library', { timeout: 5000 });
      if (!raw || !raw.updatedAt) return;
      if (raw.updatedAt === state.baseUpdatedAt) return;
      const remote = normalizeLibrary(raw);
      state.lib = remote;
      state.baseUpdatedAt = raw.updatedAt;
      renderAll(false);
      softUpdateContent();
      toast(state.readOnly ? '分享内容已更新' : '已同步其他设备上的修改', { duration: 2200 });
    } catch (e) { /* 静默失败，下一次再试 */ }
  }

  function softUpdateContent() {
    const content = $('#content');
    if (!content) return;
    content.classList.remove('soft-update');
    void content.offsetWidth;
    content.classList.add('soft-update');
    clearTimeout(softUpdateContent._t);
    softUpdateContent._t = setTimeout(() => content.classList.remove('soft-update'), 520);
  }

  async function refreshPublicLibrary() {
    if (!(state.mode === 'public' || state.mode === 'api')) return;
    try {
      const lib = await loadData();
      if (!lib) return;
      state.lib = lib;
      state.ready = true;
      state.baseUpdatedAt = lib.updatedAt || state.baseUpdatedAt;
      renderAll(false);
      softUpdateContent();
    } catch (e) { /* 静默，下一次再试 */ }
  }

  function markSaved() {
    const el = $('#saveState');
    if (!el) return;
    const d = new Date();
    el.textContent = '已保存 · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    el.style.opacity = '1';
    clearTimeout(markSaved._t);
    markSaved._t = setTimeout(() => { el.style.opacity = '.75'; }, 1600);
  }

  function base64Json(text) {
    const bin = atob(String(text || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  }

  async function loadData() {
    // GitHub Pages 静态版：页面壳固定，数据从 data/library.json 读取
    if (window.__STATIC_LIBRARY_URL__) {
      state.readOnly = true;
      state.mode = 'public';
      api.avail = false;
      let raw = null;
      // 快速通道：GitHub API 读最新提交，避开 Pages 的 JSON 缓存
      try {
        const apiUrl = 'https://api.github.com/repos/Togetherggg/yingxiangtu/contents/data/library.json?ref=main&t=' + Date.now();
        const res = await fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
        if (res.ok) {
          const j = await res.json();
          if (j && j.content) raw = base64Json(j.content);
        }
      } catch (err) { /* 限额或网络失败时回退静态文件 */ }
      if (!raw) {
        try {
          const res = await fetch(window.__STATIC_LIBRARY_URL__ + '?v=' + Date.now(), { cache: 'no-store' });
          if (res.ok) raw = await res.json();
        } catch (err) {
          console.warn('静态数据加载失败', err);
        }
      }
      if (raw && Array.isArray(raw.links)) {
        state.baseUpdatedAt = String(raw.updatedAt || '');
        return normalizeLibrary(raw);
      }
      return null;
    }
    // 公网分享页：服务端已把数据和只读标记内嵌到 HTML，首屏不依赖接口
    if (window.__PUBLIC_READONLY__) {
      state.readOnly = true;
      state.mode = 'public';
      api.avail = true;
      const raw = window.__PUBLIC_LIBRARY__;
      if (raw && Array.isArray(raw.links)) {
        state.baseUpdatedAt = String(raw.updatedAt || '');
        return normalizeLibrary(raw);
      }
      return null;
    }
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      try {
        let ses = null;
        try { ses = await api.call('api/session', { timeout: 1500 }); } catch (e1) { ses = null; }
        if (!ses) {
          // 公网隧道首次连接可能较慢，再给一次机会
          try { ses = await api.call('api/session', { timeout: 7000 }); } catch (e2) { ses = null; }
        }
        if (ses && (ses.token || ses.readOnly)) {
          api.token = ses.token || '';
          state.token = ses.token || '';
          state.readOnly = !!ses.readOnly;
          api.avail = true;
          state.mode = ses.readOnly ? 'public' : 'api';
          const data = await api.call('api/library', { timeout: 8000 });
          if (data && Array.isArray(data.links)) {
            state.baseUpdatedAt = String(data.updatedAt || '');
            return normalizeLibrary(data);
          }
          return null;
        }
      } catch (err) { /* 非服务模式，回退本地 */ }
    }
    try {
      const raw = localStorage.getItem(LS.lib);
      if (raw) {
        const parsed = JSON.parse(raw);
        const lib = normalizeLibrary(parsed);
        if (lib.links.length || (parsed && parsed.categories)) return lib;
      }
    } catch (err) { /* ignore */ }
    return null;
  }

  /* ---------------------------------------------------------------- 主题 */
  function applyTheme(t) {
    state.theme = t === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    const use = $('#themeBtn use');
    if (use) use.setAttribute('href', state.theme === 'dark' ? '#i-sun' : '#i-moon');
    try { localStorage.setItem(LS.theme, state.theme); } catch (e) {}
  }

  /* ---------------------------------------------------------------- 侧栏 */
  function renderSidebar() {
    const lib = state.lib;
    $('#countAll').textContent = lib.links.length;
    const catCount = $('#countCats');
    if (catCount) catCount.textContent = lib.categories.length;
    const list = $('#catList');
    list.innerHTML = sortedCategories().map((c) => {
      const n = lib.links.filter((l) => l.categoryId === c.id).length;
      const kebab = (state.readOnly || c.system) ? '' :
        '<button class="cat-kebab" type="button" data-kebab="' + esc(c.id) + '" aria-label="管理风格 ' + esc(c.name) + '">' + ico('more') + '</button>';
      return '<div class="cat-item' + (state.scope === c.id ? ' is-active' : '') + '" data-scope="' + esc(c.id) + '" style="--c:' + esc(c.color) + '" role="listitem" tabindex="0">' +
        '<i class="cat-dot"></i>' +
        '<span class="cat-name" title="' + esc(c.name) + '">' + esc(c.name) + '</span>' +
        '<span class="cat-count">' + n + '</span>' +
        kebab +
        '</div>';
    }).join('');
    $$('.nav-item[data-scope]').forEach((el) => el.classList.toggle('is-active', el.dataset.scope === state.scope));
  }

  /* ---------------------------------------------------------------- 顶部 */
  function renderHead() {
    const visible = visibleLinks();
    const total = state.lib.links.length;
    const cats = state.lib.categories.length;
    let title = '风格总览';
    let sub = cats + ' 种风格 · ' + total + ' 条链接 · 点击风格进入';
    if (state.scope === 'all') {
      title = '全部链接';
      sub = total + ' 条效果图 · ' + cats + ' 种风格';
    } else if (state.scope !== 'home') {
      const c = catOf(state.scope);
      title = c ? c.name : '全部链接';
      sub = visible.length + ' 条链接 · 按' + (state.sort === 'new' ? '添加时间' : state.sort === 'title' ? '标题' : '收录顺序') + '排列';
    }
    if (state.query) {
      title = '搜索结果';
      sub = '「' + state.query + '」 · ' + visible.length + ' 条匹配';
    }
    $('#viewTitle').textContent = title;
    $('#viewSub').textContent = sub;
    const head = $('.content-head');
    if (head) head.classList.toggle('is-home', state.scope === 'home' && !state.query);
  }

  /* ---------------------------------------------------------------- 内容 */
  function visibleLinks() {
    const q = state.query.trim().toLowerCase();
    let links = state.lib.links.slice();
    if (!q && state.scope !== 'all' && state.scope !== 'home') links = links.filter((l) => l.categoryId === state.scope);
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);
      links = links.filter((l) => {
        const hay = [l.title, l.url, l.note, siteOf(l), catName(l.categoryId)].join(' ').toLowerCase();
        return terms.every((t) => hay.indexOf(t) >= 0);
      });
    }
    const catOrder = {};
    sortedCategories().forEach((c, i) => { catOrder[c.id] = i; });
    const dir = state.sort;
    links.sort((a, b) => {
      if (dir === 'new') return String(b.addedAt).localeCompare(String(a.addedAt));
      if (dir === 'title') return String(a.title).localeCompare(String(b.title), 'zh');
      return (catOrder[a.categoryId] || 0) - (catOrder[b.categoryId] || 0) || (a.order || 0) - (b.order || 0);
    });
    return links;
  }

  let boardCalState = null;
  let boardPrefs = null;
  try { const rawBoard = localStorage.getItem('yxg.board.prefs'); if (rawBoard) boardPrefs = JSON.parse(rawBoard); } catch (e) {}

  function boardConfig() {
    const libBoard = state.lib && state.lib.board ? state.lib.board : {};
    const cfg = Object.assign({ board: true, schedule: true, weather: true, calendar: true, fengshui: true }, libBoard);
    if (boardPrefs) {
      ['board', 'schedule', 'weather', 'calendar', 'fengshui'].forEach((k) => {
        if (typeof boardPrefs[k] === 'boolean') cfg[k] = boardPrefs[k];
      });
    }
    return cfg;
  }

  function saveBoardPrefs(patch) {
    const current = boardConfig();
    boardPrefs = Object.assign({
      board: current.board,
      schedule: current.schedule,
      weather: current.weather,
      calendar: current.calendar,
      fengshui: current.fengshui
    }, patch);
    try { localStorage.setItem('yxg.board.prefs', JSON.stringify(boardPrefs)); } catch (e) {}
  }

  const WALLPAPER_KEY = 'yxg.wallpaper.prefs';
  const WALLPAPER_THEMES = [
    { id: 'all', label: '全部' },
    { id: 'interior', label: '室内' },
    { id: 'exterior', label: '室外' },
    { id: 'garden', label: '园艺' }
  ];
  const WALLPAPER_DURATIONS = [
    { value: 60, label: '1 分钟' },
    { value: 300, label: '5 分钟' },
    { value: 900, label: '15 分钟' },
    { value: 1800, label: '30 分钟' },
    { value: 3600, label: '1 小时' },
    { value: 43200, label: '12 小时' },
    { value: 86400, label: '24 小时' },
    { value: 0, label: '永久' }
  ];
  const WALLPAPERS = [
    { id: 'w1', theme: 'interior', title: '暖木客厅', src: 'assets/wallpapers/w1.jpg', thumb: 'data:image/jpeg;base64,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' },
    { id: 'w2', theme: 'interior', title: '静谧起居', src: 'assets/wallpapers/w2.jpg', thumb: 'data:image/jpeg;base64,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' },
    { id: 'w3', theme: 'interior', title: '光影餐厅', src: 'assets/wallpapers/w3.jpg', thumb: 'data:image/jpeg;base64,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' },
    { id: 'w4', theme: 'exterior', title: '极简住宅', src: 'assets/wallpapers/w4.jpg', thumb: 'data:image/jpeg;base64,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' },
    { id: 'w5', theme: 'exterior', title: '暮色别墅', src: 'assets/wallpapers/w5.jpg', thumb: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAkGBwgHBgkICAgKCgkLDhcPDg0NDhwUFREXIh4jIyEeICAlKjUtJScyKCAgLj8vMjc5PDw8JC1CRkE6RjU7PDn/2wBDAQoKCg4MDhsPDxs5JiAmOTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTn/wAARCACWAPADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD1TRrSSxtZIWCKnms0aKOEXsP5n8ah1q2uLvSdQtlCLJNC4jYdjztPselarHmq13I0cDuiB5ACVUtjcfTNap6mNtDze/8ABGnWNtBJqFzAtobRIpWfgiVSSDnuDkj8BUnhrU7HU/FdnDol2EtrK2EflcYkUcE+vpXDeLfEk2vaj/Yc6yLGbgJuBztboSAOozXYaPo/h/w9qfh8Wrf8TV2C/KCDICCGJGccGrv2Jt3PVFHsPyrzv4ma81zpGoadZt+4SJvOkH8ZH8I9h+tdTr+p7N1jbP8AvWGJHU/cB7D3rhPE1isWg6iQRxbsf0qUu42+iPI7+NlgY47j+dUVxxht1berR/6BK/8ACCMH15rIlWRCm+MR5AIx396g0H8bARwR1zT8HyQcDaW6981Hn5Bk5PapRt2rnIbPI7YxTA1LdYv7PvfKdnGyPO7sc9K2vDcW/TgdxA88ZA+orLTzDpl4ZI0Q+XFjZ3GeproPCqp/ZXUkeeM/mtYyehrFanM/EEj/AITvWlAxsunX681QtD0rT+JChfHmtEd7lj+tY9u2MZrWGiMpG2r5hC+9KtU4HZnALY9hVtSR1GfpXTB6GMiZamWoEIPIqZasglj/ANZ/wH+tWFqvH/rP+A1YWqRLJVrU0bV73SLnz7OXYT95SMq49CKy1qVapq+4tj13w/4ostbUQsFgvCOYWxh/909/pXmHiPwvJP461vTdAtIlENvFeC2DlAWP3vLPRWOQR2qqrFZEIJBGSCO3Sug8LavDY+J5tX1GSaSS4t1tpJOuApG0/piueVKzvE2jUvpI4231ryHa21HMciMULSJsZWH8Mi/wt79DVLUfEttExEKmUgY9BXpPjrwjp/iWN9QtXQTufkuoucj0b1H6ivBrqGS2uJreXG+Jyhx0yDis/bStYv2UdzRPijVIp5JbS4a0Z0KMYuCVPUZrPt7yaOfzw5Mg5y3OfrVRmAPNSWjMZl2xeZnjaRkGs+Zt6l8qS0O5hl3xBjwSM10yxpNaqkiK6MgBBGQeK5KLKxKO4UV2NqMwRDvsH8q6oHNM9maqOr6fHqum3NhMzLHOhQlTggH0q+3Wm4rnNzgLLwFpOm2q3lzAWvYIvKWUH5VIz+9Hoee/pXG67/wiOh2V1d2T6hcanNAscTSIdiEgEufcj+del+O/EdnoehXm66tVvdqiOCUgl8sB93vxn8q+d9b1y9v7u4aWaGQS7QfLj2qAAAAB2AAAob0BR1JmuNJuHeV3u0cksxTP8qZPb21xH/olycBQP3uQznOP61kqxds8AsegGBXQS20QihAUxyGEM69gxft+H8qycjWMbmTLeXKQTWUh3IGxz1XBqGQx4TZI78fNu7fSmTk+dKCSTvPJ780vzYQkAehqhEqk+SxUDZnnPrUgz5QI+5uxn3xUBPy/M2WyenQ+9SscKAy7Xz90DAxjrTuI1rYRnT7sxOzAJHuz2OeldL4ULHTSMDHnL/6EKw187+ybsyxJGPJi27f4hu6mtjwe2bOYZ/5axn/x4VjJ3TNVozH+JGD461gr/wA/D5+uTWDGcVufED/kedc/6+3/AJmsNa2jsjFl6yOZvwNaC1maef8ASMf7JrTFb09jKW5KADz39akQsOvI9utRpUq1qZsliIL8HtVharoAX59OtTLuH+0P1ppksnWpVqFCCff0qZasTHj76/Q/0qXtUQ++v0NS9qBFGXXr/wAP3IuLKT5GP72F+Y5B7jsfcc1wOrTi8v7m5VNgmkaTbnO3JJxmuq8S/cFcfN3+tcdVLmudVJu1iGCLzJgD6GtXQYwTIccg8fmao6eM3K/Q/wAq0dBHzTfX+pqIrUqT0NteFr0DQPC0Him3MEtzPbS28SyQywtgq3T8a4ADivRPDGtT6IVlhijlWSJVdXJGR7HtW0ouUWkZXSkmz1NhzTXIRC7fdFOmby4pJNpIRCxA9hmvDPHnjO9k1WR9mpWlttjCLb3gXkpnp+PpWFzaxP8AFgi61LUHmOxBBBg4ztGTXke0c4zjsfWtLVNTu9Rmlf7TfyhlUOLiXeSB0z7VQUZB/iAH5VLZSRZtIZXt5XWHdEuC0mPu8gV010gEdltO4GyU7v737w81z1iqmGb/AEgq2B+57PyOP6/hXV3a5FoSmwiwX5fT5zWE3qbQWhw8/wDr5f8Afb+dAxjgk+vtSzf62X/eP86OcDK49PetzEeM+Wdq/Lnqak6R/I25M/eIwc46VHgGIsXwd33f61JMCFG+Pym4wgGOMdfxouBvWaQNoF+8UzyMIot6t/Ad/QV0HhCIf2UZAo3GdRn6MtZStOfDV551tHCPs0Owr/GPM6mt7wTKItGViiPi5HysMg/MtYN6P1NkvyOW8dc+ONf9r2T+dYwFb3jkA+N9fI/5/ZP51iha6Y7I53uSWA/0nP8AsmtIVQsxib8DV9a3hsZT3JUqZagWplrREMmj+9+FTrVeL7/4VOtUiWTABsZFSqGHT5h6d6iSplpiHIwMijvg8HrU3aosBmUEZ608hlHB3D0PX86YjnvEn3BXITd/rXXeIjlB1B9DXIzd/rXLV3OinsO03/j6X6H+VaOgD57j6/1NZ2mf8fS/Q/yrS0D79x9f6mohui5G2Pu12Nt/x7xf7g/lXHdq7S2/1EX+4P5V0wOeZsfFDWr1Lv7DEbWKCISZaWaSMt+7RuqnrzwK8Id5bmaMkSBiqgb3LEnGM5PrXs/xRjin1cMdPbUVZ5SiRnIB8iP5s+gryq201wEZwHX5Sdn0Bx9a4ZySOuKuUh5qSzq8hViArsRk8Ed/wqAD73OzgcVdu4wk1wApAAGAeo5qp0L5G/jr6VKdyrF2wB+yzYttwwP339z5hz/T8a6y7UBbT59//EvX5vX5zXLaepNpOftOAAuYP7/zDj+v4V1t9GTFaHZsxpynae3znisp7msNjgpvvyf7x/nSAcDDZ/pSzdX/AN4/zpONo+XH9a6DAeSBBjy8tuPz/wBKklGF+WQTDjL8+nTmmOCLXPmALvOE7/WnzYKgmLyRjheefU80hnQ2xh/4Ry/8q6eZvIi3qx/1Z39BXQeEv+QKg/6eV/8AQ1rAhMp8M3XmW6RL9ni2MvWQeZ1NdB4R/wCQKn/Xwv8A6GtYPb5mqMLxmv8AxWmv/wDX9J/OsfbW541IPjTXf+vyQfqaxgK6lsjne4tsMTfhVwVXhXD59qsCtobGctyValU1ApqZa0RmTRn5/wAKsLVVD8/4VYQ1SEToamWq61MppkkoPzL+NSE8VDn5l/GnluKdwMHxGf3YrkJsHP1rrfEZ+QVyM3f61zVdzensSabxdL9D/KtHQD+8uPr/AFNZum/8fK/Q/wAq0tA/1lx9f6mohui5G2Oldlbn9zH6bB/KuMHSu0th+4j90H8q6YHPM83+03dnqL/ZrqaD5SPkcgYKjIx711qSWxiIjCggIQMd9orhY5ZXuS8vLFc8/QVpWl2x3ZbjAzz7CvJrx5md9N2RBquTeXjd8Lk++RWYuT5mw7Rt5z+FXr5g0lycHGF/mKonGZN4JOOMfhWkdhPc0tMCG1m/0VmcBcT9o/mHP9Pxrtr9DstgW3kaWuWHf5m5rjdL8z+zrk/aVEQC7oO7/OP/ANf4V2l1txbhUKL/AGUMKe3LcVlN+8jWHwnmk/Vv94/zpAThRnJyMe1JOfmb/e/rTARgduea6TAlkKeWRsO/ccnoMemKmmJwP3wnYqMnOdvoKrvuEI5GzcceuafLIjIgRBEAP72STSA6K2Mf/CN3my5aZvJi3qT/AKs+Z0FdL4P50Rf+vlf/AENa49NQg/4R+4tmEUUpijVApyZMPkk+nHrVrSfFJ0vShax26vKJBJvd+Bhgeg69KycW/vNLpFjxk2fGviD2v5R+tZiVFe6lJquq3uoTbBLdzNM4QfKCeTj2p6PzwDXQnoYssqMDNSA1HhhFuJAGegFKpPtW0HoZS3JhUqmoAx/un8OakV19cfXitLktE6H5/wAKsKaqoctwc8VOhppkssKalU1XU1IDVXJJd+GH40u/ioCfmH40NIFouFjJ8RNlFrlZuh+tdHrkm4AVzkvf61zVNzensP03/j6X6H+VaWgf6y5+v9TWbpn/AB9L9D/KtPw//rLn6/1NKG6HLqbQHFdvbjMEWP7g/lXFDoa7e1H7mL/cH8q6oHPM8onURXmM7QUz+gplgwJOc5xxj6UuoyK17mMhwFxx9BUemuVY7XKnB5H0rzprc7YdC1cbvMuSCGbahz26is9Cf3vlkY29/wAKszMpM4IKqVTOBnuKo5BLbsjI7UorQps1dMaH7JOPs7tONu2b+GP5hyfT0/Gu6uSWkiDMHcaUCSO/Lc15xBfyw201qHxDLjcuOuCD1/CtRfGGoW17b3enhbSS2gWCMqA+ApJB5781EoNu5SmkjClOWbn+I/zpFIyN3Iz2xS7gevJNKAv9wfiK2MxJWj8w+WsgUHocN/KpLi9ubxh50u4KcgMgAH4D6Co9oHQYpQODRYLkZjYnkIc+gxUohRhkpg+uaUU9c0xEkEQUAhiPar0IGRzVINwKnikwaANSUgWw/wB4VCHqGa4zCB71B5+K0g9DOS1NFXqZWrLW5A71It6o71fMTymmApfoOlSrx0Zh+Oayft6g59qX+01FPmQuVm0rN6qfqMU8Ow6r+RrCOsAdqY2uMPuoKfOhcjN9pBuXOR16ikLAngg/jXOPrdw3QKMVXm1W7ZeJApJ6hRS9ohqmzT1sjK1z0nQ1JJNPN/rJ3bHqaaIwTzk/jWEppm0YNDtM/wCPpc/3T/KtDQZI43uDI6oCeNxx3NUBEuBx/nipBGueg6/1pKpYp07nRfbrUAj7RH+BzXSr4p0iOGNftRYhQCFQnnFeeIo3Lx6f1oUcL+H8qpYlrZEvDp7sinRzKSASPUfSmQOIZB5i8e4NaLI2w7Qc5qhdKyTMGyDx/Ks9y7WLVlqi20/mPp9tdegmBwPyNZ6oMYK/jmgMRS5NNKwriiNPQcUbVHagK7KSEYgdTirF5p95YyLFdwmF2UOFYjOD0PWkBXyBxSZqRYdx5kQfU1as9OS4mji+2RKXYKOD3ockhpNlGjsa6rSNE8NGaZNZ16eExttVLaDeW9fXFYF5FbpcyrbFzAHIQyfeK54J96SqJ7A4tblUUoOKcFH1/CrNsJEkVlTgd9oqrisQLliAvJ9BzWtZaBrN5g22l3soPQrAx/pW7ofjCLSNiXNvM5B3bo2xx6dK9atviPYtFH/xLdbwVGD9gkI6euKw9rK7VjRwSWjPFJvCHiUQknRbwAH+JNv86zbvQNbs+bnSb2IerQmva7zx5pzOxbTNWKls/PYSf4Vi6x460O6RYri1ugSy4E9uy56+orN4madkilSi92eQSW13H9+1uF/3omH9Kgcsn3gy/wC8MV6ufGOg2pWT7JMMMOYxzntxitPVvG8F0sEbaLqMKtkrJcQFFbgcAsOaFip2vylOgr2TPFPMGPvDr60m7PevUZ9ZsZYg7aVEwPPzIh7/AO7Wfc3OluCTodoecfcUfyFCxqe6KeDkefZorrpm0uVMrotqnGcqWHb61TktdPJOLIL/ALsjDv8AWtFio9ifqsznqRhwPrWz9jtHOFhden/LTPp/jVY2kZ24DAcHr9P8atV4Mh0JopqhI/CplTn8P8an8sBeB2/oKNvP4f8AxVQ5XKULEO3gf59KeByf97+tOI4/z/s0uOf+BD/0I0XHYag+ZPw/rSAcL/wH+VPQfMn/AAH+tIBwv/Af5GmKxrQRjy9rKfmIrXt/Dem3lms0kcizOSSyuRnn0rmWvYDtxKp6dDXa6BKsmjwMp3A7uc5/iNbUlrqYVXpoc5rmgQafpzSRM53TIuT1A5qzr/hJLXVLiK2ml8lSNnmNubGAeT3rW8UqG8PyH0uIf5mt3X0B1a4/4D/6CKSX7xr+ugr+4mec3WktaaNdu7E/vIgPbk1p+M/DsFjqkMenxeVA1rE5XcW+YrknJNaPiSIDw7dED/ltF/M1v+LYA19bn/p0h/8AQai37y39dCr+5c8uOnTD0q7omnSNq1nuHHnpn8xXSNbD0FWtItgNQtTgf61f51c4+6xRlqjf+EkEa+IfEAKISk/GQDjk1xGq6OjaxfMR1uJD/wCPGu/+FYx4o8Sj/pv/AOzGsXUoB/aN0cdZn/8AQjWGHV2zSs7HNw6VEo+4PyqS5s0SzmIUfdrZEWKhvI/9FmGP4a7OXQ5lLU4+WLCsP9mvp7Rw50qwAY/8e8ff/ZFfOctuGRsjnFfSWiD/AIlll/1wj/8AQRXmp81Ro76itTizk9R3i6nyzHEp7+9eb/E1mMtihViC0Z3dh8z8fr+lek6mcX1yD/z2P868++IsJkuNNfccebGhXscs/P8An1rx8PpiPvO6etNL0OJaP/SoV9biIfrXrHxKHnWmjBJjIxZjsz90bFrzu/tvKurdtuP9Jh/9Cr1DxjbxyroxjUciTJGeyLXdKf7u/qZONqyTPPfscv2dPl7H+dRT2sgBBU/eH866s2QECfQ/zqtd2mCf94f+hVxxrXO5pHGmIiPkY+X+hpJE5P8AnvWvLB+56fwf+ymq08A3HjHP/s1dSncz5dDMgT5/++f/AGSqpXAX/gP/ALLWlBGd5+i/+yVRcHC/8B/9kreD1MKi0KxHyfgP5LSEcn6f/FU8j5PwH8lpp6n6f/FVumczQxhx+f8A7LRj5v8AgQ/9CNKw/r/7LR3/AOBD/wBCNWnoTYRB8yf8B/kaRRwn/Af5GnJ95Pov8jSL0T/gP8jTRJhqea9I8IN/xT1sPQv/AOhGuLGiyLNGn2m2l8w4XypRyffOMfjXaaDBNpuixR3UflupbjcD3J6g11xepxy2LniAbvDtx7XEH/oVb2vj/icXP1X/ANBFYd+6zaC4PBluLYhTwSN/NdB4mXbr14PRx/6CKiP8V/12KfwI57xGo/4Ru7/67Q/+hV0fiuMC9tve0h/9Brn9eXd4cux/02g/9CrpfF4xf2w/6dIv5VK/iv8ArsN/w0c6Uq5pUQ+3W3H/AC1X+dQdav6Uv+m2/wD10X+daz+FkR3RofDIbfFPiY/9PGP/AB41naiub65OOsrfzNaXw+PleIvE79vtR/mao3w/0ufnP7xufxrlwr1ZtXKJWq12MwSD2q49VbjmN/pXd0OVbmS8OV/CvoTRf+QbZ/8AXCP/ANBFeFC2eSEMq5GCK900htun2gPaFP8A0EV5FKS9vM9Suv3MDldaA+1zsOolP864Pxt882lD1u4R+r13eqNm7uP+urfzNcX4og8y/wBDB+69/Cv6tXk03++b9Tsf8NfIxvEkQjFs2P8Al7h/9CNeka9Z+dfaOsZ+VopT9PkSuS8faYLewt5Qet7CP1Nd1ejGp6OvpBN/6AlbUmpULPzM60v3yaM19JHkqC3IB/nWXqNg8fI+Ybh/6FXWSfcFUbpQSOP4h/6FWPs0loaKo7nn0kS/Z/mBzs/9laqdxCmTw2c9j/tV099YhrbcgwfL/wDZGrDuIyshBHQ/+zinGWputUYywrGQx3chen/bOqT2sbBRvYfd/hH+x71sugKx/RP/AGlVNo/u/RP/AGnXVTmRONzINrGRgSsPlHVPZfeomt0BI87t/c9mq8F6f7g/klV3X5j/ALp/k9dUZHLKCKzQLx+8HU9j6rQYBkfvF+8Ox/vGpWHT6n+a0xzyP94f+hNWqehk1qQrF8y/vE6L6+hpVh4T95H/AA/xf7JpqfeX6L/I0L0T/gP/AKDVkDbmGCOASbSF6EAZzVJJCrcEgA8gcUUVpTd1qcvQu2+pXYUf6RLuHK/NkAV03hTXH1S8+w3oZ5yCVmHcD+8P60UVa0uB0+tafu0O4SN85kjc7hjhWya0fGjBdTtxz/x6x/yooqKbvUKmrRMJWB9a09FAN9bf9dF/nRRXRP4WYx3NTwEgbxF4lB6fbD296ztQx9sn/wCujfzoorkwu7N62xRkxiq033Goorv6HL1L2mIrW4U+5r1mwIW0t+T/AKte3sKKK+eT/wBoqep69X+DA4nzN010d7t/pMmCxycbjWF4kRf7Q8Ov/F/aUS59smiiuGn/ABfvOmf8P7jR+JKg6La4/wCf+H+Zro9QI/tXSevFvL/6ClFFaU/4a+ZhL4h8hGwcn/JqpcHkcn7w/wDQqKKSehojLkANqP8Arn/7I1ZGpW6szEcHPp/tiiis29TeBhuoCx/RP/aVUWA+X6J/7SoorpplSKIA4/3F/lHVZ8bj/un+T0UV1xOeRDJ1H1P80qM43DP94f8AoTUUVvE55bkQAyp9l/8AQTTU6J9R/wCgUUVoZn//2Q==' },
    { id: 'w6', theme: 'exterior', title: '庭院建筑', src: 'assets/wallpapers/w6.jpg', thumb: 'data:image/jpeg;base64,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' },
    { id: 'w7', theme: 'garden', title: '绿意花园', src: 'assets/wallpapers/w7.jpg', thumb: 'data:image/jpeg;base64,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' },
    { id: 'w8', theme: 'garden', title: '林间小径', src: 'assets/wallpapers/w8.jpg', thumb: 'data:image/jpeg;base64,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' },
    { id: 'w9', theme: 'garden', title: '自然庭院', src: 'assets/wallpapers/w9.jpg', thumb: 'data:image/jpeg;base64,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' }
  ];
  let wallpaperPrefs = null;
  let wallpaperTimer = null;
  let wallpaperList = [];
  let wallpaperIndex = 0;
  let wallpaperVisible = 'A';
  const WALLPAPER_CUSTOM_KEY = 'yxg.wallpapers.custom';
  let customWallpapers = [];

  function allWallpapers() {
    return WALLPAPERS.concat(customWallpapers);
  }

  function loadCustomWallpapers() {
    let arr = [];
    try { const raw = localStorage.getItem(WALLPAPER_CUSTOM_KEY); if (raw) arr = JSON.parse(raw); } catch (e) { arr = []; }
    customWallpapers = (Array.isArray(arr) ? arr : []).filter((w) => w && typeof w.id === 'string' && typeof w.src === 'string' && typeof w.thumb === 'string' && WALLPAPER_THEMES.some((t) => t.id === w.theme)).map((w) => ({
      id: w.id,
      theme: w.theme,
      title: String(w.title || '自定义壁纸').slice(0, 30),
      src: w.src,
      thumb: w.thumb,
      custom: true
    })).slice(-30);
  }

  function saveCustomWallpapers() {
    try { localStorage.setItem(WALLPAPER_CUSTOM_KEY, JSON.stringify(customWallpapers)); return true; } catch (e) { return false; }
  }

  function drawWallpaperCover(img, w, h, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, w, h);
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return canvas.toDataURL('image/jpeg', quality);
  }

  function compressWallpaperFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type || '')) { reject(new Error('请选择图片文件')); return; }
      if (file.size > 20 * 1024 * 1024) { reject(new Error('图片不能超过 20MB')); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('图片无法解析'));
        img.onload = () => {
          try {
            resolve({
              src: drawWallpaperCover(img, 1600, 1000, .82),
              thumb: drawWallpaperCover(img, 400, 250, .75)
            });
          } catch (e) { reject(new Error('图片处理失败')); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function wallpaperThemeLabel(theme) {
    const item = WALLPAPER_THEMES.filter((t) => t.id === theme)[0];
    return item ? item.label : '全部';
  }

  function loadWallpaperPrefs() {
    const def = { enabled: true, theme: 'all', selected: 'w1', rotate: true, duration: 900 };
    let parsed = null;
    try { const raw = localStorage.getItem(WALLPAPER_KEY); if (raw) parsed = JSON.parse(raw); } catch (e) {}
    wallpaperPrefs = Object.assign(def, parsed || {});
    if (!allWallpapers().some((w) => w.id === wallpaperPrefs.selected)) wallpaperPrefs.selected = 'w1';
    if (!WALLPAPER_THEMES.some((t) => t.id === wallpaperPrefs.theme)) wallpaperPrefs.theme = 'all';
    const dur = Number(wallpaperPrefs.duration);
    wallpaperPrefs.duration = WALLPAPER_DURATIONS.some((d) => d.value === dur) ? dur : 900;
    wallpaperPrefs.enabled = wallpaperPrefs.enabled !== false;
    wallpaperPrefs.rotate = wallpaperPrefs.rotate !== false;
    return wallpaperPrefs;
  }

  function saveWallpaperPrefs() {
    try { localStorage.setItem(WALLPAPER_KEY, JSON.stringify(wallpaperPrefs)); } catch (e) {}
  }

  function wallpapersFor(theme) {
    return theme === 'all' ? allWallpapers() : allWallpapers().filter((w) => w.theme === theme);
  }

  function showWallpaper(wallpaper) {
    const a = $('#wallpaperA');
    const b = $('#wallpaperB');
    if (!a || !b) return;
    const next = wallpaperVisible === 'A' ? b : a;
    const prev = wallpaperVisible === 'A' ? a : b;
    next.style.backgroundImage = 'url("' + wallpaper.thumb + '")';
    void next.offsetWidth;
    next.classList.add('is-visible');
    prev.classList.remove('is-visible');
    wallpaperVisible = wallpaperVisible === 'A' ? 'B' : 'A';
    const full = new Image();
    full.onload = () => {
      if (next.classList.contains('is-visible')) next.style.backgroundImage = 'url("' + wallpaper.src + '")';
    };
    full.src = wallpaper.src;
  }

  function scheduleWallpaper() {
    clearTimeout(wallpaperTimer);
    const seconds = Number(wallpaperPrefs.duration) || 0;
    if (!seconds) return;
    if (wallpaperPrefs.rotate && wallpaperList.length > 1) {
      wallpaperTimer = setTimeout(() => {
        wallpaperIndex = (wallpaperIndex + 1) % wallpaperList.length;
        wallpaperPrefs.selected = wallpaperList[wallpaperIndex].id;
        saveWallpaperPrefs();
        showWallpaper(wallpaperList[wallpaperIndex]);
        scheduleWallpaper();
      }, seconds * 1000);
    } else {
      wallpaperTimer = setTimeout(() => {
        wallpaperPrefs.enabled = false;
        saveWallpaperPrefs();
        const layer = $('#wallpaperLayer');
        if (layer) layer.classList.remove('is-on');
        if (typeof toast === 'function') toast('壁纸播放结束，已自动关闭');
      }, seconds * 1000);
    }
  }

  function applyWallpaper() {
    clearTimeout(wallpaperTimer);
    const layer = $('#wallpaperLayer');
    if (!layer) return;
    if (!wallpaperPrefs || !wallpaperPrefs.enabled) {
      layer.classList.remove('is-on');
      return;
    }
    wallpaperList = wallpapersFor(wallpaperPrefs.theme);
    if (!wallpaperList.length) wallpaperList = allWallpapers();
    let idx = wallpaperList.findIndex((w) => w.id === wallpaperPrefs.selected);
    if (idx < 0) {
      idx = 0;
      wallpaperPrefs.selected = wallpaperList[0].id;
      saveWallpaperPrefs();
    }
    wallpaperIndex = idx;
    layer.classList.add('is-on');
    showWallpaper(wallpaperList[idx]);
    scheduleWallpaper();
  }

  function initWallpaper() {
    loadCustomWallpapers();
    loadWallpaperPrefs();
    applyWallpaper();
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function localDateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function scheduleDateLabel(date) {
    const d = new Date(date + 'T12:00:00');
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + week[d.getDay()];
  }
  function sortedSchedule() {
    return (state.lib.schedule || []).slice().sort((a, b) => (a.date + ' ' + (a.time || '99:99')).localeCompare(b.date + ' ' + (b.time || '99:99')));
  }
  function scheduleDateSet() {
    const set = {};
    sortedSchedule().forEach((e) => { set[e.date] = true; });
    return set;
  }
  const FS_TIPS = [
    '玄关先做到明亮、干净、鞋子有地方收，进门不堵，就是最好的“藏风聚气”。',
    '客厅沙发背后有实墙或稳固柜体，动线不绕，坐得安稳比摆件更重要。',
    '卧室先解决遮光、静音和床头靠实墙；镜子不要正对床。',
    '厨房先看排烟和灶台与水槽的距离，安全规范永远高于方位说法。',
    '卫生间干湿分离、排风通畅、门常关，比任何摆件都实用。',
    '家里不要为了“招财”堆满装饰；留白、通风、好清洁才是长期舒适。',
    '横梁下避免长期久坐久卧；用吊顶、柜体或家具布局弱化压迫感。',
    '阳台保持通透，不堆杂物；绿植适量，不挡采光和消防通道。',
    '书桌座位背后有靠、视线不直冲门口，光线从侧前方来更舒服。',
    '镜子、尖角、深色墙面先看是否造成不适；住得舒服比“形法”重要。'
  ];
  function fengShuiTip() {
    return FS_TIPS[Math.floor(Date.now() / 86400000) % FS_TIPS.length];
  }

  function renderBoardCalendar() {
    const now = new Date();
    if (!boardCalState) boardCalState = { y: now.getFullYear(), m: now.getMonth() };
    const y = boardCalState.y;
    const m = boardCalState.m;
    const first = new Date(y, m, 1);
    const start = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();
    const events = scheduleDateSet();
    const todayStr = localDateStr(now);
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const num = i - start + 1;
      let d, cy = y, cm = m, muted = false;
      if (num < 1) { d = prevDays + num; muted = true; cm = m - 1; if (cm < 0) { cm = 11; cy--; } }
      else if (num > days) { d = num - days; muted = true; cm = m + 1; if (cm > 11) { cm = 0; cy++; } }
      else d = num;
      const ds = cy + '-' + pad2(cm + 1) + '-' + pad2(d);
      cells += '<div class="cal-cell bcal-cell' + (muted ? ' is-muted' : '') + (ds === todayStr ? ' is-today' : '') + (events[ds] ? ' has-event' : '') + '" data-bcal-date="' + ds + '">' + d + '</div>';
    }
    const box = $('#boardCal');
    if (!box) return;
    box.innerHTML = '<div class="cal-top bcal-top"><b>' + y + '年' + (m + 1) + '月</b>' +
      '<div class="cal-nav"><button type="button" data-bcal="-1" aria-label="上个月">‹</button>' +
      '<button type="button" data-bcal="today" aria-label="回到今天">今</button>' +
      '<button type="button" data-bcal="1" aria-label="下个月">›</button></div></div>' +
      '<div class="cal-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>' +
      '<div class="cal-grid bcal-grid">' + cells + '</div>';
  }

  function renderDesignerBoard() {
    const now = new Date();
    const todayStr = localDateStr(now);
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const cfg = boardConfig();
    if (cfg.board === false) return '';
    const cards = [];

    if (cfg.schedule) {
      const upcoming = sortedSchedule().filter((e) => !e.done && e.date >= todayStr).slice(0, 4);
      const eventsHtml = upcoming.length ? upcoming.map((e) => {
        const color = ({ '量房': '#4FC3F7', '方案': '#8A7CFF', '施工': '#F2B8B5', '客户': '#5FD3B4', '其他': '#9AA7B8' })[e.type] || '#9AA7B8';
        const isToday = e.date === todayStr;
        return '<div class="db-event"><span class="db-ev-time">' + esc(e.time || '全天') + '</span>' +
          '<span class="db-ev-main"><b>' + esc(e.title) + '</b><small>' + (isToday ? '今天' : scheduleDateLabel(e.date)) + (e.note ? ' · ' + esc(e.note) : '') + '</small></span>' +
          '<span class="db-ev-type" style="color:' + color + ';border-color:' + color + '33;background:' + color + '12">' + esc(e.type) + '</span></div>';
      }).join('') : '<div class="db-empty">还没有日程<br><span>在管理页「设计师日程」里添加</span></div>';
      cards.push('<div class="db-card db-schedule"><div class="db-head"><div><span class="db-kicker">DESIGNER DESK</span><h3>设计师日程</h3></div><button class="db-link" type="button" id="boardScheduleAll">全部日程 →</button></div>' +
        '<div class="db-date">' + now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · ' + week[now.getDay()] + '</div>' +
        '<div class="db-events">' + eventsHtml + '</div></div>');
    }
    if (cfg.weather) {
      cards.push('<div class="db-card db-weather"><div class="db-head"><div><span class="db-kicker">WEATHER</span><h3>天气</h3></div><button class="db-link" type="button" id="boardWeatherOpen">7 天 →</button></div>' +
        '<div id="boardWeather" class="db-weather-body"><div class="db-loading">天气加载中…</div></div></div>');
    }
    if (cfg.calendar) {
      cards.push('<div class="db-card db-cal"><div class="db-head"><div><span class="db-kicker">CALENDAR</span><h3>日历</h3></div><button class="db-link" type="button" id="boardCalendarOpen">打开 →</button></div><div id="boardCal"></div></div>');
    }
    if (cfg.fengshui) {
      cards.push('<div class="db-card db-fs"><div class="db-head"><div><span class="db-kicker">FENG SHUI</span><h3>风水参考</h3></div><button class="db-link" type="button" id="boardFsOpen">详细 →</button></div>' +
        '<p class="db-fs-tip">' + esc(fengShuiTip()) + '</p><div class="db-fs-note">传统民俗参考，居住舒适与安全优先</div></div>');
    }
    if (!cards.length) return '';
    return '<section class="designer-board" aria-label="设计师工作台">' + cards.join('') + '</section>';
  }

  async function loadBoardWeather() {
    const el = $('#boardWeather');
    if (!el) return;
    try {
      const city = LIFE_CITIES.filter((c) => c.name === lifeWeatherCity)[0] || LIFE_CITIES[0];
      const data = await fetchWeatherData(city.name);
      const daily = data.daily || {};
      const info = lifeWeatherInfo(daily.weather_code && daily.weather_code[0]);
      const max = Math.round((daily.temperature_2m_max || [])[0]);
      const min = Math.round((daily.temperature_2m_min || [])[0]);
      const times = daily.time || [];
      const codes = daily.weather_code || [];
      const maxs = daily.temperature_2m_max || [];
      const mins = daily.temperature_2m_min || [];
      const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      let days = '';
      for (let i = 0; i < Math.min(3, times.length); i++) {
        const dt = new Date(times[i] + 'T12:00:00');
        const w = lifeWeatherInfo(codes[i]);
        days += '<div class="db-w-day"><span>' + (i === 0 ? '今天' : week[dt.getDay()]) + '</span><b>' + w[1] + '</b><small>' + Math.round(maxs[i]) + '° / ' + Math.round(mins[i]) + '°</small></div>';
      }
      el.innerHTML = '<div class="db-w-now"><span class="db-w-emoji">' + info[1] + '</span><div class="db-w-main"><b>' + max + '°</b><span>' + info[0] + ' · ' + esc(city.name) + '</span></div><div class="db-w-range">最低 ' + min + '°</div></div>' +
        '<div class="db-w-days">' + days + '</div>';
    } catch (e) {
      el.innerHTML = '<div class="db-empty">天气暂时不可用<br><span>点右上角 7 天查看或稍后再试</span></div>';
    }
  }

  function bindDesignerBoard() {
    if (!$('.designer-board')) return;
    renderBoardCalendar();
    const all = $('#boardScheduleAll');
    if (all) all.addEventListener('click', () => openScheduleModal());
    const wo = $('#boardWeatherOpen');
    if (wo) wo.addEventListener('click', () => openLifeModal('weather'));
    const co = $('#boardCalendarOpen');
    if (co) co.addEventListener('click', () => openLifeModal('calendar'));
    const fo = $('#boardFsOpen');
    if (fo) fo.addEventListener('click', () => openLifeModal('fengshui'));
    const cal = $('#boardCal');
    if (cal) cal.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-bcal]');
      if (nav) {
        const v = nav.dataset.bcal;
        if (v === 'today') { const t = new Date(); boardCalState = { y: t.getFullYear(), m: t.getMonth() }; }
        else { boardCalState.m += Number(v); if (boardCalState.m < 0) { boardCalState.m = 11; boardCalState.y--; } if (boardCalState.m > 11) { boardCalState.m = 0; boardCalState.y++; } }
        renderBoardCalendar();
        return;
      }
      const cell = e.target.closest('[data-bcal-date]');
      if (cell) openScheduleModal(cell.dataset.bcalDate);
    });
    loadBoardWeather();
  }

  function renderHome() {
    const cats = sortedCategories();
    const links = state.lib.links;
    let i = 0;
    const tiles = cats.map((c) => {
      const own = links.filter((l) => l.categoryId === c.id);
      const cover = own.filter((l) => l.thumb)[0];
      const sites = [];
      own.forEach((l) => { const s = siteOf(l); if (sites.indexOf(s) < 0) sites.push(s); });
      const meta = c.system && !own.length ? '删除风格后，链接会集中到这里'
        : !own.length ? '暂无链接，点击添加'
        : sites.length <= 2 ? sites.join(' · ')
        : sites[0] + ' 等 ' + sites.length + ' 个来源';
      return '<button class="style-tile' + (c.system ? ' is-uncat' : '') + '" type="button" data-scope="' + esc(c.id) + '" style="--c:' + esc(c.color) + ';--d:' + Math.min(i++, 12) * 35 + 'ms" aria-label="查看 ' + esc(c.name) + '（' + own.length + ' 条）">' +
        '<span class="tile-media">' +
          '<span class="tile-fallback">' + esc(c.name.slice(0, 2)) + '</span>' +
          (cover ? '<img src="' + esc(cover.thumb) + '" alt="" loading="lazy" decoding="async">' : '') +
          '<span class="tile-overlay"></span>' +
          '<span class="tile-count">' + own.length + ' 条</span>' +
          '<span class="tile-caption"><span class="tile-name">' + esc(c.name) + '</span>' +
            '<span class="tile-meta">' + esc(meta) + '</span></span>' +
          '<span class="tile-arrow">' + ico('external') + '</span>' +
        '</span>' +
      '</button>';
    }).join('');
    const addTile = state.readOnly ? '' :
      '<button class="style-tile is-add" type="button" id="tileAddCat" style="--d:' + Math.min(i, 12) * 35 + 'ms" aria-label="新建风格">' +
      '<span class="add-inner"><span class="plus-ring">' + ico('plus') + '</span><span>新建风格分类</span></span></button>';
    const content = $('#content');
    content.innerHTML = renderDesignerBoard() + '<div class="style-grid">' + tiles + addTile + '</div>';
    bindImages(content);
    bindDesignerBoard();
    const addBtn = $('#tileAddCat');
    if (addBtn) addBtn.addEventListener('click', () => openCategoryForm(null));
  }

  function highlight(text) {
    const q = state.query.trim();
    const t = String(text == null ? '' : text);
    if (!q) return esc(t);
    const idx = t.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return esc(t);
    return esc(t.slice(0, idx)) + '<mark>' + esc(t.slice(idx, idx + q.length)) + '</mark>' + esc(t.slice(idx + q.length));
  }

  function cardHtml(link, delay) {
    const color = catColor(link.categoryId);
    const site = siteOf(link);
    const thumb = link.thumb ? esc(link.thumb) : '';
    const showCat = true;
    let status = '';
    if (link.status === 'warn') status = '<span class="status-pill warn"><i></i>待确认</span>';
    else if (link.status === 'fail') status = '<span class="status-pill fail"><i></i>打不开</span>';
    const title = link.title || ('未命名 · ' + site);
    const actions = '<button class="act-btn" type="button" data-act="open" title="在新标签打开">' + ico('external') + '</button>' +
      '<button class="act-btn" type="button" data-act="copy" title="复制链接">' + ico('copy') + '</button>' +
      (state.readOnly ? '' :
        '<button class="act-btn" type="button" data-act="edit" title="编辑">' + ico('edit') + '</button>' +
        '<button class="act-btn is-danger" type="button" data-act="del" title="删除">' + ico('trash') + '</button>');
    return '<article class="card" data-id="' + esc(link.id) + '" tabindex="0" role="link" aria-label="打开 ' + esc(title) + '" style="--d:' + delay + 'ms">' +
      '<div class="card-media">' +
        '<div class="card-fallback" style="--c:' + esc(color) + '"><div class="fallback-inner"><div class="fallback-site">' + esc(site) + '</div><div class="fallback-note">暂无预览图</div></div></div>' +
        (thumb ? '<img src="' + thumb + '" alt="" loading="lazy" decoding="async">' : '') +
        '<span class="media-vr">360°</span>' + status +
        '<div class="card-actions">' + actions + '</div>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="card-title" title="' + esc(title) + '">' + highlight(title) + '</div>' +
        '<div class="card-meta">' +
          (showCat ? '<span class="meta-cat" style="--c:' + esc(color) + '"><i></i>' + esc(catName(link.categoryId)) + '</span><span class="meta-sep">·</span>' : '') +
          '<span class="meta-site">' + esc(site) + '</span>' +
          (link.enrichState === 'loading' ? '<span class="card-state"><span class="spin"></span>获取预览</span>' : '') +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function rowHtml(link, delay) {
    const color = catColor(link.categoryId);
    const site = siteOf(link);
    const thumb = link.thumb ? esc(link.thumb) : '';
    const title = link.title || ('未命名 · ' + site);
    const actions = '<button class="row-btn" type="button" data-act="open" title="打开">' + ico('external') + '</button>' +
      '<button class="row-btn" type="button" data-act="copy" title="复制">' + ico('copy') + '</button>' +
      (state.readOnly ? '' :
        '<button class="row-btn" type="button" data-act="edit" title="编辑">' + ico('edit') + '</button>' +
        '<button class="row-btn is-danger" type="button" data-act="del" title="删除">' + ico('trash') + '</button>');
    return '<div class="link-row" data-id="' + esc(link.id) + '" tabindex="0" role="link" aria-label="打开 ' + esc(title) + '" style="--d:' + delay + 'ms">' +
      '<div class="row-thumb"><div class="card-fallback" style="--c:' + esc(color) + '"><div class="fallback-inner"><div class="fallback-site">' + esc(site) + '</div></div></div>' +
        (thumb ? '<img src="' + thumb + '" alt="" loading="lazy" decoding="async">' : '') + '</div>' +
      '<div class="row-main">' +
        '<div class="row-title" title="' + esc(title) + '">' + highlight(title) + '</div>' +
        '<div class="row-meta"><span class="meta-cat" style="--c:' + esc(color) + '"><i></i>' + esc(catName(link.categoryId)) + '</span><span class="meta-sep">·</span><span>' + esc(site) + '</span><span class="meta-sep">·</span><span>' + esc(fmtDate(link.addedAt)) + '</span></div>' +
      '</div>' +
      '<div class="row-side"><div class="row-actions">' + actions + '</div></div>' +
    '</div>';
  }

  function renderContent(animate) {
    const content = $('#content');
    if (!state.ready) {
      content.innerHTML = '<div class="skeleton-wrap">' + new Array(6).join('<div class="skeleton"></div>') + '</div>';
      return;
    }
    if (state.scope === 'home' && !state.query.trim()) {
      content.classList.remove('animate');
      renderHome();
      return;
    }
    const links = visibleLinks();
    content.classList.toggle('animate', !!animate && links.length > 0);

    if (!links.length) {
      content.innerHTML = emptyHtml();
      bindStaticInner();
      return;
    }
    const cls = state.view === 'list' ? 'list' : 'cards';
    let innerHtml = links.map((l, i) => (
      state.view === 'list' ? rowHtml(l, Math.min(i, 14) * 22) : cardHtml(l, Math.min(i, 14) * 26)
    )).join('');
    if (state.view === 'grid' && state.scope !== 'all' && state.scope !== 'home' && !state.readOnly) {
      innerHtml += '<button class="add-card" type="button" data-addcat="' + esc(state.scope) + '">' +
        '<span class="add-inner"><span class="plus-ring">' + ico('plus') + '</span><span>添加到此风格</span></span></button>';
    }
    content.innerHTML = '<div class="' + cls + '">' + innerHtml + '</div>';
    bindImages(content);
  }

  function emptyHtml() {
    if (state.query) {
      return '<div class="empty"><div class="empty-art">' + ico('search') + '</div>' +
        '<div class="empty-title">没有找到「' + esc(state.query) + '」</div>' +
        '<div class="empty-desc">试试其他关键词，或清空搜索查看全部效果图。</div>' +
        '<div class="empty-actions"><button class="btn" type="button" id="emptyClear">' + ico('close') + '清空搜索</button>' +
        (state.readOnly ? '' : '<button class="btn btn-primary" type="button" id="emptyAdd">' + ico('plus') + '添加链接</button>') + '</div></div>';
    }
    if (state.scope !== 'all' && state.scope !== 'home') {
      const c = catOf(state.scope);
      return '<div class="empty"><div class="empty-art">' + ico('camera') + '</div>' +
        '<div class="empty-title">「' + esc(c ? c.name : '') + '」还没有效果图</div>' +
        '<div class="empty-desc">' + (state.readOnly ? '这个风格下暂时没有内容。' : '把这条风格的效果图链接添加进来，之后可以随时编辑或删除。') + '</div>' +
        (state.readOnly ? '' : '<div class="empty-actions"><button class="btn btn-primary" type="button" id="emptyAdd">' + ico('plus') + '添加链接</button></div>') + '</div>';
    }
    if (state.readOnly) {
      return '<div class="empty"><div class="empty-art">' + ico('camera') + '</div>' +
        '<div class="empty-title">这个分享暂时没有内容</div>' +
        '<div class="empty-desc">等电脑端添加效果图后，刷新页面就能看到。</div></div>';
    }
    return '<div class="empty"><div class="empty-art">' + ico('camera') + '</div>' +
      '<div class="empty-title">开始建立你的效果图库</div>' +
      '<div class="empty-desc">添加第一条全景效果图链接，或从备份文件中导入已有数据。</div>' +
      '<div class="empty-actions"><button class="btn btn-primary" type="button" id="emptyAdd">' + ico('plus') + '添加链接</button>' +
      '<button class="btn" type="button" id="emptyImport">' + ico('upload') + '导入备份</button></div></div>';
  }

  function bindStaticInner() {
    const add = $('#emptyAdd');
    if (add) add.addEventListener('click', () => openForm('add'));
    const imp = $('#emptyImport');
    if (imp) imp.addEventListener('click', () => $('#importFile').click());
    const clr = $('#emptyClear');
    if (clr) clr.addEventListener('click', clearSearch);
  }

  function bindImages(root) {
    $$('img', root).forEach((img) => {
      if (img.complete && img.naturalWidth) img.classList.add('is-loaded');
      else img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
      img.addEventListener('error', () => { img.style.display = 'none'; }, { once: true });
    });
    bindStaticInner();
  }

  function renderAll(animate) {
    document.body.classList.toggle('is-readonly', !!state.readOnly);
    renderSidebar();
    renderHead();
    renderContent(animate);
    updateModeChip();
  }

  function updateModeChip() {
    const chip = $('#modeChip');
    const text = $('#modeText');
    if (!chip || !text) return;
    const isApi = state.mode === 'api';
    const isPublic = state.mode === 'public';
    chip.classList.toggle('is-api', isApi || isPublic);
    text.textContent = isPublic ? '公开分享 · 只读' : isApi ? '共享存储 · 已连接' : '本地模式 · 浏览器保存';
    chip.title = isPublic
      ? '这是公开分享版，任何人打开链接都能看，但不能修改；点右上角手机图标可复制链接'
      : isApi
        ? '数据保存在 C:\\效果图网址\\data\\library.json，Edge / Chrome / 百度浏览器共用同一份数据'
        : '直接打开网页时为浏览器本地保存；双击桌面「效果图网址」快捷方式可使用共享存储';
    const save = $('#saveState');
    if (save && isPublic) save.textContent = '只读浏览';
    const phoneBtn = $('#phoneBtn');
    if (phoneBtn) {
      phoneBtn.title = isPublic ? '分享此页面' : '手机 / 微信访问';
      phoneBtn.setAttribute('aria-label', isPublic ? '分享此页面' : '手机 / 微信访问');
      const use = phoneBtn.querySelector('use');
      if (use) use.setAttribute('href', isPublic ? '#i-qr' : '#i-phone');
    }
  }

  /* ---------------------------------------------------------------- 操作 */
  function findLink(id) {
    return state.lib.links.filter((l) => l.id === id)[0] || null;
  }

  function isTouchDevice() {
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Windows Phone|HarmonyOS|MicroMessenger|Mobile/i.test(ua)
      || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
  }

  function openLink(link) {
    if (!link) return;
    const risk = window.YXGLinkSafety ? YXGLinkSafety.check(link.url) : { level: 'safe', reason: '' };
    if (risk.level === 'danger') {
      if (window.YXGSecurity) YXGSecurity.log('bad_url', 'blocked open ' + risk.reason + ' ' + link.url);
      toast('安全提示：该链接未通过安全检查，已阻止打开', { duration: 3200 });
      return;
    }
    if (risk.level === 'warn' && window.YXGSecurity) {
      YXGSecurity.log('warn_url', risk.reason + ' ' + link.url);
    }
    // 手机 / 微信内置浏览器里，用当前窗口打开最可靠（可返回继续浏览）
    if (isTouchDevice()) { window.location.href = link.url; return; }

    const a = document.createElement('a');
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fallback */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-200px;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  async function actCopy(link) {
    const ok = await copyText(link.url);
    toast(ok ? '链接已复制到剪贴板' : '复制失败，请手动选择链接', ok ? {} : { type: 'warn' });
  }

  async function actDelete(link) {
    if (state.readOnly) { toast('公开分享版为只读，不能删除', { type: 'warn' }); return; }
    const yes = await confirmDialog({
      title: '删除这条效果图？',
      desc: '「' + (link.title || link.url) + '」',
      detail: '删除后可通过「数据 → 导入备份」或撤销找回。',
      confirmText: '删除',
      danger: true
    });
    if (!yes) return;
    const idx = state.lib.links.findIndex((l) => l.id === link.id);
    if (idx < 0) return;
    const removed = state.lib.links.splice(idx, 1)[0];
    if (state.lib.tombstones.indexOf(removed.url) < 0) state.lib.tombstones.push(removed.url);
    await saveLibrary();
    renderAll();
    toast('已删除', {
      action: {
        label: '撤销',
        onClick: async () => {
          state.lib.links.splice(idx, 0, removed);
          const t = state.lib.tombstones.indexOf(removed.url);
          if (t >= 0) state.lib.tombstones.splice(t, 1);
          await saveLibrary();
          renderAll();
          toast('已恢复');
        }
      },
      duration: 5200
    });
  }

  /* ---------------------------------------------------------------- 表单 */
  function openForm(mode, link, presetCat) {
    if (state.readOnly) { toast('公开分享版为只读，不能修改内容', { type: 'warn' }); return; }
    const isEdit = mode === 'edit' && link;
    const cats = sortedCategories();
    const defaultCat = (isEdit && link.categoryId) || presetCat || (state.scope !== 'all' && state.scope !== 'home' ? state.scope : cats[0].id);
    const options = cats.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === defaultCat ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
    const title = isEdit ? '编辑效果图' : '添加效果图链接';
    const desc = isEdit ? '修改标题、风格或链接地址。' : '粘贴全景效果图的网址，选择所属风格即可归档。';

    const body = '' +
      '<div class="field">' +
        '<label class="field-label" for="fUrl">链接地址<span class="req">*</span><span class="hint">支持 http / https</span></label>' +
        '<input class="input" id="fUrl" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://vr.justeasy.cn/view/…" value="' + esc(isEdit ? link.url : '') + '">' +
        '<div class="field-msg" id="urlMsg"></div>' +
      '</div>' +
      '<div class="form-grid">' +
        '<div class="field">' +
          '<label class="field-label" for="fTitle">标题</label>' +
          '<input class="input" id="fTitle" type="text" maxlength="60" autocomplete="off" placeholder="例如：源质 · 现代客厅" value="' + esc(isEdit ? link.title : '') + '">' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label" for="fCat">风格分类</label>' +
          '<div style="display:flex;gap:6px">' +
            '<div class="select-wrap" style="flex:1"><select id="fCat" class="input" style="height:42px;padding-right:32px">' + options + '</select>' + ico('chevron', 'select-ico') + '</div>' +
            '<button class="btn btn-sm" type="button" id="fNewCat" title="新建风格分类" style="height:42px;padding:0 11px">' + ico('plus') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="field">' +
        '<label class="field-label" for="fNote">备注 <span class="hint">可选</span></label>' +
        '<textarea class="textarea" id="fNote" maxlength="200" placeholder="记录空间、面积、设计师等信息…">' + esc(isEdit ? link.note : '') + '</textarea>' +
      '</div>' +
      '<div class="form-tip" id="formTip">' + ico('info') + '<span>' + (state.mode === 'api'
        ? '保存后将自动抓取网页标题与预览图（需要联网，稍等片刻）。'
        : '当前为本地模式，不会自动抓取预览图；可通过桌面快捷方式启动以获得完整功能。') + '</span></div>';

    const modal = openModal({
      title: title,
      desc: desc,
      size: 'md',
      body: body,
      footer: '<button class="btn" type="button" data-close>取消</button><button class="btn btn-primary" type="button" id="fSave">' + (isEdit ? '保存修改' : '添加链接') + '</button>'
    });

    const urlEl = $('#fUrl', modal.el);
    const titleEl = $('#fTitle', modal.el);
    const catEl = $('#fCat', modal.el);
    const noteEl = $('#fNote', modal.el);
    const urlMsg = $('#urlMsg', modal.el);

    function showUrlError(msg, warn) {
      urlMsg.textContent = msg;
      urlMsg.classList.toggle('is-show', !!msg);
      urlMsg.classList.toggle('is-warn', !!warn);
      urlEl.classList.toggle('is-error', !!msg && !warn);
    }

    urlEl.addEventListener('input', () => showUrlError(''));
    setTimeout(() => { urlEl.focus(); if (isEdit) urlEl.setSelectionRange(urlEl.value.length, urlEl.value.length); }, 60);

    $('#fNewCat', modal.el).addEventListener('click', async () => {
      const created = await openCategoryForm(null);
      if (created) {
        const opts = sortedCategories().map((c) => '<option value="' + esc(c.id) + '"' + (c.id === created.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
        catEl.innerHTML = opts;
      }
    });

    $('#fSave', modal.el).addEventListener('click', async () => {
      let url = urlEl.value.trim();
      if (!url) { showUrlError('请先粘贴效果图链接'); urlEl.focus(); return; }
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) url = 'https://' + url;
      let parsed = null;
      try { parsed = new URL(url); } catch (e) { parsed = null; }
      if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname || /\s/.test(url)) {
        showUrlError('链接格式不正确，请检查后重试');
        urlEl.focus();
        return;
      }
      url = parsed.href;
      const dup = state.lib.links.filter((l) => l.url === url && (!isEdit || l.id !== link.id))[0];
      if (dup) {
        showUrlError('这条链接已存在于「' + catName(dup.categoryId) + '」中', true);
        return;
      }
      const cid = catEl.value || state.lib.categories[0].id;
      const t = titleEl.value.trim();
      const note = noteEl.value.trim();
      if (isEdit) {
        const urlChanged = link.url !== url;
        link.url = url;
        link.title = t;
        link.note = note;
        link.categoryId = cid;
        link.source = parsed.hostname.toLowerCase();
        link.site = SITES[link.source] || '';
        if (urlChanged) { link.thumb = ''; link.status = 'unknown'; link.statusCheckedAt = ''; }
      } else {
        const maxOrder = state.lib.links.reduce((m, l) => Math.max(m, l.order || 0), 0);
        const nl = {
          id: uid('l'), categoryId: cid, url: url, title: t, note: note, thumb: '',
          source: parsed.hostname.toLowerCase(), site: SITES[parsed.hostname.toLowerCase()] || '',
          status: 'unknown', statusCheckedAt: '', addedAt: new Date().toISOString(), order: maxOrder + 1
        };
        state.lib.links.unshift(nl);
        state.lib.tombstones = state.lib.tombstones.filter((u) => u !== url);
        link = nl;
      }
      modal.close();
      await saveLibrary();
      if (state.scope !== cid) state.scope = cid;
      renderAll(true);
      scrollMainTop();
      toast(isEdit ? '修改已保存' : '已添加「' + (link.title || '未命名链接') + '」');
      if (state.mode === 'api' && (!isEdit || !link.thumb)) enrichLink(link);
    });
  }

  async function enrichLink(link) {
    if (state.mode !== 'api' || !api.avail) return;
    if (link.enrichState === 'loading') return;
    link.enrichState = 'loading';
    renderContent(false);
    try {
      const j = await api.call('api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link.url }),
        timeout: 15000
      });
      if (j && j.ok) {
        if (j.title && !link.title) link.title = String(j.title).slice(0, 80);
        if (j.thumb) link.thumb = sanitizeThumb(j.thumb) || link.thumb;
        if (j.site) link.site = String(j.site).slice(0, 40);
        link.status = j.status === 'warn' ? 'warn' : 'ok';
        link.statusCheckedAt = new Date().toISOString();
        if (j.note) link.note = link.note || j.note;
      } else {
        link.status = link.thumb ? 'ok' : 'warn';
        link.note = link.note || '未能自动抓取预览，可手动确认该链接';
      }
    } catch (e) {
      link.status = 'warn';
      link.note = link.note || '预览抓取超时，稍后可在「数据体检」中重试';
    }
    link.enrichState = '';
    await saveLibrary();
    renderAll(false);
  }

  /* ---------------------------------------------------------------- 分类 */
  function openCategoryForm(existing) {
    return new Promise((resolve) => {
      if (state.readOnly) { toast('公开分享版为只读', { type: 'warn' }); resolve(null); return; }
      const isEdit = !!existing;
      const curr = existing || { name: '', color: PALETTE[state.lib.categories.length % PALETTE.length] };
      let picked = curr.color || PALETTE[0];
      const swatches = PALETTE.map((c) => '<button type="button" class="swatch' + (c.toLowerCase() === String(picked).toLowerCase() ? ' is-active' : '') + '" data-color="' + c + '" style="--c:' + c + '" aria-label="颜色 ' + c + '">' + ico('check') + '</button>').join('');
      const body = '' +
        '<div class="field">' +
          '<label class="field-label" for="catName">风格名称<span class="req">*</span><span class="hint">最多 12 个字</span></label>' +
          '<input class="input" id="catName" type="text" maxlength="24" autocomplete="off" placeholder="例如：法式复古、日式原木…" value="' + esc(curr.name) + '">' +
          '<div class="field-msg" id="catMsg"></div>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label">标记颜色</label>' +
          '<div class="swatches" id="catColors">' + swatches + '</div>' +
        '</div>' +
        (isEdit && !curr.system ? '<div class="form-tip is-warn">' + ico('alert') + '<span>删除后，其下的 ' + state.lib.links.filter((l) => l.categoryId === curr.id).length + ' 条链接会移到「待分类」，不会删除。</span></div>' : '');
      const modal = openModal({
        title: isEdit ? '编辑风格' : '新建风格',
        desc: isEdit ? '修改名称或标记颜色。' : '新建一种装修风格，之后添加链接时即可选择。',
        size: 'sm',
        body: body,
        footer: (isEdit && !curr.system ? '<button class="btn btn-ghost" type="button" id="catDel" style="margin-right:auto;color:#ff8ea0">删除风格</button>' : '') +
          '<button class="btn" type="button" data-close>取消</button><button class="btn btn-primary" type="button" id="catSave">保存</button>',
        onClose: () => resolve(null)
      });

      const nameEl = $('#catName', modal.el);
      const msg = $('#catMsg', modal.el);
      setTimeout(() => { nameEl.focus(); nameEl.select(); }, 60);
      nameEl.addEventListener('input', () => { msg.classList.remove('is-show'); nameEl.classList.remove('is-error'); });

      $$('#catColors .swatch', modal.el).forEach((btn) => {
        btn.addEventListener('click', () => {
          picked = btn.dataset.color;
          $$('#catColors .swatch', modal.el).forEach((b) => b.classList.toggle('is-active', b === btn));
        });
      });

      $('#catSave', modal.el).addEventListener('click', async () => {
        const name = nameEl.value.trim();
        if (!name) { msg.textContent = '请填写风格名称'; msg.classList.add('is-show'); nameEl.classList.add('is-error'); return; }
        if (name === '待分类') { msg.textContent = '「待分类」是系统分类，请换一个名称'; msg.classList.add('is-show'); nameEl.classList.add('is-error'); return; }
        if (name.length > 12) { msg.textContent = '名称建议不超过 12 个字'; }
        const dup = state.lib.categories.filter((c) => c.name === name && (!isEdit || c.id !== curr.id))[0];
        if (dup) { msg.textContent = '已存在同名风格'; msg.classList.add('is-show'); nameEl.classList.add('is-error'); return; }
        let result;
        if (isEdit) {
          curr.name = name;
          curr.color = picked;
          result = curr;
        } else {
          result = { id: uid('c'), name: name, color: picked, order: state.lib.categories.length };
          state.lib.categories.push(result);
        }
        await saveLibrary();
        modal.close(true);
        renderAll();
        toast(isEdit ? '风格已更新' : '已创建风格「' + name + '」');
        resolve(result);
      });

      const delBtn = $('#catDel', modal.el);
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          if (curr.system) { toast('「待分类」是系统分类，不能删除', { type: 'warn' }); return; }
          if (state.lib.categories.filter((c) => !c.system).length <= 1) { toast('至少保留一个风格分类', { type: 'warn' }); return; }
          const n = state.lib.links.filter((l) => l.categoryId === curr.id).length;
          const yes = await confirmDialog({
            title: '删除风格「' + curr.name + '」？',
            desc: n ? '删除后，里面的 ' + n + ' 条效果图会移到「待分类」，不会删除。' : '该风格下暂无效果图。',
            confirmText: '删除风格',
            danger: true
          });
          if (!yes) return;
          ensureUncat();
          state.lib.links.filter((l) => l.categoryId === curr.id).forEach((l) => {
            l.categoryId = 'uncategorized';
            l.pendingStyle = curr.name;
          });
          state.lib.categories = state.lib.categories.filter((c) => c.id !== curr.id);
          if (state.scope === curr.id) state.scope = 'home';
          await saveLibrary();
          modal.close(true);
          renderAll();
          toast('风格已删除；' + n + ' 条链接已移到待分类');
          resolve(null);
        });
      }
    });
  }

  function openCatMenu(anchor, catId) {
    if (state.readOnly) return;
    const cat = catOf(catId);
    if (!cat) return;
    if (cat.system) { toast('「待分类」是系统分类，不能编辑或删除', { type: 'warn' }); return; }
    openMenu(anchor, [
      { icon: 'edit', label: '编辑风格', onClick: () => openCategoryForm(cat) },
      { icon: 'trash', label: '删除风格', danger: true, onClick: async () => {
          if (state.lib.categories.filter((c) => !c.system).length <= 1) { toast('至少保留一个风格分类', { type: 'warn' }); return; }
          const n = state.lib.links.filter((l) => l.categoryId === catId).length;
          const yes = await confirmDialog({
            title: '删除风格「' + cat.name + '」？',
            desc: n ? '删除后，里面的 ' + n + ' 条效果图会移到「待分类」，不会删除。' : '该风格下暂无效果图。',
            confirmText: '删除风格',
            danger: true
          });
          if (!yes) return;
          ensureUncat();
          state.lib.links.filter((l) => l.categoryId === catId).forEach((l) => {
            l.categoryId = 'uncategorized';
            l.pendingStyle = cat.name;
          });
          state.lib.categories = state.lib.categories.filter((c) => c.id !== catId);
          if (state.scope === catId) state.scope = 'home';
          await saveLibrary();
          renderAll();
          toast('风格已删除；' + n + ' 条链接已移到待分类');
        } }
    ]);
  }

  /* ---------------------------------------------------------------- 弹窗 */
  const modalStack = [];
  let lastFocus = null;

  function openModal(opts) {
    lastFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal ' + (opts.size ? 'is-' + opts.size : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '">' +
        '<div class="modal-head">' +
          '<div class="modal-heading"><div class="modal-title">' + esc(opts.title) + '</div>' +
          (opts.desc ? '<div class="modal-desc">' + opts.desc + '</div>' : '') + '</div>' +
          '<button class="modal-close" type="button" aria-label="关闭">' + ico('close') + '</button>' +
        '</div>' +
        '<div class="modal-body"></div>' +
        (opts.footer ? '<div class="modal-foot">' + opts.footer + '</div>' : '') +
      '</div>';
    const bodyEl = $('.modal-body', overlay);
    if (typeof opts.body === 'string') bodyEl.innerHTML = opts.body;
    else if (opts.body) bodyEl.appendChild(opts.body);
    document.getElementById('modalRoot').appendChild(overlay);

    const handle = {
      el: overlay,
      closed: false,
      close: (skipResolve) => {
        if (handle.closed) return;
        handle.closed = true;
        document.removeEventListener('keydown', escClose);
        overlay.style.animation = 'fadeIn .16s reverse';
        setTimeout(() => {
          overlay.remove();
          const i = modalStack.indexOf(handle);
          if (i >= 0) modalStack.splice(i, 1);
          if (lastFocus && document.contains(lastFocus) && !modalStack.length) {
            try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
          }
        }, 150);
        if (typeof opts.onClose === 'function' && !skipResolve) opts.onClose();
      }
    };
    modalStack.push(handle);

    $('.modal-close', overlay).addEventListener('click', () => handle.close());
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) handle.close(); });
    overlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = $$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', overlay)
        .filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $$('[data-close]', overlay).forEach((b) => b.addEventListener('click', () => handle.close()));

    document.addEventListener('keydown', escClose);
    function escClose(e) {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === handle) {
        e.preventDefault();
        handle.close();
        document.removeEventListener('keydown', escClose);
      }
    }
    return handle;
  }

  function confirmDialog(opts) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      const modal = openModal({
        title: opts.title,
        desc: opts.desc ? esc(opts.desc) : '',
        size: 'sm',
        body: '<div style="font-size:13px;color:var(--text-2);line-height:1.75">' + (opts.detail || '此操作无法通过界面撤销。') + '</div>',
        footer: '<button class="btn" type="button" data-close>取消</button>' +
          '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" type="button" id="confirmOk">' + esc(opts.confirmText || '确定') + '</button>',
        onClose: () => finish(false)
      });
      $('#confirmOk', modal.el).addEventListener('click', () => { finish(true); modal.close(true); });
    });
  }

  /* ---------------------------------------------------------------- 菜单 */
  let menuEl = null;
  function closeMenu() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
    document.removeEventListener('mousedown', outside, true);
    document.removeEventListener('keydown', escMenu, true);
  }
  function outside(e) {
    if (menuEl && !menuEl.contains(e.target)) closeMenu();
  }
  function escMenu(e) { if (e.key === 'Escape') closeMenu(); }

  function openMenu(anchor, items) {
    closeMenu();
    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.innerHTML = items.map((it) => {
      if (it === '-') return '<div class="menu-sep"></div>';
      if (it.head) return '<div class="menu-head">' + esc(it.head) + '</div>';
      return '<button class="menu-item' + (it.danger ? ' is-danger' : '') + '" type="button">' + ico(it.icon || 'link') + '<span>' + esc(it.label) + '</span></button>';
    }).join('');
    document.getElementById('menuRoot').appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let left = rect.right - mw;
    let top = rect.bottom + 8;
    if (top + mh > window.innerHeight - 10) top = rect.top - mh - 8;
    menu.style.left = clamp(left, 10, window.innerWidth - mw - 10) + 'px';
    menu.style.top = clamp(top, 10, window.innerHeight - mh - 10) + 'px';
    const btns = $$('.menu-item', menu);
    const real = items.filter((it) => it !== '-' && !it.head);
    btns.forEach((b, i) => b.addEventListener('click', () => {
      const it = real[i];
      closeMenu();
      if (it && it.onClick) it.onClick();
    }));
    menuEl = menu;
    setTimeout(() => {
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', escMenu, true);
    }, 0);
  }

  /* ---------------------------------------------------------------- 手机访问 */
  function drawQr(el, url) {
    if (!el) return;
    el.innerHTML = '';
    if (!window.QRCode) {
      el.innerHTML = '<div class="qr-fail">二维码组件未加载<br>请手动输入地址</div>';
      return;
    }
    try {
      new QRCode(el, {
        text: url,
        width: 196,
        height: 196,
        colorDark: '#0b0e14',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      el.innerHTML = '<div class="qr-fail">二维码生成失败<br>请手动输入地址</div>';
    }
  }

  async function openPhoneModal() {
    if (state.readOnly) {
      const url = location.origin + '/';
      const mobile = isTouchDevice();
      const body = '<div class="phone-wrap is-mobile">' +
        (mobile ? '' : '<div class="qr-card"><div id="publicQr" class="qr-box"></div></div>') +
        '<div class="phone-info">' +
          '<div class="phone-url-row"><code id="publicUrl">' + esc(url) + '</code><button class="btn btn-sm" type="button" id="publicCopy">' + ico('copy') + '复制</button></div>' +
          '<div class="phone-mobile-tip">' + ico('check') + ' 这是公开分享版：把链接发给朋友，任何人打开都能看。' +
            (mobile ? ' 点微信右上角「···」可以发送给朋友。' : '') + '</div>' +
          '<div class="phone-note">内容由电脑端维护，访客只能浏览，不能修改。链接在电脑开机且程序运行时有效。</div>' +
        '</div></div>';
      const modal = openModal({
        title: '分享这个页面',
        desc: '公开只读链接，发给任何人都能打开。',
        size: 'sm',
        body: body,
        footer: '<button class="btn" type="button" data-close>关闭</button>'
      });
      if (!mobile) drawQr($('#publicQr', modal.el), url);
      const copyBtn = $('#publicCopy', modal.el);
      if (copyBtn) copyBtn.addEventListener('click', async () => {
        const ok = await copyText(url);
        toast(ok ? '分享链接已复制' : '复制失败，请长按链接复制', ok ? {} : { type: 'warn' });
      });
      return;
    }

    if (state.mode !== 'api') {
      openModal({
        title: '手机 / 微信访问',
        desc: '需要用桌面快捷方式启动后才能让手机访问。',
        size: 'sm',
        body: '<div class="phone-tip-box">' + ico('info') +
          '<span>当前是「本地模式」，页面只存在于这个浏览器里，手机无法访问。<br><br>请关闭这个页面，双击桌面上的 <b>效果图网址</b> 图标重新打开，再点右上角手机图标即可看到二维码。</span></div>',
        footer: '<button class="btn btn-primary" type="button" data-close>知道了</button>'
      });
      return;
    }

    let net = null;
    try { net = await api.call('api/network', { timeout: 5000 }); } catch (e) { net = null; }

    const isLoopback = location.hostname === '127.0.0.1' || location.hostname === 'localhost' || location.hostname === '::1';
    const urls = [];
    if (!isLoopback) urls.push(location.protocol + '//' + location.host + '/');
    if (net && Array.isArray(net.addresses)) {
      net.addresses.forEach((ip) => urls.push('http://' + ip + ':' + net.port + '/'));
    }
    const unique = [];
    urls.forEach((u) => { if (u && unique.indexOf(u) < 0) unique.push(u); });

    if (!unique.length) {
      openModal({
        title: '手机 / 微信访问',
        desc: '没有找到可用的局域网地址。',
        size: 'sm',
        body: '<div class="phone-tip-box">' + ico('alert') +
          '<span>电脑似乎没有连接到 Wi-Fi 或网线。请先连接网络，再重新打开本页面。</span></div>',
        footer: '<button class="btn" type="button" data-close>关闭</button>'
      });
      return;
    }

    let current = unique[0];
    const showQr = isLoopback;
    const steps = showQr
      ? '<ol class="phone-steps">' +
          '<li><b>同一 Wi-Fi</b>：手机和电脑连接同一个无线网络</li>' +
          '<li><b>微信扫一扫</b>：扫描左侧二维码，直接在微信里打开</li>' +
          '<li><b>手机浏览器</b>：输入上方地址也能打开</li>' +
        '</ol>'
      : '<ol class="phone-steps">' +
          '<li><b>同一 Wi-Fi</b>：电脑需要保持开机，手机与电脑在同一个无线网络</li>' +
          '<li><b>发给好友</b>：复制上面的地址，在微信里粘贴发送即可</li>' +
          '<li><b>增删链接</b>：点右上角的「+」添加，卡片上可编辑 / 删除</li>' +
        '</ol>';
    const body = '' +
      '<div class="phone-wrap' + (showQr ? '' : ' is-mobile') + '">' +
        (showQr ? '<div class="qr-card"><div id="qrBox" class="qr-box"></div></div>' : '') +
        '<div class="phone-info">' +
          '<div class="phone-url-row"><code id="phoneUrl"></code><button class="btn btn-sm" type="button" id="phoneCopy">' + ico('copy') + '复制</button></div>' +
          steps +
          '<div class="phone-note">同类设备（手机、平板）都可访问，请勿在公司/公共 Wi-Fi 下长期开放；看完可以在电脑上关闭程序。</div>' +
          (isLoopback
            ? '<div class="phone-fw"><button class="btn btn-sm" type="button" id="phoneFw">手机打不开？点此放行防火墙</button><span>会弹出 Windows 权限确认</span></div>' +
              '<div class="share-entry-wrap"><button class="btn btn-sm" type="button" id="phonePublicShare">' + ico('globe') + '要让外地朋友也能看？生成公网链接</button></div>'
            : '<div class="phone-mobile-tip">' + ico('check') + ' 你正在手机上访问。点微信右上角「···」可以发送给朋友，或继续浏览。</div>') +
          '<div class="phone-alt" id="phoneAlt"></div>' +
        '</div>' +
      '</div>';

    const modal = openModal({
      title: '手机 / 微信访问',
      desc: showQr ? '不用装 App：手机和电脑连同一个 Wi-Fi，扫码即可打开同一个效果图库。' : '你正在手机上浏览同一个效果图库。',
      size: 'md',
      body: body,
      footer: '<button class="btn" type="button" data-close>关闭</button>'
    });

    function paint(url) {
      current = url;
      const code = $('#phoneUrl', modal.el);
      if (code) code.textContent = url;
      drawQr($('#qrBox', modal.el), url);
    }
    paint(current);

    const alt = $('#phoneAlt', modal.el);
    if (alt && unique.length > 1) {
      alt.innerHTML = '<span>其他地址：</span>' + unique.map((u) => (
        '<button type="button" class="addr-chip' + (u === current ? ' is-active' : '') + '" data-url="' + esc(u) + '">' + esc(u.replace('http://', '').replace(/\/$/, '')) + '</button>'
      )).join('');
      $$('.addr-chip', alt).forEach((b) => b.addEventListener('click', () => {
        $$('.addr-chip', alt).forEach((x) => x.classList.toggle('is-active', x === b));
        paint(b.dataset.url);
      }));
    }

    const copyBtn = $('#phoneCopy', modal.el);
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      const ok = await copyText(current);
      toast(ok ? '访问地址已复制' : '复制失败，请手动选择地址', ok ? {} : { type: 'warn' });
    });

    const pubBtn = $('#phonePublicShare', modal.el);
    if (pubBtn) pubBtn.addEventListener('click', () => {
      modal.close();
      openPublicShare();
    });

    const fw = $('#phoneFw', modal.el);
    if (fw) fw.addEventListener('click', async () => {
      fw.disabled = true;
      fw.textContent = '正在请求…';
      try {
        const j = await api.call('api/firewall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          timeout: 10000
        });
        toast((j && j.message) || '已请求放行，请在电脑上确认 Windows 弹窗', { duration: 6000 });
      } catch (e) {
        toast('放行失败：可以在 data 文件夹里右键“允许手机访问”脚本，以管理员身份运行', { type: 'err', duration: 7000 });
      }
      fw.disabled = false;
      fw.textContent = '手机打不开？点此放行防火墙';
    });
  }

  const PERMANENT_URL = 'https://togetherggg.github.io/yingxiangtu/';

  function openPermanentSite() {
    if (isTouchDevice()) { window.location.href = PERMANENT_URL; return; }
    const a = document.createElement('a');
    a.href = PERMANENT_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------------------------------------------------------------- 公网分享 */
  async function openPublicShare() {
    if (state.readOnly) { openPhoneModal(); return; }
    if (state.mode !== 'api') {
      openModal({
        title: '公网分享',
        desc: '需要先用桌面快捷方式启动。',
        size: 'sm',
        body: '<div class="phone-tip-box">' + ico('info') +
          '<span>公网分享依赖本机的数据服务。请双击桌面「效果图网址」快捷方式重新打开，再在「数据 → 公网分享」里生成链接。</span></div>',
        footer: '<button class="btn" type="button" data-close>知道了</button>'
      });
      return;
    }

    let st = null;
    try { st = await api.call('api/public/status', { timeout: 6000 }); } catch (e) { st = null; }

    const modal = openModal({
      title: '公网分享',
      desc: '生成一个 HTTPS 链接，发给任何人、在任何地方都能打开；访客只能浏览。',
      size: 'md',
      body: '<div id="publicShareBody"></div>',
      footer: '<button class="btn" type="button" data-close>关闭</button>'
    });
    const host = $('#publicShareBody', modal.el);

    function idle(msg) {
      host.innerHTML =
        '<div class="share-hero">' +
          '<div class="share-hero-icon">' + ico('globe') + '</div>' +
          '<div class="share-hero-title">把效果图库分享到公网</div>' +
          '<p class="share-hero-desc">发给客户、朋友或微信群，点开链接就能看。访客只能浏览，不能添加、删除或修改你的内容。</p>' +
          '<button class="btn btn-primary" type="button" id="publicStart">' + ico('globe') + '生成公网链接</button>' +
          (msg ? '<div class="share-error">' + esc(msg) + '</div>' : '') +
          '<div class="share-note">需要电脑保持开机、程序保持运行；免费隧道地址在重启后会变化，需要重新分享。</div>' +
        '</div>';
      const btn = $('#publicStart', host);
      if (btn) btn.addEventListener('click', start);
    }

    function active(s) {
      const url = s.url;
      host.innerHTML =
        '<div class="share-live"><i></i>公网链接运行中</div>' +
        '<div class="phone-wrap">' +
          '<div class="qr-card"><div id="publicQr" class="qr-box"></div></div>' +
          '<div class="phone-info">' +
            '<div class="phone-url-row"><code id="publicUrl">' + esc(url) + '</code><button class="btn btn-sm" type="button" id="publicCopy">' + ico('copy') + '复制</button></div>' +
            '<div class="share-actions">' +
              '<a class="btn btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">打开链接</a>' +
              '<button class="btn btn-sm btn-ghost" type="button" id="publicRefresh">刷新状态</button>' +
              '<button class="btn btn-sm btn-ghost" type="button" id="publicStop">停止分享</button>' +
            '</div>' +
            '<ol class="phone-steps">' +
              '<li><b>发微信</b>：复制链接直接发给朋友，或让对方扫二维码</li>' +
              '<li><b>只读</b>：访客只能浏览，不能修改内容</li>' +
              '<li><b>更新</b>：你在电脑上改完，访客刷新页面即可看到</li>' +
            '</ol>' +
            '<div class="phone-note">链接在电脑开机且程序运行期间有效；免费隧道重启后地址会变化，需要重新分享。</div>' +
          '</div>' +
        '</div>';
      drawQr($('#publicQr', host), url);
      const copyBtn = $('#publicCopy', host);
      if (copyBtn) copyBtn.addEventListener('click', async () => {
        const ok = await copyText(url);
        toast(ok ? '公网链接已复制' : '复制失败，请长按链接复制', ok ? {} : { type: 'warn' });
      });
      const stopBtn = $('#publicStop', host);
      if (stopBtn) stopBtn.addEventListener('click', stop);
      const refreshBtn = $('#publicRefresh', host);
      if (refreshBtn) refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        try {
          const s2 = await api.call('api/public/status', { timeout: 6000 });
          paint(s2);
        } catch (e) { idle('获取状态失败，请稍后重试'); }
      });
    }

    function paint(s) {
      if (s && s.active && s.url) active(s);
      else idle(s && s.error ? s.error : '');
    }

    async function start() {
      host.innerHTML = '<div class="share-loading"><span class="spin"></span><span>正在建立公网隧道，通常需要 5~20 秒…</span></div>';
      try {
        const res = await api.call('api/public/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          timeout: 45000
        });
        if (!res || !res.ok) { idle((res && res.error) || '生成失败，请稍后重试'); return; }
        paint(res);
        toast('公网链接已生成，可以发微信了', { duration: 4200 });
      } catch (e) {
        idle('请求超时或网络不可用，请检查网络后重试');
      }
    }

    async function stop() {
      try {
        await api.call('api/public/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          timeout: 10000
        });
      } catch (e) { /* ignore */ }
      idle('已停止公网分享');
      toast('已停止公网分享');
    }

    paint(st);
  }

  /* ---------------------------------------------------------------- Toast */
  function toast(msg, opts) {
    opts = opts || {};
    const host = $('#toasts');
    const el = document.createElement('div');
    const type = opts.type || 'ok';
    el.className = 'toast ' + (type === 'ok' ? '' : type);
    el.innerHTML = '<span class="toast-mark">' + ico(type === 'ok' ? 'check' : 'alert') + '</span><span class="toast-msg"></span>';
    $('.toast-msg', el).textContent = msg;
    if (opts.action) {
      const b = document.createElement('button');
      b.className = 'toast-action';
      b.type = 'button';
      b.textContent = opts.action.label;
      b.addEventListener('click', () => { dismiss(); opts.action.onClick(); });
      el.appendChild(b);
    }
    host.appendChild(el);
    while (host.children.length > 3) host.removeChild(host.firstChild);
    let timer = setTimeout(dismiss, opts.duration || 3000);
    function dismiss() {
      clearTimeout(timer);
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 260);
    }
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 1200); });
  }

  /* ---------------------------------------------------------------- 体检 */
  function openHealth() {
    const links = state.lib.links;
    const ok = links.filter((l) => l.status === 'ok').length;
    const warn = links.filter((l) => l.status === 'warn' || l.status === 'unknown').length;
    const fail = links.filter((l) => l.status === 'fail').length;
    const thumbs = links.filter((l) => l.thumb).length;
    const bi = state.lib.buildInfo || {};
    const checkTimes = links.map((l) => l.statusCheckedAt).filter(Boolean).sort();
    const lastCheck = checkTimes.length ? checkTimes[checkTimes.length - 1] : bi.screenedAt;
    const checkedAt = lastCheck ? new Date(lastCheck) : null;
    const bad = links.filter((l) => l.status !== 'ok');
    const listHtml = bad.length
      ? bad.map((l) => '<div class="health-item"><i class="dot' + (l.status === 'fail' ? ' fail' : '') + '"></i>' +
          '<span class="h-title" title="' + esc(l.url) + '">' + esc(l.title || l.url) + '</span>' +
          '<span class="h-note">' + esc(l.status === 'fail' ? '打不开' : (l.note || '待确认')) + '</span>' +
          '<button type="button" data-open-url="' + esc(l.url) + '">打开</button></div>').join('')
      : '<div class="health-empty">全部链接检测正常，没有需要处理的项目。</div>';
    const body = '' +
      '<div class="health-meta">' + ico('shield') + '<span>' +
        (checkedAt ? '上次联网筛查：' + checkedAt.toLocaleString('zh-CN', { hour12: false }) : '尚未进行联网筛查') +
        ' · 内置数据去重 ' + (bi.duplicates || 0) + ' 条</span></div>' +
      '<div class="health-summary">' +
        '<div class="health-stat ok"><b>' + ok + '</b><span>链接正常</span></div>' +
        '<div class="health-stat warn"><b>' + warn + '</b><span>待确认</span></div>' +
        '<div class="health-stat fail"><b>' + fail + '</b><span>打不开</span></div>' +
        '<div class="health-stat info"><b>' + thumbs + '/' + links.length + '</b><span>已有预览图</span></div>' +
      '</div>' +
      '<div class="health-list">' + listHtml + '</div>' +
      '<div class="check-progress" id="checkProgress" hidden><i></i></div>';
    const modal = openModal({
      title: '数据体检',
      desc: '筛查链接可用性，并检查预览图与重复数据。',
      size: 'lg',
      body: body,
      footer: '<span class="foot-note">' + (state.mode === 'api' ? '重新检测会逐一访问链接，约需 1 分钟。' : '本地模式下无法联网复检，建议使用桌面快捷方式启动。') + '</span>' +
        '<button class="btn" type="button" data-close>关闭</button>' +
        '<button class="btn btn-primary" type="button" id="recheckBtn"' + (state.mode === 'api' && !state.readOnly ? '' : ' disabled') + '>' + ico('refresh') + '重新检测</button>'
    });
    $$('[data-open-url]', modal.el).forEach((b) => b.addEventListener('click', () => {
      const a = document.createElement('a'); a.href = b.dataset.openUrl; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); a.remove();
    }));
    const btn = $('#recheckBtn', modal.el);
    if (btn) btn.addEventListener('click', () => recheckAll(btn, modal));
  }

  async function recheckAll(btn, modal) {
    if (state.mode !== 'api') { toast('本地模式无法联网复检', { type: 'warn' }); return; }
    const links = state.lib.links.slice();
    if (!links.length) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin" style="width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;display:inline-block"></span>检测中…';
    const prog = $('#checkProgress', modal.el);
    if (prog) prog.hidden = false;
    let done = 0, changed = 0;
    for (let i = 0; i < links.length; i += 8) {
      const group = links.slice(i, i + 8);
      try {
        const j = await api.call('api/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: group.map((l) => l.url) }),
          timeout: 40000
        });
        (j && j.results ? j.results : []).forEach((r) => {
          const l = links.filter((x) => x.url === r.url)[0];
          if (!l) return;
          if (l.status !== r.status) changed++;
          l.status = r.status;
          l.statusCheckedAt = new Date().toISOString();
          if (r.status === 'fail') l.note = r.note || '链接无法访问';
          else if (r.status === 'ok' && /^(链接无法访问|站点验证页|未能自动获取|预览抓取超时)/.test(l.note)) l.note = '';
        });
      } catch (e) { /* 忽略单批失败 */ }
      done += group.length;
      if (prog) $('i', prog).style.width = Math.round(done / links.length * 100) + '%';
    }
    await saveLibrary();
    renderAll(false);
    modal.close();
    toast('检测完成' + (changed ? '，' + changed + ' 条状态有更新' : '，状态没有变化'), { duration: 3600 });
    setTimeout(() => openHealth(), 300);
  }

  /* ---------------------------------------------------------------- 备份 */
  function exportBackup() {
    const payload = { app: '效果图网址', schema: 1, exportedAt: new Date().toISOString(), library: state.lib };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '效果图网址-备份-' + stamp() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('备份文件已导出到下载文件夹');
  }

  async function importBackupFile(file) {
    let parsed;
    try {
      parsed = JSON.parse(await readFileText(file));
    } catch (e) {
      toast('文件不是有效的 JSON 备份', { type: 'err' }); return;
    }
    const rawLib = parsed && parsed.library ? parsed.library : parsed;
    if (!rawLib || !Array.isArray(rawLib.links)) { toast('备份内容缺少链接数据', { type: 'err' }); return; }
    const inc = normalizeLibrary(rawLib);
    const n = inc.links.length;
    const modal = openModal({
      title: '导入备份',
      desc: '备份文件包含 ' + n + ' 条链接、' + inc.categories.length + ' 个风格。',
      size: 'sm',
      body: '<div style="font-size:12.5px;color:var(--text-2);line-height:1.8">' +
        '<p><b style="color:var(--text)">合并导入</b>：保留现有内容，只补充备份中不存在的新链接。</p>' +
        '<p style="margin-top:8px"><b style="color:var(--text)">覆盖导入</b>：用备份内容完全替换当前数据（当前 ' + state.lib.links.length + ' 条）。</p></div>',
      footer: '<button class="btn" type="button" data-close>取消</button>' +
        '<button class="btn" type="button" id="impMerge">合并导入</button>' +
        '<button class="btn btn-danger" type="button" id="impReplace">覆盖导入</button>'
    });
    $('#impMerge', modal.el).addEventListener('click', async () => {
      const added = mergeImport(inc);
      state.lib.seedVersion = Math.max(state.lib.seedVersion || 0, inc.seedVersion || 0);
      modal.close(true);
      await saveLibrary();
      renderAll(true);
      toast('已合并导入 ' + added + ' 条链接');
    });
    $('#impReplace', modal.el).addEventListener('click', async () => {
      state.lib = inc;
      state.lib.seedVersion = Math.max(state.lib.seedVersion || 0, SEED_VERSION);
      state.scope = 'home'; state.query = ''; $('#searchInput').value = '';
      modal.close(true);
      await saveLibrary();
      renderAll(true);
      toast('已覆盖导入 ' + n + ' 条链接');
    });
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      if (typeof file.text === 'function') { file.text().then(resolve, reject); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, 'utf-8');
    });
  }

  function mergeImport(inc) {
    const lib = state.lib;
    const nameToId = {};
    lib.categories.forEach((c) => { nameToId[c.name] = c.id; });
    inc.categories.forEach((c) => {
      if (!nameToId[c.name]) {
        const nc = { id: uid('c'), name: c.name, color: c.color, order: lib.categories.length };
        lib.categories.push(nc);
        nameToId[c.name] = nc.id;
      }
    });
    const incCatName = {};
    inc.categories.forEach((c) => { incCatName[c.id] = c.name; });
    let added = 0;
    inc.links.forEach((l) => {
      if (lib.links.some((x) => x.url === l.url)) return;
      const cid = nameToId[incCatName[l.categoryId]] || lib.categories[0].id;
      lib.links.push(Object.assign({}, l, { id: uid('l'), categoryId: cid, order: lib.links.length }));
      lib.tombstones = lib.tombstones.filter((u) => u !== l.url);
      added++;
    });
    return added;
  }

  function resetSeed() {
    confirmDialog({
      title: '恢复内置数据？',
      desc: '将清除当前所有修改，恢复到随软件附带的 39 条效果图。',
      detail: '建议先「导出备份」，以免丢失自己添加的内容。',
      confirmText: '恢复内置',
      danger: true
    }).then(async (yes) => {
      if (!yes) return;
      state.lib = seedLibrary();
      state.scope = 'home';
      clearSearch();
      await saveLibrary();
      renderAll(true);
      toast('已恢复内置数据');
    });
  }

  /* ---------------------------------------------------------------- 说明 */
  function openHelp() {
    const body = '' +
      '<div class="kbd-list">' +
        '<div class="kbd-row"><span>聚焦搜索</span><kbd>Ctrl</kbd><kbd>K</kbd></div>' +
        '<div class="kbd-row"><span>新建链接</span><kbd>N</kbd></div>' +
        '<div class="kbd-row"><span>关闭弹窗 / 清空搜索</span><kbd>Esc</kbd></div>' +
        '<div class="kbd-row"><span>删除选中卡片</span><kbd>Delete</kbd></div>' +
        '<div class="kbd-row"><span>打开选中卡片</span><kbd>Enter</kbd></div>' +
        '<div class="kbd-row"><span>编辑选中卡片</span><kbd>E</kbd></div>' +
      '</div>' +
      '<div class="about-box"><span class="brand-mark"><span>效</span></span><div>' +
        '<b>效果图网址 · 风格灵感库</b>' +
        '<p>共 ' + state.lib.links.length + ' 条链接 / ' + state.lib.categories.length + ' 种风格。' +
        (state.readOnly
          ? '当前是公开分享版：任何人打开这个链接都能看，但只能浏览、不能修改。内容由电脑端维护。'
          : state.mode === 'api'
            ? '当前为共享存储模式，数据文件位于 C:\\效果图网址\\data\\library.json，Edge、Chrome、百度等浏览器打开的是同一份数据。'
            : '当前为本地模式，数据保存在当前浏览器的 localStorage 中；双击桌面「效果图网址」快捷方式可获得共享存储与自动预览。') +
        (state.readOnly ? '' : '<br>手机 / 微信：手机与电脑连同一个 Wi-Fi 后，点右上角手机图标扫码，即可在微信里打开同一个效果图库。') +
        (state.readOnly ? '' : '<br>永久公网站：<a href="' + PERMANENT_URL + '" target="_blank" rel="noopener" style="color:var(--accent-2)">' + PERMANENT_URL + '</a><br>本地修改后，双击桌面「发布更新到公网」即可更新永久站（约 1 分钟）。') +
        '</p></div></div>';
    const modal = openModal({
      title: '使用说明与快捷键',
      desc: '双击卡片打开全景；悬停卡片可复制、编辑或删除。',
      size: 'md',
      body: body,
      footer: '<button class="btn" type="button" data-close>知道了</button>'
    });
    $('#modeChip').blur();
    return modal;
  }

  /* ---------------------------------------------------------------- 交互 */
  function scrollMainTop() {
    const main = $('#main');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setScope(id) {
    state.scope = id || 'home';
    if (state.query) {
      state.query = '';
      const input = $('#searchInput');
      if (input) input.value = '';
      const clr = $('#searchClear');
      if (clr) clr.hidden = true;
      const wrap = $('#searchWrap');
      if (wrap) wrap.classList.remove('has-value');
    }
    closeMenu();
    renderSidebar();
    renderHead();
    renderContent(true);
    scrollMainTop();
  }

  const doSearch = debounce(() => {
    state.query = $('#searchInput').value.trim();
    const hasValue = !!state.query;
    $('#searchClear').hidden = !hasValue;
    $('#searchWrap').classList.toggle('has-value', hasValue);
    renderHead();
    renderContent(false);
  }, 140);

  function clearSearch() {
    const input = $('#searchInput');
    input.value = '';
    state.query = '';
    $('#searchClear').hidden = true;
    $('#searchWrap').classList.remove('has-value');
    renderHead();
    renderContent(true);
    input.focus();
  }

  function focusSearch() {
    const input = $('#searchInput');
    input.focus();
    input.select();
  }

  function handleAction(act, link) {
    if (!link) return;
    if (act === 'open') openLink(link);
    else if (act === 'copy') actCopy(link);
    else if (act === 'edit' && !state.readOnly) openForm('edit', link);
    else if (act === 'del' && !state.readOnly) actDelete(link);
  }

  const LIFE_CITIES = [
    { name: '丽水', lat: 28.45, lon: 119.92 },
    { name: '杭州', lat: 30.27, lon: 120.16 },
    { name: '上海', lat: 31.23, lon: 121.47 },
    { name: '北京', lat: 39.90, lon: 116.41 },
    { name: '广州', lat: 23.13, lon: 113.26 },
    { name: '深圳', lat: 22.54, lon: 114.06 },
    { name: '成都', lat: 30.57, lon: 104.07 },
    { name: '武汉', lat: 30.59, lon: 114.31 },
    { name: '南京', lat: 32.06, lon: 118.80 },
    { name: '西安', lat: 34.34, lon: 108.94 },
    { name: '重庆', lat: 29.56, lon: 106.55 },
    { name: '苏州', lat: 31.30, lon: 120.58 },
    { name: '青岛', lat: 36.07, lon: 120.38 },
    { name: '厦门', lat: 24.48, lon: 118.09 }
  ];
  const LIFE_WMO = {
    0: ['晴', '☀️'], 1: ['少云', '🌤️'], 2: ['多云', '⛅'], 3: ['阴', '☁️'],
    45: ['雾', '🌫️'], 48: ['雾凇', '🌫️'],
    51: ['毛毛雨', '🌦️'], 53: ['毛毛雨', '🌦️'], 55: ['毛毛雨', '🌦️'],
    56: ['冻雨', '🌧️'], 57: ['冻雨', '🌧️'],
    61: ['小雨', '🌦️'], 63: ['中雨', '🌧️'], 65: ['大雨', '🌧️'],
    66: ['冻雨', '🌧️'], 67: ['冻雨', '🌧️'],
    71: ['小雪', '🌨️'], 73: ['中雪', '🌨️'], 75: ['大雪', '❄️'], 77: ['雪粒', '🌨️'],
    80: ['阵雨', '🌦️'], 81: ['阵雨', '🌧️'], 82: ['强阵雨', '⛈️'],
    85: ['阵雪', '🌨️'], 86: ['强阵雪', '❄️'],
    95: ['雷雨', '⛈️'], 96: ['雷雨冰雹', '⛈️'], 99: ['雷雨冰雹', '⛈️']
  };
  let lifeCalendarState = null;
  let lifeWeatherCity = '丽水';
  try { lifeWeatherCity = localStorage.getItem('yxg.life.city') || '丽水'; } catch (e) {}

  function lifeWeatherInfo(code) {
    return LIFE_WMO[Number(code)] || ['未知', '🌡️'];
  }
  let weatherCache = { city: '', at: 0, data: null };
  async function fetchWeatherData(cityName) {
    const city = LIFE_CITIES.filter((c) => c.name === cityName)[0] || LIFE_CITIES[0];
    const now = Date.now();
    if (weatherCache.city === city.name && now - weatherCache.at < 10 * 60 * 1000) return weatherCache.data;
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FShanghai&forecast_days=7';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    weatherCache = { city: city.name, at: now, data: data };
    return data;
  }

  function renderLifeCalendar(box) {
    const now = new Date();
    if (!lifeCalendarState) lifeCalendarState = { y: now.getFullYear(), m: now.getMonth() };
    const weekNames = ['一', '二', '三', '四', '五', '六', '日'];
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    function draw() {
      const y = lifeCalendarState.y;
      const m = lifeCalendarState.m;
      const first = new Date(y, m, 1);
      const start = (first.getDay() + 6) % 7;
      const days = new Date(y, m + 1, 0).getDate();
      const prevDays = new Date(y, m, 0).getDate();
      const eventDates = scheduleDateSet();
      let cells = '';
      for (let i = 0; i < 42; i++) {
        const num = i - start + 1;
        let d, cy = y, cm = m, muted = false;
        if (num < 1) { d = prevDays + num; muted = true; cm = m - 1; if (cm < 0) { cm = 11; cy--; } }
        else if (num > days) { d = num - days; muted = true; cm = m + 1; if (cm > 11) { cm = 0; cy++; } }
        else d = num;
        const dt = new Date(cy, cm, d);
        const isToday = dt.toDateString() === now.toDateString();
        const dow = dt.getDay();
        const ds = cy + '-' + pad2(cm + 1) + '-' + pad2(d);
        cells += '<div class="cal-cell' + (muted ? ' is-muted' : '') + ((dow === 0 || dow === 6) ? ' is-weekend' : '') + (isToday ? ' is-today' : '') + (eventDates[ds] ? ' has-event' : '') + '" data-life-date="' + ds + '">' + d + '</div>';
      }
      box.innerHTML = '<div class="cal-top"><b>' + y + ' 年 ' + (m + 1) + ' 月</b>' +
        '<div class="cal-nav"><button type="button" data-cal="-1" aria-label="上个月">‹</button>' +
        '<button type="button" data-cal="today" aria-label="回到今天">今</button>' +
        '<button type="button" data-cal="1" aria-label="下个月">›</button></div></div>' +
        '<div class="cal-week">' + weekNames.map((w) => '<span>' + w + '</span>').join('') + '</div>' +
        '<div class="cal-grid">' + cells + '</div>' +
        '<div class="cal-today-line">今天：' + now.getFullYear() + ' 年 ' + (now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日 星期' + dayNames[now.getDay()] + '</div>';
      $$('[data-cal]', box).forEach((btn) => btn.addEventListener('click', () => {
        const v = btn.dataset.cal;
        if (v === 'today') {
          const t = new Date();
          lifeCalendarState = { y: t.getFullYear(), m: t.getMonth() };
        } else {
          lifeCalendarState.m += Number(v);
          if (lifeCalendarState.m < 0) { lifeCalendarState.m = 11; lifeCalendarState.y--; }
          if (lifeCalendarState.m > 11) { lifeCalendarState.m = 0; lifeCalendarState.y++; }
        }
        draw();
      }));
      $$('[data-life-date]', box).forEach((cell) => cell.addEventListener('click', () => openScheduleModal(cell.dataset.lifeDate)));
    }
    draw();
  }

  async function renderLifeWeather(box) {
    if (!LIFE_CITIES.some((c) => c.name === lifeWeatherCity)) lifeWeatherCity = '丽水';
    box.innerHTML = '<div class="weather-top"><b>国内天气预报</b><select class="weather-city" id="lifeCity">' +
      LIFE_CITIES.map((c) => '<option value="' + c.name + '">' + c.name + '</option>').join('') +
      '</select></div><div id="lifeWeatherBody"><div class="life-loading">正在获取天气…</div></div>' +
      '<div class="life-note">数据来源：Open-Meteo 公开天气接口（未来 7 天），仅供参考；出门前请以当地气象台预报为准。</div>';
    const sel = $('#lifeCity', box);
    sel.value = lifeWeatherCity;
    let seq = 0;
    async function load() {
      const city = LIFE_CITIES.filter((c) => c.name === lifeWeatherCity)[0] || LIFE_CITIES[0];
      const my = ++seq;
      const target = $('#lifeWeatherBody', box);
      target.innerHTML = '<div class="life-loading">正在获取 ' + esc(city.name) + ' 的天气…</div>';
      try {
        const data = await fetchWeatherData(city.name);
        if (my !== seq) return;
        const daily = data.daily || {};
        const times = daily.time || [];
        const codes = daily.weather_code || [];
        const maxs = daily.temperature_2m_max || [];
        const mins = daily.temperature_2m_min || [];
        const rains = daily.precipitation_probability_max || [];
        const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        let html = '<div class="weather-grid">';
        times.forEach((t, i) => {
          const dt = new Date(t + 'T12:00:00');
          const info = lifeWeatherInfo(codes[i]);
          const label = i === 0 ? '今天' : week[dt.getDay()];
          const rain = rains[i] == null ? '—' : rains[i] + '%';
          html += '<div class="weather-day' + (i === 0 ? ' is-today' : '') + '">' +
            '<div class="w-date">' + label + ' ' + (dt.getMonth() + 1) + '/' + dt.getDate() + '</div>' +
            '<div class="w-emoji">' + info[1] + '</div>' +
            '<div class="w-desc">' + info[0] + '</div>' +
            '<div class="w-max">' + Math.round(maxs[i]) + '°</div>' +
            '<div class="w-min">' + Math.round(mins[i]) + '°</div>' +
            '<div class="w-rain">降水 ' + rain + '</div>' +
            '</div>';
        });
        html += '</div>';
        target.innerHTML = html;
      } catch (e) {
        if (my !== seq) return;
        target.innerHTML = '<div class="life-loading">天气服务暂时不可用，请稍后再试。</div>';
      }
    }
    sel.addEventListener('change', () => {
      lifeWeatherCity = sel.value;
      try { localStorage.setItem('yxg.life.city', lifeWeatherCity); } catch (e) {}
      load();
    });
    await load();
  }

  function renderLifeFengShui(box) {
    const sections = [
      ['先看总原则', '<p>风水在居住空间里，最稳定的部分其实都是“物理条件”：采光、通风、干燥、安静、动线顺畅、收纳充足、视线有遮挡但不压抑。先满足这些，再谈方位、摆件和流年。</p><p>任何涉及承重墙、燃气、排水、消防通道、外立面、门窗尺寸的改动，都必须以结构和安全规范为准，不能为了“化解”去冒险。</p><p>同一套房，不同流派说法可能互相矛盾。建议把风水当作整理生活、检查居住舒适度的提醒，而不是必须执行的施工指令。</p>'],
      ['采光与通风', '<p>白天尽量让主要空间有自然光；长期被高柜、隔断、深色窗帘挡住的采光面，优先调整。灯光分主灯、重点灯、氛围灯，避免一个顶灯照全屋。</p><p>厨房、卫生间、衣帽间要有独立排风；新装修先充分通风，入住后再谈摆件。穿堂风不等于好通风，稳定、可控制的换气更重要。</p>'],
      ['玄关', '<p>玄关是第一印象，也是换鞋、放包、收快递的过渡区。宜明亮、干净、地面好打理；鞋柜有门，常穿的鞋有固定位置，不把杂物堆在门口。</p><p>传统讲“藏风聚气”，实际效果是进门不要一眼看穿全屋、不要正对尖锐物或镜子、不要被鞋堆绊住动线。空间允许时，用半高柜、格栅或绿植做一点视线缓冲即可。</p>'],
      ['客厅', '<p>沙发背后宜有实墙或稳固柜体，尽量不要背对大门、主走道或大面积落地窗；这不是“靠山”玄学，而是坐下来的安全感和稳定性。</p><p>电视墙不宜过厚过高，茶几与沙发之间留出通行距离；采光面不要被高柜堵住。客厅的“聚气”更多来自一家人愿意坐下来，而不是摆满招财物。</p>'],
      ['餐厅', '<p>餐桌尽量避开正对卫生间门和强动线；上方灯光柔和，不要直射眼睛。餐边柜承担收纳，台面留空，吃饭时不被杂物包围。</p><p>传统上讲究“食不言、寝不语”，放到今天就是用餐区安静、整洁、少电视干扰。小户型可以用圆桌或折叠桌，动线比尺寸更重要。</p>'],
      ['卧室', '<p>床头靠实墙，床头两侧留出通道；镜子不要正对床，衣柜镜可以转向或加帘。灯光以暖色、可调光为宜，主灯不要正压床头。</p><p>卧室优先解决遮光、静音、通风和收纳。少放强干扰电器，床头插座够用即可；不要把卧室做成第二个办公室。</p>'],
      ['厨房', '<p>灶台与水槽之间留操作台面，避免紧贴；这不是“水火相冲”，而是切菜、盛水、炒菜时互不干扰。油烟机排烟要顺畅，公共烟道止逆阀要检查。</p><p>厨房门常关或加装隔断，减少油烟进入客厅；燃气、排烟、插座防水、地砖防滑等安全规范，永远高于任何方位说法。</p>'],
      ['卫生间', '<p>干湿分离、排风良好、地漏通畅、地面防滑，是卫生间最重要的四件事。门尽量常关，减少湿气进入卧室和客厅。</p><p>传统上不建议卫生间门正对大门、床或餐桌；如果户型无法改，可以用门帘、隔断、常关门和加强排风来弱化。潮湿区域少放电器和易霉物品。</p>'],
      ['书房 / 工作区', '<p>座位背后有靠，视线不直冲门口；光线从侧前方来，避免屏幕反光。桌面少堆杂物，常用资料伸手可及。</p><p>如果只能面对墙，保持墙面简洁、留一盏柔和的背景灯；如果背后是走道，用矮柜或屏风制造一点稳定感。专注比“文昌位”更实际。</p>'],
      ['阳台与绿植', '<p>阳台保持通透，不堆成杂物间；不遮挡采光和消防通道。绿植适量，根据光照和浇水习惯选择，不为了“化煞”摆一排带刺植物。</p><p>带刺植物不要放在常走动的窄道和儿童活动区；水景、鱼缸要考虑承重、防水和日常维护，不能只图好看。</p>'],
      ['镜子、尖角与横梁', '<p>镜子不宜正对床、门或沙发久坐位置，容易造成眩光和夜间惊吓；家具尖角尽量避开主要动线。横梁下不宜长期久坐久卧，可用吊顶、柜体或家具布局弱化。</p><p>所谓“尖角煞”，很多时候是动线碰撞和视觉压迫；把尖角做成圆角、加软包或调整家具方向，比挂物件更有效。</p>'],
      ['门窗、动线与收纳', '<p>大门、厨房门、卫生间门不要同时形成一条直通视线；如果无法改门，用门帘、隔断、绿植或改变开门方向来缓冲。门后不要堆杂物，保证逃生通道畅通。</p><p>收纳遵循“藏八露二”：大部分物品进柜，少量常用品露出来。柜子做到顶、少做开放格，是减少杂乱最有效的“风水”。</p>'],
      ['颜色、材质与灯光', '<p>大面积颜色以低饱和、耐看为主；木、石、布艺的质感比“五行颜色”更影响居住感受。深色可以点缀，但不要压住采光。</p><p>灯光分层次：主灯负责基础照明，阅读灯、氛围灯负责局部。色温建议 3000K~4000K，卧室可更暖；避免一个冷白顶灯照全屋。</p>'],
      ['2026 年怎么参考', '<p>流年方位、九宫飞星等说法流派很多，不建议据此大改房屋结构。可以把“年度方位”当作整理和清洁的提醒：重点打扫常年不动的角落，保持通风和明亮即可。</p><p>如果看到“某方位必须放某物”的说法，先判断它是否影响动线、消防、采光和预算；影响生活的，不做；只是小摆件的，可以当作装饰乐趣。</p>'],
      ['常见误区', '<p>误区一：摆满招财物。空间拥挤、积灰、难清洁，反而降低居住质量。</p><p>误区二：为了“化煞”拆改结构。承重墙、燃气、排水、消防不能动。</p><p>误区三：把流年方位当成施工图。方位说法每年变，房子要住很多年，稳定舒适更重要。</p><p>误区四：只看风水不看采光通风。住得健康、睡得安稳，才是最好的“风水”。</p>']
    ];
    box.innerHTML = '<div class="fs-warn">' + ico('alert') + '<span>以下为传统民俗与居住经验整理，仅供装修参考，不构成专业风水、结构、燃气或消防安全建议。采光、通风、消防、结构安全永远优先。</span></div>' +
      '<div class="fs-list">' + sections.map((s, i) => '<details class="fs-item"' + (i === 0 ? ' open' : '') + '><summary>' + s[0] + '</summary><div class="fs-text">' + s[1] + '</div></details>').join('') + '</div>';
  }

  function openScheduleModal(dateFilter) {
    const all = sortedSchedule();
    const events = dateFilter ? all.filter((e) => e.date === dateFilter) : all;
    const colors = { '量房': '#4FC3F7', '方案': '#8A7CFF', '施工': '#F2B8B5', '客户': '#5FD3B4', '其他': '#9AA7B8' };
    const body = '<div class="schedule-list">' + (events.length ? events.map((e) => {
      const color = colors[e.type] || colors['其他'];
      const d = new Date(e.date + 'T12:00:00');
      const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return '<div class="schedule-item' + (e.done ? ' is-done' : '') + '">' +
        '<div class="schedule-when"><b>' + (d.getMonth() + 1) + '/' + d.getDate() + '</b><span>' + week[d.getDay()] + ' · ' + esc(e.time || '全天') + '</span></div>' +
        '<div class="schedule-main"><b>' + esc(e.title) + '</b><span>' + (e.note ? esc(e.note) : '—') + '</span></div>' +
        '<span class="schedule-type" style="color:' + color + ';border-color:' + color + '33;background:' + color + '12">' + esc(e.type) + '</span>' +
        '</div>';
    }).join('') : '<div class="life-loading">' + (dateFilter ? '这一天没有日程' : '还没有日程') + '</div>') + '</div>' +
      '<div class="life-note">日程在管理模式「设计师日程」里维护；公网页只读展示，过期日程会自动清理。点下方「管理日程」进入管理模式添加或修改。</div>';
    const modal = openModal({
      title: dateFilter ? '设计师日程 · ' + scheduleDateLabel(dateFilter) : '设计师日程',
      desc: '量房、方案、施工、客户与备忘',
      size: 'md',
      body: body,
      footer: (state.readOnly ? '<button class="btn btn-primary" type="button" id="scheduleManage">管理日程</button>' : '') +
        '<button class="btn" type="button" data-close>关闭</button>'
    });
    const manage = $('#scheduleManage', modal.el);
    if (manage) manage.addEventListener('click', () => openAdminMode('schedule'));
  }

  function renderLifeSchedule(box) {
    const events = sortedSchedule();
    const colors = { '量房': '#4FC3F7', '方案': '#8A7CFF', '施工': '#F2B8B5', '客户': '#5FD3B4', '其他': '#9AA7B8' };
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const body = events.length ? events.map((e) => {
      const color = colors[e.type] || colors['其他'];
      const d = new Date(e.date + 'T12:00:00');
      return '<div class="schedule-item' + (e.done ? ' is-done' : '') + '">' +
        '<div class="schedule-when"><b>' + (d.getMonth() + 1) + '/' + d.getDate() + '</b><span>' + week[d.getDay()] + ' · ' + esc(e.time || '全天') + '</span></div>' +
        '<div class="schedule-main"><b>' + esc(e.title) + '</b><span>' + (e.note ? esc(e.note) : '—') + '</span></div>' +
        '<span class="schedule-type" style="color:' + color + ';border-color:' + color + '33;background:' + color + '12">' + esc(e.type) + '</span>' +
        '</div>';
    }).join('') : '<div class="life-loading">还没有日程</div>';
    box.innerHTML = '<div class="schedule-list">' + body + '</div>' +
      '<div class="life-note">日程在管理模式「设计师日程」里维护；公网页只读展示，过期日程会自动清理。点右上角「全部日程」可进入日程页并管理。</div>';
  }

  function openLifeModal(initialTab) {
    const body = '<div class="life-tabs" id="lifeTabs">' +
      '<button type="button" data-life="schedule">日程</button>' +
      '<button type="button" data-life="calendar" class="is-active">日历</button>' +
      '<button type="button" data-life="weather">天气</button>' +
      '<button type="button" data-life="fengshui">风水参考</button></div>' +
      '<div class="life-body" id="lifeBody"></div>';
    const modal = openModal({
      title: '生活参考',
      desc: '日程 · 日历 · 国内天气 · 风水（传统民俗参考）',
      size: 'lg',
      body: body,
      footer: '<button class="btn" type="button" data-close>关闭</button>'
    });
    const tabs = $$('#lifeTabs button', modal.el);
    const box = $('#lifeBody', modal.el);
    function show(tab) {
      tabs.forEach((b) => b.classList.toggle('is-active', b.dataset.life === tab));
      if (tab === 'schedule') renderLifeSchedule(box);
      else if (tab === 'calendar') renderLifeCalendar(box);
      else if (tab === 'weather') renderLifeWeather(box);
      else renderLifeFengShui(box);
    }
    tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.life)));
    show(initialTab || 'calendar');
  }

  const TUTORIAL_URLS = {
    public: 'https://togetherggg.github.io/yingxiangtu/',
    admin: 'https://togetherggg.github.io/yingxiangtu/admin.html?v=14',
    local: 'http://127.0.0.1:51888/'
  };

  function settingsContent(key) {
    const A = TUTORIAL_URLS.admin;
    const P = TUTORIAL_URLS.public;
    if (key === 'wallpaper') {
      const w = wallpaperPrefs || loadWallpaperPrefs();
      const themeChips = WALLPAPER_THEMES.map((t) => '<button type="button" data-wallpaper-theme="' + t.id + '" class="' + (w.theme === t.id ? 'is-active' : '') + '">' + t.label + '</button>').join('');
      const cards = customWallpapers.concat(WALLPAPERS).map((x) => '<button type="button" class="wallpaper-card' + (w.selected === x.id ? ' is-selected' : '') + '" data-wallpaper-pick="' + x.id + '" aria-pressed="' + (w.selected === x.id ? 'true' : 'false') + '">' +
        '<img src="' + x.thumb + '" alt="' + esc(x.title) + '" loading="lazy">' +
        '<span><b>' + esc(x.title) + '</b><em>' + wallpaperThemeLabel(x.theme) + (x.custom ? ' · 自定义' : '') + '</em></span>' +
        (x.custom ? '<span class="wallpaper-del" data-wallpaper-del="' + x.id + '" role="button" tabindex="0" aria-label="删除这张自定义壁纸">×</span>' : '') +
        '<i class="wallpaper-pick-check">✓</i></button>').join('');
      const durOpts = WALLPAPER_DURATIONS.map((d) => '<option value="' + d.value + '"' + (w.duration === d.value ? ' selected' : '') + '>' + d.label + '</option>').join('');
      return '<h4>艺术建筑壁纸</h4>' +
        '<p>室内、室外、园艺三类建筑与庭院主题壁纸。可以整体开关，也可以只选一张固定显示；轮播时按设定的时长自动切换。</p>' +
        '<label class="wallpaper-master"><input id="wallpaperEnabled" type="checkbox"' + (w.enabled ? ' checked' : '') + '><b>显示壁纸</b><span>关闭后恢复纯色 + 光晕背景</span></label>' +
        '<details class="wallpaper-add-wrap" open>' +
        '<summary>＋ 添加自己的壁纸（URL / 本地上传）</summary>' +
        '<div class="wallpaper-add">' +
        '<div class="wallpaper-add-row">' +
        '<input id="wallpaperUrl" type="url" placeholder="粘贴图片 URL（https://...）">' +
        '<button class="btn btn-sm" type="button" id="wallpaperPickFile">上传本地图片</button>' +
        '<input id="wallpaperFile" type="file" accept="image/*" hidden>' +
        '</div>' +
        '<div class="wallpaper-add-row">' +
        '<input id="wallpaperTitle" type="text" maxlength="30" placeholder="壁纸名称（可留空）">' +
        '<select id="wallpaperThemeNew"><option value="interior">室内</option><option value="exterior">室外</option><option value="garden">园艺</option></select>' +
        '<button class="btn btn-primary btn-sm" type="button" id="wallpaperAdd">添加壁纸</button>' +
        '</div>' +
        '<div class="wallpaper-add-msg" id="wallpaperAddMsg">支持 JPG / PNG；本地图片会压缩后只保存在当前浏览器，不会上传到公网仓库。</div>' +
        '</div>' +
        '</details>' +
        '<h4>选择单张壁纸</h4>' +
        '<p class="wallpaper-hint">点任意一张即选为单张，并自动关闭轮播。</p>' +
        '<div class="wallpaper-grid">' + cards + '</div>' +
        '<h4>轮播与播放时长</h4>' +
        '<div class="wallpaper-theme-row"><span>轮播主题</span><div class="wallpaper-theme-tabs">' + themeChips + '</div></div>' +
        '<div class="wallpaper-controls">' +
        '<label class="wallpaper-field">每张播放时长<select id="wallpaperDuration">' + durOpts + '</select></label>' +
        '<label class="wallpaper-rotate"><input id="wallpaperRotate" type="checkbox"' + (w.rotate ? ' checked' : '') + '> 轮播全部</label>' +
        '</div>' +
        '<div class="settings-tip is-info">' + ico('info') + '<span>单张 + 有限时长：到时间后壁纸自动关闭；永久：一直显示。轮播时每张按这个时长切换，永久 = 停在当前这张。这里的设置只影响当前浏览器。</span></div>' +
        '<p class="wallpaper-credit">图片来自 <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a>，遵循 Unsplash License，仅作界面壁纸使用。</p>' +
        '<h4>壁纸设置教程</h4>' +
        '<ol>' +
        '<li>公网页右上角齿轮「设置」→「壁纸」。</li>' +
        '<li>「显示壁纸」总开关：关闭后回到原来的深色/浅色背景。</li>' +
        '<li>点任意一张壁纸 = 只显示这一张，轮播自动取消；再选「每张播放时长」。</li>' +
        '<li>单张 + 有限时长：到 1 分钟 / 5 分钟 / 15 分钟 / 30 分钟 / 1 小时 / 12 小时 / 24 小时后壁纸自动关闭；选「永久」则一直显示。</li>' +
        '<li>想自动换图：勾选「轮播全部」，选轮播主题（全部 / 室内 / 室外 / 园艺）；每张按时长切换，选「永久」则停在当前这张。</li>' +
        '<li>添加自己的壁纸：粘贴图片 URL，或点「上传本地图片」；选室内 / 室外 / 园艺，点「添加壁纸」。自定义壁纸会出现在上方，和内置壁纸一样可以单选、轮播、设时长；点左上角 × 可删除。</li>' +
        '<li>自定义壁纸只保存在当前浏览器，不会上传到公网仓库；换设备或清理浏览器数据后会消失。</li>' +
        '<li>设置只保存在当前浏览器；换设备或清理浏览器数据后会恢复默认。</li>' +
        '</ol>';
    }
    if (key === 'board') {
      const cfg = boardConfig();
      const chk = (k) => cfg[k] !== false ? ' checked' : '';
      return '<h4>首页工作台显示</h4>' +
        '<p>可以单独决定首页工作台显示哪些模块。隐藏后，风格总览和链接仍然正常；被隐藏的模块仍可从右上角日历图标「生活参考」打开。</p>' +
        '<div class="settings-board-prefs">' +
        '<label><input type="checkbox" id="boardPrefMaster" data-board-pref="board"' + chk('board') + '> 显示首页工作台 <span class="sub">总开关</span></label>' +
        '<label><input type="checkbox" data-board-pref="schedule"' + chk('schedule') + '> 设计师日程</label>' +
        '<label><input type="checkbox" data-board-pref="weather"' + chk('weather') + '> 天气</label>' +
        '<label><input type="checkbox" data-board-pref="calendar"' + chk('calendar') + '> 日历</label>' +
        '<label><input type="checkbox" data-board-pref="fengshui"' + chk('fengshui') + '> 风水参考</label>' +
        '</div>' +
        '<div style="margin-bottom:12px"><button class="btn btn-sm" type="button" id="boardPrefsReset">恢复为管理页默认</button></div>' +
        '<div class="settings-tip is-info">' + ico('info') + '<span>这里的开关只影响<strong>当前浏览器</strong>；要让所有访客看到同样的工作台，请到管理页 →「首页工作台」设置并保存（全局生效）。</span></div>' +
        '<h4>工作台设置教程</h4>' +
        '<ol>' +
        '<li>打开公网页右上角齿轮「设置」→「工作台」。</li>' +
        '<li>取消某个勾选，例如「天气」，关闭设置窗口后首页工作台就不显示天气卡片。</li>' +
        '<li>取消「显示首页工作台」总开关，整个工作台隐藏，只保留风格总览和链接。</li>' +
        '<li>隐藏后，右上角日历图标仍可打开「生活参考」，里面有日程 / 日历 / 天气 / 风水四个标签。</li>' +
        '<li>想恢复，重新勾选，或点「恢复为管理页默认」。</li>' +
        '<li>要让所有访客都生效：到管理页 →「首页工作台」勾选并「保存并发布」；那是全局设置。</li>' +
        '</ol>' +
        '<h4>两种设置的区别</h4>' +
        '<p><strong>公网页设置（本页）</strong>：只影响你当前浏览器，适合自己看着舒服。<br><strong>管理页 → 首页工作台</strong>：写入公网数据，所有访客都会按这个显示。</p>' +
        '<p>管理页地址：<a href="' + A + '" target="_blank" rel="noopener">' + A + '</a></p>';
    }
    if (key === 'guide') {
      return '<h4>公网页怎么用</h4>' +
        '<ol>' +
        '<li><strong>看风格</strong>：首页「风格总览」按装修风格排列，点任意风格进入该风格的链接列表。</li>' +
        '<li><strong>全部链接</strong>：左栏「全部链接」可以一次看所有效果图。</li>' +
        '<li><strong>搜索</strong>：顶部搜索框输入标题、网址、风格或来源，支持空格分词；按 <span class="settings-kbd">Ctrl</span> + <span class="settings-kbd">K</span> 快速聚焦。</li>' +
        '<li><strong>视图和主题</strong>：右上角切换网格/列表、明暗主题；选择会保存在当前浏览器。</li>' +
        '<li><strong>手机 / 微信</strong>：点右上角手机图标，复制公网链接或扫码；把链接发到微信即可在手机打开。</li>' +
        '<li><strong>卡片操作</strong>：点卡片打开效果图网站；卡片上的复制按钮可以复制原始链接。</li>' +
        '</ol>' +
        '<h4>添加效果图 / 日程</h4>' +
        '<p>公网页右上角「添加链接」和日程里的「管理日程」会直接进入管理模式；需要 Token，保存后公网页自动更新。普通访客仍然只读，不能匿名修改。</p>' +
        '<h4>首页「设计师工作台」</h4>' +
        '<ul>' +
        '<li><strong>设计师日程</strong>：显示最近 4 条未完成日程；点「全部日程 →」看完整日程；日历上有圆点的日期表示当天有安排，点日期可看当天日程。</li>' +
        '<li><strong>天气</strong>：显示当前天气和未来 3 天；点「7 天 →」打开完整预报，可切换 14 个国内城市，默认丽水。</li>' +
        '<li><strong>日历</strong>：本月迷你日历，今天高亮，上/下月切换；点「打开 →」进入大日历。</li>' +
        '<li><strong>风水参考</strong>：每天一条小提示；点「详细 →」查看 15 个板块的完整内容。属于传统民俗与居住经验参考。</li>' +
        '</ul>' +
        '<h4>工作台显示设置</h4>' +
        '<p>打开右上角齿轮「设置」→「工作台」，可以单独显示/隐藏设计师日程、天气、日历、风水参考，也可以关闭整个工作台。这个开关只影响当前浏览器；要让所有访客一起变，请到管理页 →「首页工作台」保存。隐藏后仍可从右上角日历图标打开「生活参考」。</p>' +
        '<h4>艺术建筑壁纸</h4>' +
        '<p>设置 →「壁纸」里有室内 / 室外 / 园艺三类建筑壁纸。可以整体开关、点选单张、设置每张 1 分钟到永久的播放时长，也可以轮播全部。壁纸设置只影响当前浏览器。</p>' +
        '<h4>「待分类」是什么</h4>' +
        '<p>管理页删除某个风格时，<strong>不会删除里面的效果图</strong>，链接会集中到「待分类」。公网页的「待分类」也可以正常浏览；把链接归回某个风格的操作在管理页完成。</p>' +
        '<div class="settings-tip is-info">' + ico('info') + '<span>公网页对访客是只读的：可以看、搜索、分享，但不能修改任何内容。</span></div>' +
        '<h4>访问地址</h4>' +
        '<p>公网页：<a href="' + P + '" target="_blank" rel="noopener">' + P + '</a></p>' +
        '<p>本地版：<a href="' + TUTORIAL_URLS.local + '" target="_blank" rel="noopener">' + TUTORIAL_URLS.local + '</a>（需电脑上的「效果图网址」正在运行）</p>';
    }
    if (key === 'admin') {
      return '<h4>管理链接是什么</h4>' +
        '<p>管理页只有你自己使用，用来添加/删除效果图、管理风格、维护设计师日程。访客打开公网页看不到管理按钮。</p>' +
        '<p>管理页地址：<a href="' + A + '" target="_blank" rel="noopener">' + A + '</a></p>' +
        '<div class="settings-tip">' + ico('alert') + '<span>管理页需要 GitHub Token。<strong>本教程和公网页都不会显示 Token</strong>；Token 只保存在你自己的电脑和浏览器里，不要发给别人。</span></div>' +
        '<h4>第一次登录</h4>' +
        '<ol>' +
        '<li>打开上面的管理页地址。</li>' +
        '<li>把 GitHub Token 粘贴到输入框，点「进入管理」。Token 在本机 <code>C:\\效果图网址\\data\\github.json</code> 里；桌面「效果图管理」快捷方式会自动带上 Token。</li>' +
        '<li>手机第一次打开需要粘贴一次 Token，之后会自动记住；不要在公共电脑上勾选记住。</li>' +
        '<li>登录后右上角有「退出管理」，可随时清除本机 Token。</li>' +
        '</ol>' +
        '<h4>添加效果图</h4>' +
        '<ol>' +
        '<li>在「添加效果图」填链接地址；标题可留空；选择风格。</li>' +
        '<li>封面图可以粘贴图片 URL，也可以点「上传本地图片」选择 PNG/JPG，会自动压缩成 JPG 上传到你的 GitHub 并填入 URL。</li>' +
        '<li>点「添加这条链接」，再点右下角「保存并发布」。</li>' +
        '<li>约 2 秒保存完成；刷新公网页即可看到。新封面图第一次需要等 GitHub Pages 部署，通常约 1 分钟。</li>' +
        '</ol>' +
        '<h4>风格管理</h4>' +
        '<ul>' +
        '<li><strong>新增风格</strong>：在「风格管理」填名称，点预设色块或彩色圆环自定义颜色，点「添加风格」。</li>' +
        '<li><strong>删除风格</strong>：点风格右侧「删除」。里面的链接<strong>不会删除</strong>，会移到「待分类」。</li>' +
        '<li><strong>重命名/改色</strong>：目前管理页支持新增和删除；改名可在本地版操作。删除前想保留链接，可先移动到别的风格。</li>' +
        '</ul>' +
        '<h4>「待分类」怎么移动</h4>' +
        '<ol>' +
        '<li>在「风格管理」点「待分类」行的「查看」，或直接搜索，筛选出待分类链接。</li>' +
        '<li>把链接行拖到左侧目标风格上；松手后会弹「确认移动 / 取消」。</li>' +
        '<li>手机不方便拖时，点链接行的「移动」按钮，选择目标风格，再确认。</li>' +
        '<li>移动后记得「保存并发布」。原风格会显示在链接下方，方便判断该放回哪里。</li>' +
        '</ol>' +
        '<h4>设计师日程</h4>' +
        '<ol>' +
        '<li>在管理页「设计师日程」选择日期、时间，填标题、类型（量房/方案/施工/客户/其他）和备注。</li>' +
        '<li>点「添加日程」；可标记「完成」或「删除」。</li>' +
        '<li>点「保存并发布」后，公网页工作台的日程、日历圆点和完整日程表会同步。</li>' +
        '</ol>' +
        '<h4>保存与发布</h4>' +
        '<ul>' +
        '<li>所有修改先只是草稿；点右下角「保存并发布」才写入 GitHub。</li>' +
        '<li>保存后数据走快速通道，公网页刷新即可；图片文件需要等 GitHub Pages 部署。</li>' +
        '<li>「放弃修改」会重新读取公网页数据，丢弃未保存的改动。</li>' +
        '<li>如果提示冲突，说明公网页已被另一个窗口更新，点「刷新数据」后再改。</li>' +
        '</ul>' +
        '<h4>本地版与发布</h4>' +
        '<ul>' +
        '<li>桌面「效果图网址」打开本地版；可以批量编辑、搜索、预览、备份。</li>' +
        '<li>本地改完双击「发布更新到公网」，会上传最新数据 JSON 和新增缩略图。</li>' +
        '<li>如果同时用管理页，建议以管理页为准；本地旧数据发布前先确认不会覆盖管理页的新内容。</li>' +
        '</ul>' +
        '<h4>Token 安全</h4>' +
        '<ul>' +
        '<li>Token 等同于仓库写权限，不要发到群里、截图或公开页面。</li>' +
        '<li>怀疑泄露时：GitHub → Settings → Developer settings → Personal access tokens → 删除旧 Token，新建一个，更新本机 <code>data\\github.json</code>。</li>' +
        '<li>删除 Token 不会影响已经上线的公网页，只会让管理页/发布无法再写入。</li>' +
        '</ul>' +
        '<h4>管理入口 / 忘记 Token</h4>' +
        '<div class="settings-admin-actions">' +
        '<button class="btn btn-primary btn-sm" type="button" id="settingsAdminMode">进入管理模式</button>' +
        '<a class="btn btn-sm" href="' + A + '" target="_blank" rel="noopener">新窗口打开</a>' +
        '<button class="btn btn-sm" type="button" id="settingsAdminHelp">获取管理权限 / 忘记 Token</button>' +
        '</div>' +
        '<p>管理 Token 不会显示在公网页。忘记 Token 时，可以点上面的按钮走咨询流程；正确密码只会告诉你 Token 在本机的位置和生成新 Token 的入口，<strong>不会把 Token 显示出来</strong>。</p>' +
        '<div class="settings-tip is-info">' + ico('info') + '<span>为什么不能显示 Token？公网页是公开静态页面，Token 一旦写进代码，任何人都能从源码或开发者工具拿走，后果是整个仓库和数据可能被删除或篡改。</span></div>';
    }
    if (key === 'faq') {
      return '<h4>公网页能直接添加效果图吗？</h4>' +
        '<p>可以，点右上角「添加链接」会进入管理模式，需要 GitHub Token；登录一次后会记住。保存后公网页会自动更新；普通访客没有 Token，只能看。</p>' +
        '<h4>日程过期会自动删除吗？</h4>' +
        '<p>会。公网页会先隐藏过期日程，GitHub 每天还会自动清理一次；日程按日期计算，过了当天就不再显示。</p>' +
        '<h4>保存后公网页没变化？</h4>' +
        '<p>先刷新公网页。数据通常几秒内生效；如果刚上传了新封面图，图片要等 GitHub Pages 部署约 1 分钟。仍不显示时按 <span class="settings-kbd">Ctrl</span> + <span class="settings-kbd">F5</span> 强制刷新。</p>' +
        '<h4>删除风格会把效果图删掉吗？</h4>' +
        '<p>不会。链接会移到「待分类」，图片文件也还在；公网页的待分类栏目可以继续看，管理页可以把链接移回其它风格。</p>' +
        '<h4>待分类可以删除或改名吗？</h4>' +
        '<p>不行，它是系统分类，用来接住被删风格的链接。普通风格可以新增和删除。</p>' +
        '<h4>日程在哪里改？</h4>' +
        '<p>在管理页「设计师日程」里添加、完成或删除；公网页只读展示，游客不能改。</p>' +
        '<h4>天气为什么有时慢？</h4>' +
        '<p>天气来自 Open-Meteo 公开接口，需要联网，通常 3~5 秒；网络不稳定时会显示提示，稍后刷新或换城市即可。</p>' +
        '<h4>风水内容准确吗？</h4>' +
        '<p>内容是传统民俗与居住经验整理，不是专业风水、结构、燃气或消防建议。采光、通风、消防和结构安全永远优先，不要为了方位拆改承重墙或管线。</p>' +
        '<h4>数据存在哪里？</h4>' +
        '<p>公网页数据在 GitHub 仓库 <code>Togetherggg/yingxiangtu</code> 的 <code>data/library.json</code>；本地版在 <code>C:\\效果图网址\\data\\library.json</code>；本地服务会保留备份，GitHub 也有每次保存的提交历史。</p>' +
        '<h4>手机和微信能打开吗？</h4>' +
        '<p>可以，公网页是 HTTPS 静态站点，手机浏览器和微信都可访问；把公网链接发过去即可。</p>' +
        '<h4>管理页的“密码”是什么？</h4>' +
        '<p>不是账号密码，是 GitHub Token。只有持有 Token 的人能进入管理页；Token 不要外发。</p>' +
        '<h4>本地版打不开？</h4>' +
        '<p>确认 <code>C:\\效果图网址\\效果图网址.exe</code> 存在，双击桌面「效果图网址」；如果被安全软件拦截，选择允许。</p>' +
        '<h4>发布很慢？</h4>' +
        '<p>数据 JSON 是快速通道；慢通常发生在图片文件需要 GitHub Pages 部署时。保存状态显示「已保存」就说明数据已提交，图片稍等即可。</p>';
    }
    return '<h4>效果图网址 · 风格灵感库</h4>' +
      '<p>一个按装修风格整理全景效果图链接的私人资料库，同时提供公网只读页、管理页和本地版。</p>' +
      '<div class="settings-split">' +
      '<div class="settings-mini"><b>公网页</b><span>任何人可看，手机/微信可开；只读。</span></div>' +
      '<div class="settings-mini"><b>管理页</b><span>只有 Token 持有者可改；链接、风格、日程。</span></div>' +
      '<div class="settings-mini"><b>本地版</b><span>Windows 桌面程序；批量编辑、预览、备份。</span></div>' +
      '<div class="settings-mini"><b>数据</b><span>GitHub 仓库 JSON；保存即提交，图片经 Pages 部署。</span></div>' +
      '</div>' +
      '<h4>当前入口</h4>' +
      '<p>公网页：<a href="' + P + '" target="_blank" rel="noopener">' + P + '</a></p>' +
      '<p>管理页：<a href="' + A + '" target="_blank" rel="noopener">' + A + '</a></p>' +
      '<p>本地版：<a href="' + TUTORIAL_URLS.local + '" target="_blank" rel="noopener">' + TUTORIAL_URLS.local + '</a></p>' +
      '<h4>设计说明</h4>' +
      '<p>公网页采用静态托管：浏览快、无需电脑常开；数据更新走 GitHub JSON 快速通道，图片由 GitHub Pages 部署。管理页不向公网页暴露 Token。</p>' +
      '<h4>关于我的表情包</h4>' +
      '<div class="settings-sticker-wrap"><img class="settings-sticker" src="assets/sticker-ai-600.png" alt="AI 打工仔表情包"><p>AI 打工仔 · 第 8 版了<br><span>收到，马上改！</span></p></div>' +
      '<div class="settings-version">教程版本：2026-10-24 · 公网页 v20261045 · 管理页 v14<br>如果页面还是旧版，按 Ctrl + F5 强制刷新。</div>';
  }

  function openSettingsModal() {
    const body = '<div class="life-tabs" id="settingsTabs">' +
      '<button type="button" data-settings="board" class="is-active">工作台</button>' +
      '<button type="button" data-settings="wallpaper">壁纸</button>' +
      '<button type="button" data-settings="guide">使用教程</button>' +
      '<button type="button" data-settings="admin">管理教程</button>' +
      '<button type="button" data-settings="faq">常见问题</button>' +
      '<button type="button" data-settings="about">关于</button></div>' +
      '<div class="settings-doc" id="settingsBody"></div>';
    const modal = openModal({
      title: '设置 / 使用教程',
      desc: '工作台显示 · 公网页 · 管理页 · 本地版',
      size: 'lg',
      body: body,
      footer: '<button class="btn" type="button" data-close>关闭</button>'
    });
    const tabs = $$('#settingsTabs button', modal.el);
    const box = $('#settingsBody', modal.el);
    function show(key) {
      tabs.forEach((b) => b.classList.toggle('is-active', b.dataset.settings === key));
      box.innerHTML = settingsContent(key);
      const sc = box.closest('.modal-body');
      if (sc) sc.scrollTop = 0;
      bindSettingsActions(box);
      bindBoardPrefsSettings(box);
      bindWallpaperSettings(box, show);
    }
    tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.settings)));
    show('board');
  }

  function bindWallpaperSettings(box, rerender) {
    const enabled = $('#wallpaperEnabled', box);
    if (!enabled) return;
    const syncTheme = () => $$('[data-wallpaper-theme]', box).forEach((b) => {
      b.classList.toggle('is-active', b.dataset.wallpaperTheme === wallpaperPrefs.theme);
    });
    const syncPick = () => $$('[data-wallpaper-pick]', box).forEach((b) => {
      const on = b.dataset.wallpaperPick === wallpaperPrefs.selected;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    enabled.addEventListener('change', () => {
      wallpaperPrefs.enabled = enabled.checked;
      saveWallpaperPrefs();
      applyWallpaper();
    });
    $$('[data-wallpaper-theme]', box).forEach((b) => b.addEventListener('click', () => {
      wallpaperPrefs.theme = b.dataset.wallpaperTheme;
      saveWallpaperPrefs();
      syncTheme();
      applyWallpaper();
    }));
    $$('[data-wallpaper-pick]', box).forEach((b) => b.addEventListener('click', () => {
      wallpaperPrefs.selected = b.dataset.wallpaperPick;
      wallpaperPrefs.rotate = false;
      wallpaperPrefs.enabled = true;
      enabled.checked = true;
      const rot = $('#wallpaperRotate', box);
      if (rot) rot.checked = false;
      saveWallpaperPrefs();
      syncPick();
      applyWallpaper();
    }));
    const rot = $('#wallpaperRotate', box);
    if (rot) rot.addEventListener('change', () => {
      wallpaperPrefs.rotate = rot.checked;
      saveWallpaperPrefs();
      applyWallpaper();
    });
    const dur = $('#wallpaperDuration', box);
    if (dur) dur.addEventListener('change', () => {
      const v = Number(dur.value);
      wallpaperPrefs.duration = WALLPAPER_DURATIONS.some((d) => d.value === v) ? v : 900;
      saveWallpaperPrefs();
      applyWallpaper();
    });

    const fileInput = $('#wallpaperFile', box);
    const pickBtn = $('#wallpaperPickFile', box);
    if (pickBtn && fileInput) pickBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', () => {
      const msg = $('#wallpaperAddMsg', box);
      const file = fileInput.files && fileInput.files[0];
      if (msg) msg.textContent = file ? '已选择：' + file.name : '支持 JPG / PNG；本地图片会压缩后只保存在当前浏览器。';
    });
    const addBtn = $('#wallpaperAdd', box);
    if (addBtn) addBtn.addEventListener('click', async () => {
      const S = window.YXGSecurity;
      const msg = $('#wallpaperAddMsg', box);
      let url = ($('#wallpaperUrl', box).value || '').trim();
      const title = ($('#wallpaperTitle', box).value || '').trim().slice(0, 30) || '自定义壁纸';
      const theme = $('#wallpaperThemeNew', box).value;
      const file = fileInput && fileInput.files ? fileInput.files[0] : null;
      if (S && !S.rateLimit('wallpaper-add', 10, 60 * 1000)) {
        if (msg) msg.textContent = '操作太频繁，请稍后再试。';
        S.log('rate', 'wallpaper-add');
        return;
      }
      if (!file && !url) { if (msg) msg.textContent = '请填写图片 URL 或上传本地图片。'; return; }
      if (!file) {
        const safe = S ? S.safeUrl(url) : url;
        if (!safe) {
          if (msg) msg.textContent = '图片 URL 需要是有效的 http:// 或 https:// 地址。';
          if (S) S.log('bad_url', url);
          return;
        }
        url = safe;
      }
      if (file && S) {
        const check = await S.isImageFile(file, 8 * 1024 * 1024);
        if (!check.ok) {
          if (msg) msg.textContent = check.reason;
          S.log('bad_file', check.reason + ' ' + file.name);
          return;
        }
      }
      addBtn.disabled = true;
      if (msg) msg.textContent = '处理中…';
      try {
        let src = url;
        let thumb = url;
        if (file) {
          const data = await compressWallpaperFile(file);
          src = data.src;
          thumb = data.thumb;
        }
        const wall = {
          id: 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          theme: theme,
          title: title,
          src: src,
          thumb: thumb,
          custom: true
        };
        customWallpapers.push(wall);
        if (!saveCustomWallpapers()) {
          customWallpapers.pop();
          if (msg) msg.textContent = '浏览器存储空间不足，换一张小一点的图片或先删除旧的自定义壁纸。';
          addBtn.disabled = false;
          return;
        }
        wallpaperPrefs.selected = wall.id;
        wallpaperPrefs.rotate = false;
        wallpaperPrefs.enabled = true;
        wallpaperPrefs.theme = 'all';
        saveWallpaperPrefs();
        applyWallpaper();
        if (rerender) rerender('wallpaper');
      } catch (err) {
        if (msg) msg.textContent = err.message || '添加失败，请换一张图片。';
        addBtn.disabled = false;
      }
    });
    $$('[data-wallpaper-del]', box).forEach((el) => el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = el.dataset.wallpaperDel;
      customWallpapers = customWallpapers.filter((w) => w.id !== id);
      saveCustomWallpapers();
      if (wallpaperPrefs.selected === id) {
        wallpaperPrefs.selected = 'w1';
        wallpaperPrefs.rotate = false;
        wallpaperPrefs.theme = 'all';
        saveWallpaperPrefs();
      }
      applyWallpaper();
      if (rerender) rerender('wallpaper');
    }));
  }

  function bindBoardPrefsSettings(box) {
    const inputs = $$('[data-board-pref]', box);
    if (!inputs.length) return;
    const master = $('#boardPrefMaster', box);
    const modules = inputs.filter((cb) => cb.id !== 'boardPrefMaster');
    const cfg = boardConfig();
    inputs.forEach((cb) => { cb.checked = cfg[cb.dataset.boardPref] !== false; });
    function sync() {
      const off = master && !master.checked;
      modules.forEach((cb) => { cb.disabled = off; });
    }
    sync();
    inputs.forEach((cb) => cb.addEventListener('change', () => {
      saveBoardPrefs({ [cb.dataset.boardPref]: cb.checked });
      sync();
      if (state.scope === 'home' && !state.query) renderHome();
    }));
    const reset = $('#boardPrefsReset', box);
    if (reset) reset.addEventListener('click', () => {
      boardPrefs = null;
      try { localStorage.removeItem('yxg.board.prefs'); } catch (e) {}
      const next = boardConfig();
      inputs.forEach((cb) => { cb.checked = next[cb.dataset.boardPref] !== false; });
      sync();
      if (state.scope === 'home' && !state.query) renderHome();
    });
  }

  function bindSettingsActions(box) {
    const help = $('#settingsAdminHelp', box);
    if (help) help.addEventListener('click', openAdminHelp);
    const modeBtn = $('#settingsAdminMode', box);
    if (modeBtn) modeBtn.addEventListener('click', openAdminMode);
  }

  function openAdminMode(focus) {
    const mode = $('#adminMode');
    const frame = $('#adminFrame');
    if (!mode || !frame) return;
    const loading = $('#adminModeLoading');
    if (loading) loading.hidden = false;
    frame.onload = () => { if (loading) loading.hidden = true; };
    frame.src = 'admin.html?v=14&embed=1' + (focus ? '&focus=' + encodeURIComponent(focus) : '') + '&t=' + Date.now();
    mode.hidden = false;
    document.body.classList.add('admin-mode-open');
    setTimeout(() => { const btn = $('#adminModeClose'); if (btn) btn.focus(); }, 60);
  }

  function closeAdminMode() {
    const mode = $('#adminMode');
    const frame = $('#adminFrame');
    if (!mode || mode.hidden) return;
    mode.hidden = true;
    document.body.classList.remove('admin-mode-open');
    if (frame) frame.src = 'about:blank';
    if (state.mode === 'public') refreshPublicLibrary();
    else if (state.mode === 'api') syncFromServer();
  }

  function bindAdminMode() {
    const open = $('#adminModeBtn');
    if (open) open.addEventListener('click', openAdminMode);
    const close = $('#adminModeClose');
    if (close) close.addEventListener('click', closeAdminMode);
    const mode = $('#adminMode');
    if (!mode) return;
    window.addEventListener('message', (e) => {
      if (e.origin !== location.origin) return;
      if (e.data && e.data.type === 'yxg-admin-saved') {
        if (state.mode === 'public') refreshPublicLibrary();
        else if (state.mode === 'api') syncFromServer();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !mode.hidden) closeAdminMode();
    });
  }

  function openAdminHelp() {
    let attempts = 0;
    const A = TUTORIAL_URLS.admin;
    const body = '<div class="settings-doc">' +
      '<p>管理 Token 不会显示在公网页。这里只能验证咨询密码，查看 Token 在本机的位置和管理入口。</p>' +
      '<div class="settings-tip is-info">' + ico('info') + '<span>Token 是仓库写权限，公开页面绝不能放；否则任何人都能拿走并删除数据。</span></div>' +
      '<div class="field"><label class="field-label" for="helpPass">咨询密码</label>' +
      '<input class="input" id="helpPass" type="password" autocomplete="off" placeholder="输入咨询密码"></div>' +
      '<div class="field-msg" id="helpMsg"></div>' +
      '<div id="helpResult"></div>' +
      '<div class="settings-tip" id="helpContact" hidden>' + ico('alert') + '<span>密码错误次数过多。请加管理员微信获取密码 / 管理权限：<a href="tel:13868214913">13868214913</a>（微信同号）。</span></div>' +
      '</div>';
    const modal = openModal({
      title: '管理权限 / 忘记 Token',
      desc: '验证咨询密码，查看本机 Token 位置；不会显示 Token',
      size: 'sm',
      body: body,
      footer: '<button class="btn" type="button" data-close>取消</button><button class="btn btn-primary" type="button" id="helpOk">验证</button>'
    });
    const input = $('#helpPass', modal.el);
    const msg = $('#helpMsg', modal.el);
    const ok = $('#helpOk', modal.el);
    const result = $('#helpResult', modal.el);
    const contact = $('#helpContact', modal.el);
    function fail() {
      attempts++;
      if (attempts >= 3) {
        msg.textContent = '密码错误次数过多，已锁定。';
        msg.style.color = 'var(--fail)';
        contact.hidden = false;
        input.disabled = true;
        ok.disabled = true;
        if (window.YXGSecurity) YXGSecurity.log('rate', 'help-password-locked');
      } else {
        msg.textContent = '密码错误，还可尝试 ' + (3 - attempts) + ' 次。';
        msg.style.color = 'var(--fail)';
        if (window.YXGSecurity) YXGSecurity.log('login', 'help-password');
      }
      input.select();
    }
    function verify() {
      if (input.value.trim() !== '00000000') { fail(); return; }
      attempts = 0;
      msg.textContent = '密码正确。Token 不在公网页，无法在这里显示。';
      msg.style.color = 'var(--ok)';
      contact.hidden = true;
      result.innerHTML = '<div class="settings-tip is-info">' + ico('info') + '<span>请在自己电脑上打开管理页：<a href="' + A + '" target="_blank" rel="noopener">' + A + '</a></span></div>' +
        '<p>Token 在本机 <code>C:\\效果图网址\\data\\github.json</code>；桌面「效果图管理」快捷方式会自动登录。</p>' +
        '<p>需要新的 Token：<a href="https://github.com/settings/tokens/new?scopes=repo&description=yingxiangtu-deploy" target="_blank" rel="noopener">去 GitHub 生成</a>（需要 GitHub 登录和密码）。</p>';
      input.disabled = true;
      ok.disabled = true;
    }
    ok.addEventListener('click', verify);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') verify(); });
    setTimeout(() => input.focus(), 80);
  }

  function bindEvents() {
    $('#themeBtn').addEventListener('click', () => {
      const root = document.documentElement;
      root.classList.add('theme-anim');
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
      clearTimeout(window.__themeAnimT);
      window.__themeAnimT = setTimeout(() => root.classList.remove('theme-anim'), 520);
    });
    $('#phoneBtn').addEventListener('click', openPhoneModal);
    $('#lifeBtn').addEventListener('click', openLifeModal);
    $('#settingsBtn').addEventListener('click', openSettingsModal);
    $('#addBtn').addEventListener('click', () => {
      if (state.readOnly) { openAdminMode('add'); return; }
      openForm('add');
    });
    $('#brandBtn').addEventListener('click', (e) => {
      e.preventDefault();
      setScope('home');
    });

    $('#searchInput').addEventListener('input', doSearch);
    $('#searchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); clearSearch(); }
    });
    $('#searchClear').addEventListener('click', clearSearch);

    $$('.nav-item[data-scope]').forEach((el) => el.addEventListener('click', () => setScope(el.dataset.scope)));

    $('#catList').addEventListener('click', (e) => {
      const kebab = e.target.closest('[data-kebab]');
      if (kebab) { e.stopPropagation(); openCatMenu(kebab, kebab.dataset.kebab); return; }
      const item = e.target.closest('[data-scope]');
      if (item) setScope(item.dataset.scope);
    });
    $('#catList').addEventListener('keydown', (e) => {
      const item = e.target.closest('[data-scope]');
      if (item && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setScope(item.dataset.scope); }
    });

    $('#newCatBtn').addEventListener('click', () => openCategoryForm(null));

    $$('.segmented button[data-view]').forEach((btn) => btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      try { localStorage.setItem(LS.view, state.view); } catch (e) {}
      $$('.segmented button[data-view]').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderContent(true);
    }));

    $('#sortSel').addEventListener('change', () => {
      state.sort = $('#sortSel').value;
      try { localStorage.setItem(LS.sort, state.sort); } catch (e) {}
      renderHead();
      renderContent(true);
    });

    document.addEventListener('click', (e) => {
      const addcat = e.target.closest('[data-addcat]');
      if (addcat) { e.stopPropagation(); openForm('add', null, addcat.dataset.addcat); return; }
      const tile = e.target.closest('#content .style-tile[data-scope]');
      if (tile) { e.preventDefault(); setScope(tile.dataset.scope); return; }
      const btn = e.target.closest('#content [data-act]');
      if (btn) {
        const holder = btn.closest('[data-id]');
        if (holder) { e.stopPropagation(); e.preventDefault(); handleAction(btn.dataset.act, findLink(holder.dataset.id)); }
        return;
      }
      const card = e.target.closest('#content [data-id]');
      if (card) openLink(findLink(card.dataset.id));
    });

    $('#content').addEventListener('keydown', (e) => {
      const holder = e.target.closest('[data-id]');
      if (!holder) return;
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('[data-act]')) return;
        e.preventDefault();
        openLink(findLink(holder.dataset.id));
      } else if ((e.key === 'e' || e.key === 'E') && !state.readOnly) {
        e.preventDefault();
        openForm('edit', findLink(holder.dataset.id));
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !state.readOnly) {
        e.preventDefault();
        actDelete(findLink(holder.dataset.id));
      }
    });

    $('#dataBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      openMenu(e.currentTarget, [
        { head: '数据管理' },
        { icon: 'download', label: '导出备份', onClick: exportBackup },
        { icon: 'upload', label: '导入备份', onClick: () => $('#importFile').click() },
        { icon: 'shield', label: '数据体检', onClick: openHealth },
        { icon: 'phone', label: '手机 / 微信访问', onClick: openPhoneModal },
        { icon: 'globe', label: '公网分享（临时链接）', onClick: openPublicShare },
        { icon: 'external', label: '打开永久公网站', onClick: openPermanentSite },
        { icon: 'folder', label: '打开数据文件夹', onClick: openDataFolder },
        '-',
        { icon: 'refresh', label: '恢复内置数据', danger: true, onClick: resetSeed }
      ]);
    });

    $('#importFile').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) importBackupFile(f);
    });

    $('#modeChip').addEventListener('click', openHelp);
    $$('[data-open]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.open === 'health') openHealth();
      else if (b.dataset.open === 'phone') openPhoneModal();
      else openHelp();
    }));

    document.addEventListener('keydown', (e) => {
      if (modalStack.length) return;
      const el = document.activeElement;
      const inField = el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); focusSearch(); return; }
      if (inField) return;
      if (state.readOnly) return;
      if (e.key === 'n' || e.key === 'N') { if (!e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); openForm('add'); } }
      else if (e.key === 'Escape') { if (state.query) clearSearch(); }
      else if (e.key === '?') { e.preventDefault(); openHelp(); }
      else if (e.key === '/') { e.preventDefault(); focusSearch(); }
    });

    window.addEventListener('resize', debounce(closeMenu, 120));
  }

  async function openDataFolder() {
    if (state.mode !== 'api') {
      toast('本地模式的备份请用「导出备份」保存', { type: 'warn', duration: 3600 });
      return;
    }
    try {
      await api.call('api/reveal', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' }, timeout: 4000 });
    } catch (e) {
      toast('无法打开数据文件夹', { type: 'warn' });
    }
  }

  /* ---------------------------------------------------------------- 启动 */
  async function boot() {
    applyTheme(localStorage.getItem(LS.theme) || 'dark');
    state.view = localStorage.getItem(LS.view) === 'list' ? 'list' : 'grid';
    state.sort = localStorage.getItem(LS.sort) || 'default';
    $('#sortSel').value = state.sort;
    $$('.segmented button[data-view]').forEach((b) => b.classList.toggle('is-active', b.dataset.view === state.view));

    // 旧版浏览器兜底
    if (!window.fetch || !window.Promise) {
      $('#content').innerHTML = '<div class="empty"><div class="empty-title">浏览器版本过低</div>' +
        '<div class="empty-desc">请使用 Windows 10 自带的 Edge 浏览器（或 Chrome / 百度浏览器最新版）打开本页面。</div></div>';
      return;
    }

    bindEvents();
    bindAdminMode();
    initWallpaper();
    renderContent(false);

    let lib = null;
    let needSave = false;
    try { lib = await loadData(); } catch (e) { lib = null; }

    if (lib) {
      state.lib = lib;
      if (mergeSeed(state.lib)) needSave = true;
    } else {
      state.lib = seedLibrary();
      needSave = true;
    }
    state.ready = true;
    if (needSave) await saveLibrary();
    renderAll(true);
    if (state.mode === 'api' || state.mode === 'public') {
      if (state.mode === 'api') {
        setInterval(() => { api.call('api/health', { timeout: 4000 }).catch(() => {}); }, 60000);
      }
      setInterval(syncFromServer, state.mode === 'public' ? 30000 : 15000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') syncFromServer();
      });
    }
    if (location.protocol === 'file:' && !state.readOnly) {
      setTimeout(() => {
        if (state.mode === 'local' && !localStorage.getItem('yingxiangtu.hint.local')) {
          try { localStorage.setItem('yingxiangtu.hint.local', '1'); } catch (e) {}
          toast('当前为本地模式，数据保存在本浏览器中', { type: 'warn', duration: 4200 });
        }
      }, 900);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
