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

  function normalizeLibrary(raw, opts) {
    const lib = {
      version: 1,
      updatedAt: new Date().toISOString(),
      categories: [],
      links: [],
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
        order: Number.isFinite(c.order) ? c.order : lib.categories.length
      });
    });
    if (!lib.categories.length) {
      lib.categories.push({ id: 'c1', name: '未分类', color: PALETTE[0], order: 0 });
    }

    if (Array.isArray(raw.tombstones)) {
      lib.tombstones = raw.tombstones.filter((u) => typeof u === 'string').slice(0, 5000);
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
        order: Number.isFinite(l.order) ? l.order : i
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

  async function loadData() {
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
      const kebab = state.readOnly ? '' :
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

  function renderHome() {
    const cats = sortedCategories();
    const links = state.lib.links;
    let i = 0;
    const tiles = cats.map((c) => {
      const own = links.filter((l) => l.categoryId === c.id);
      const cover = own.filter((l) => l.thumb)[0];
      const sites = [];
      own.forEach((l) => { const s = siteOf(l); if (sites.indexOf(s) < 0) sites.push(s); });
      const meta = !own.length ? '暂无链接，点击添加'
        : sites.length <= 2 ? sites.join(' · ')
        : sites[0] + ' 等 ' + sites.length + ' 个来源';
      return '<button class="style-tile" type="button" data-scope="' + esc(c.id) + '" style="--c:' + esc(c.color) + ';--d:' + Math.min(i++, 12) * 35 + 'ms" aria-label="查看 ' + esc(c.name) + '（' + own.length + ' 条）">' +
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
    content.innerHTML = '<div class="style-grid">' + tiles + addTile + '</div>';
    bindImages(content);
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
        (isEdit ? '<div class="form-tip is-warn">' + ico('alert') + '<span>删除风格会同时删除其下的 ' + state.lib.links.filter((l) => l.categoryId === curr.id).length + ' 条链接。</span></div>' : '');
      const modal = openModal({
        title: isEdit ? '编辑风格' : '新建风格',
        desc: isEdit ? '修改名称或标记颜色。' : '新建一种装修风格，之后添加链接时即可选择。',
        size: 'sm',
        body: body,
        footer: (isEdit ? '<button class="btn btn-ghost" type="button" id="catDel" style="margin-right:auto;color:#ff8ea0">删除风格</button>' : '') +
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
          if (state.lib.categories.length <= 1) { toast('至少保留一个风格分类', { type: 'warn' }); return; }
          const n = state.lib.links.filter((l) => l.categoryId === curr.id).length;
          const yes = await confirmDialog({
            title: '删除风格「' + curr.name + '」？',
            desc: n ? '该风格下的 ' + n + ' 条效果图会一并删除。' : '该风格下暂无效果图。',
            confirmText: '删除',
            danger: true
          });
          if (!yes) return;
          state.lib.links.filter((l) => l.categoryId === curr.id).forEach((l) => {
            if (state.lib.tombstones.indexOf(l.url) < 0) state.lib.tombstones.push(l.url);
          });
          state.lib.links = state.lib.links.filter((l) => l.categoryId !== curr.id);
          state.lib.categories = state.lib.categories.filter((c) => c.id !== curr.id);
          if (state.scope === curr.id) state.scope = 'home';
          await saveLibrary();
          modal.close(true);
          renderAll();
          toast('风格已删除');
          resolve(null);
        });
      }
    });
  }

  function openCatMenu(anchor, catId) {
    if (state.readOnly) return;
    const cat = catOf(catId);
    if (!cat) return;
    openMenu(anchor, [
      { icon: 'edit', label: '编辑风格', onClick: () => openCategoryForm(cat) },
      { icon: 'trash', label: '删除风格', danger: true, onClick: async () => {
          if (state.lib.categories.length <= 1) { toast('至少保留一个风格分类', { type: 'warn' }); return; }
          const n = state.lib.links.filter((l) => l.categoryId === catId).length;
          const yes = await confirmDialog({
            title: '删除风格「' + cat.name + '」？',
            desc: n ? '该风格下的 ' + n + ' 条效果图会一并删除。' : '该风格下暂无效果图。',
            confirmText: '删除',
            danger: true
          });
          if (!yes) return;
          state.lib.links.filter((l) => l.categoryId === catId).forEach((l) => {
            if (state.lib.tombstones.indexOf(l.url) < 0) state.lib.tombstones.push(l.url);
          });
          state.lib.links = state.lib.links.filter((l) => l.categoryId !== catId);
          state.lib.categories = state.lib.categories.filter((c) => c.id !== catId);
          if (state.scope === catId) state.scope = 'home';
          await saveLibrary();
          renderAll();
          toast('风格已删除');
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

  function bindEvents() {
    $('#themeBtn').addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
    $('#phoneBtn').addEventListener('click', openPhoneModal);
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
