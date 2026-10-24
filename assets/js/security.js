/* 前端安全防护与拦截记录（本机浏览器范围，不是全站 WAF） */
(function () {
  'use strict';

  var EVENTS_KEY = 'yxg.security.events.v1';
  var RATE_KEY = 'yxg.security.rate.v1';
  var MAX_EVENTS = 120;

  function readEvents() {
    try {
      var arr = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function writeEvents(arr) {
    try { localStorage.setItem(EVENTS_KEY, JSON.stringify(arr.slice(0, MAX_EVENTS))); } catch (e) {}
  }

  function log(type, detail) {
    var events = readEvents();
    events.unshift({
      t: Date.now(),
      type: String(type || 'blocked').slice(0, 30),
      detail: String(detail == null ? '' : detail).replace(/[\r\n]+/g, ' ').slice(0, 180)
    });
    writeEvents(events);
  }

  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function stats() {
    var events = readEvents();
    var today = dayKey(Date.now());
    var out = { total: events.length, today: 0, byType: {}, events: events };
    events.forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      if (dayKey(e.t) === today) out.today++;
      out.byType[e.type] = (out.byType[e.type] || 0) + 1;
    });
    return out;
  }

  function safeUrl(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s || /[\u0000-\u001f\u007f]/.test(s)) return '';
    try {
      var u = new URL(s, location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      if (!u.hostname) return '';
      return u.href;
    } catch (e) { return ''; }
  }

  function isImageFile(file, maxBytes) {
    if (!file) return Promise.resolve({ ok: false, reason: '没有选择文件' });
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type || '')) {
      return Promise.resolve({ ok: false, reason: '只支持 JPG / PNG / WEBP 图片' });
    }
    var limit = maxBytes || 8 * 1024 * 1024;
    if (file.size > limit) {
      return Promise.resolve({ ok: false, reason: '图片不能超过 ' + Math.round(limit / 1024 / 1024) + 'MB' });
    }
    return file.slice(0, 12).arrayBuffer().then(function (buf) {
      var b = new Uint8Array(buf);
      var jpeg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
      var png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
      var webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
      if (jpeg || png || webp) return { ok: true, kind: jpeg ? 'jpeg' : png ? 'png' : 'webp' };
      return { ok: false, reason: '文件内容不是有效图片' };
    }).catch(function () {
      return { ok: false, reason: '图片读取失败' };
    });
  }

  function rateLimit(key, max, windowMs) {
    var now = Date.now();
    var store = {};
    try { store = JSON.parse(localStorage.getItem(RATE_KEY) || '{}') || {}; } catch (e) { store = {}; }
    var arr = (Array.isArray(store[key]) ? store[key] : []).filter(function (t) { return now - t < windowMs; });
    if (arr.length >= max) {
      store[key] = arr;
      try { localStorage.setItem(RATE_KEY, JSON.stringify(store)); } catch (e) {}
      return false;
    }
    arr.push(now);
    store[key] = arr;
    try { localStorage.setItem(RATE_KEY, JSON.stringify(store)); } catch (e) {}
    return true;
  }

  function clear() {
    writeEvents([]);
  }

  window.YXGSecurity = {
    log: log,
    stats: stats,
    safeUrl: safeUrl,
    isImageFile: isImageFile,
    rateLimit: rateLimit,
    clear: clear
  };

  document.addEventListener('securitypolicyviolation', function (e) {
    log('csp', (e.violatedDirective || '') + ' ' + (e.blockedURI || ''));
  });
})();
