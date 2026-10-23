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
      })).filter((e) => e.title).slice(0, 500);
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
      toast(state.readOnly ? '分享内容已更新' : '已同步其他设备上的修改', { duration: 2200 });
    } catch (e) { /* 静默失败，下一次再试 */ }
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
    const upcoming = sortedSchedule().filter((e) => !e.done && e.date >= todayStr).slice(0, 4);
    const eventsHtml = upcoming.length ? upcoming.map((e) => {
      const color = ({ '量房': '#4FC3F7', '方案': '#8A7CFF', '施工': '#F2B8B5', '客户': '#5FD3B4', '其他': '#9AA7B8' })[e.type] || '#9AA7B8';
      const isToday = e.date === todayStr;
      return '<div class="db-event"><span class="db-ev-time">' + esc(e.time || '全天') + '</span>' +
        '<span class="db-ev-main"><b>' + esc(e.title) + '</b><small>' + (isToday ? '今天' : scheduleDateLabel(e.date)) + (e.note ? ' · ' + esc(e.note) : '') + '</small></span>' +
        '<span class="db-ev-type" style="color:' + color + ';border-color:' + color + '33;background:' + color + '12">' + esc(e.type) + '</span></div>';
    }).join('') : '<div class="db-empty">还没有日程<br><span>在管理页「设计师日程」里添加</span></div>';

    return '<section class="designer-board" aria-label="设计师工作台">' +
      '<div class="db-card db-schedule"><div class="db-head"><div><span class="db-kicker">DESIGNER DESK</span><h3>设计师日程</h3></div><button class="db-link" type="button" id="boardScheduleAll">全部日程 →</button></div>' +
        '<div class="db-date">' + now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · ' + week[now.getDay()] + '</div>' +
        '<div class="db-events">' + eventsHtml + '</div></div>' +
      '<div class="db-card db-weather"><div class="db-head"><div><span class="db-kicker">WEATHER</span><h3>天气</h3></div><button class="db-link" type="button" id="boardWeatherOpen">7 天 →</button></div>' +
        '<div id="boardWeather" class="db-weather-body"><div class="db-loading">天气加载中…</div></div></div>' +
      '<div class="db-card db-cal"><div class="db-head"><div><span class="db-kicker">CALENDAR</span><h3>日历</h3></div><button class="db-link" type="button" id="boardCalendarOpen">打开 →</button></div><div id="boardCal"></div></div>' +
      '<div class="db-card db-fs"><div class="db-head"><div><span class="db-kicker">FENG SHUI</span><h3>风水参考</h3></div><button class="db-link" type="button" id="boardFsOpen">详细 →</button></div>' +
        '<p class="db-fs-tip">' + esc(fengShuiTip()) + '</p><div class="db-fs-note">传统民俗参考，居住舒适与安全优先</div></div>' +
      '</section>';
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
      '<div class="life-note">日程由管理页「设计师日程」维护；这里只读展示，量房 / 方案 / 施工 / 客户都能记录。</div>';
    openModal({
      title: dateFilter ? '设计师日程 · ' + scheduleDateLabel(dateFilter) : '设计师日程',
      desc: '量房、方案、施工、客户与备忘',
      size: 'md',
      body: body,
      footer: '<button class="btn" type="button" data-close>关闭</button>'
    });
  }

  function openLifeModal(initialTab) {
    const body = '<div class="life-tabs" id="lifeTabs">' +
      '<button type="button" data-life="calendar" class="is-active">日历</button>' +
      '<button type="button" data-life="weather">天气</button>' +
      '<button type="button" data-life="fengshui">风水参考</button></div>' +
      '<div class="life-body" id="lifeBody"></div>';
    const modal = openModal({
      title: '生活参考',
      desc: '日历 · 国内天气 · 风水（传统民俗参考）',
      size: 'lg',
      body: body,
      footer: '<button class="btn" type="button" data-close>关闭</button>'
    });
    const tabs = $$('#lifeTabs button', modal.el);
    const box = $('#lifeBody', modal.el);
    function show(tab) {
      tabs.forEach((b) => b.classList.toggle('is-active', b.dataset.life === tab));
      if (tab === 'calendar') renderLifeCalendar(box);
      else if (tab === 'weather') renderLifeWeather(box);
      else renderLifeFengShui(box);
    }
    tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.life)));
    show(initialTab || 'calendar');
  }

  const TUTORIAL_URLS = {
    public: 'https://togetherggg.github.io/yingxiangtu/',
    admin: 'https://togetherggg.github.io/yingxiangtu/admin.html?v=8',
    local: 'http://127.0.0.1:51888/'
  };

  function settingsContent(key) {
    const A = TUTORIAL_URLS.admin;
    const P = TUTORIAL_URLS.public;
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
        '<h4>首页「设计师工作台」</h4>' +
        '<ul>' +
        '<li><strong>设计师日程</strong>：显示最近 4 条未完成日程；点「全部日程 →」看完整日程；日历上有圆点的日期表示当天有安排，点日期可看当天日程。</li>' +
        '<li><strong>天气</strong>：显示当前天气和未来 3 天；点「7 天 →」打开完整预报，可切换 14 个国内城市，默认丽水。</li>' +
        '<li><strong>日历</strong>：本月迷你日历，今天高亮，上/下月切换；点「打开 →」进入大日历。</li>' +
        '<li><strong>风水参考</strong>：每天一条小提示；点「详细 →」查看 15 个板块的完整内容。属于传统民俗与居住经验参考。</li>' +
        '</ul>' +
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
        '<a class="btn btn-primary btn-sm" href="' + A + '" target="_blank" rel="noopener">打开管理页</a>' +
        '<button class="btn btn-sm" type="button" id="settingsAdminHelp">获取管理权限 / 忘记 Token</button>' +
        '</div>' +
        '<p>管理 Token 不会显示在公网页。忘记 Token 时，可以点上面的按钮走咨询流程；正确密码只会告诉你 Token 在本机的位置和生成新 Token 的入口，<strong>不会把 Token 显示出来</strong>。</p>' +
        '<div class="settings-tip is-info">' + ico('info') + '<span>为什么不能显示 Token？公网页是公开静态页面，Token 一旦写进代码，任何人都能从源码或开发者工具拿走，后果是整个仓库和数据可能被删除或篡改。</span></div>';
    }
    if (key === 'faq') {
      return '<h4>保存后公网页没变化？</h4>' +
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
      '<div class="settings-sticker-wrap"><img class="settings-sticker" src="assets/sticker-ai.png" alt="AI 打工仔表情包"><p>AI 打工仔 · 第 8 版了<br><span>收到，马上改！</span></p></div>' +
      '<div class="settings-version">教程版本：2026-10-24 · 公网页 v20261027 · 管理页 v8<br>如果页面还是旧版，按 Ctrl + F5 强制刷新。</div>';
  }

  function openSettingsModal() {
    const body = '<div class="life-tabs" id="settingsTabs">' +
      '<button type="button" data-settings="guide" class="is-active">使用教程</button>' +
      '<button type="button" data-settings="admin">管理教程</button>' +
      '<button type="button" data-settings="faq">常见问题</button>' +
      '<button type="button" data-settings="about">关于</button></div>' +
      '<div class="settings-doc" id="settingsBody"></div>';
    const modal = openModal({
      title: '设置 / 使用教程',
      desc: '公网页 · 管理页 · 本地版，一份就能看懂',
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
    }
    tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.settings)));
    show('guide');
  }

  function bindSettingsActions(box) {
    const help = $('#settingsAdminHelp', box);
    if (help) help.addEventListener('click', openAdminHelp);
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
      } else {
        msg.textContent = '密码错误，还可尝试 ' + (3 - attempts) + ' 次。';
        msg.style.color = 'var(--fail)';
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
    $('#themeBtn').addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
    $('#phoneBtn').addEventListener('click', openPhoneModal);
    $('#lifeBtn').addEventListener('click', openLifeModal);
    $('#settingsBtn').addEventListener('click', openSettingsModal);
    $('#addBtn').addEventListener('click', () => openForm('add'));
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
