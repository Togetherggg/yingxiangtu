/* 快速水印：本地 Canvas 处理，PNG/JPG 输入，PSD 读取合层预览；导出 PNG/JPG */
(function () {
  'use strict';

  var WM = {
    base: null,
    baseName: '',
    baseKind: '',
    logo: null,
    logoName: '',
    type: 'text',
    text: '效果图网址',
    size: 5,
    color: '#ffffff',
    opacity: 55,
    rotate: 0,
    bold: true,
    shadow: true,
    logoSize: 20,
    pos: 'br',
    freeX: null,
    freeY: null,
    guideX: null,
    guideY: null,
    tile: false,
    format: 'png',
    quality: 90
  };
  var overlay = null;
  var scheduled = false;
  var psdPromise = null;

  function $(id) { return document.getElementById(String(id).replace(/^#/, '')); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function log(type, detail) {
    if (window.YXGSecurity) window.YXGSecurity.log(type, detail);
  }

  function loadPsdLib() {
    if (window.agPsd) return Promise.resolve(window.agPsd);
    if (psdPromise) return psdPromise;
    psdPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'assets/js/ag-psd.js';
      s.onload = function () { resolve(window.agPsd); };
      s.onerror = function () { reject(new Error('PSD 解析库加载失败，请刷新重试')); };
      document.head.appendChild(s);
    });
    return psdPromise;
  }

  function detectKind(file) {
    return file.slice(0, 12).arrayBuffer().then(function (buf) {
      var b = new Uint8Array(buf);
      if (b[0] === 0x38 && b[1] === 0x42 && b[2] === 0x50 && b[3] === 0x53) return 'psd'; // 8BPS
      if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
      if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
      if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
      return '';
    });
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片无法读取')); };
      img.src = url;
    });
  }

  function readPsd(file) {
    return loadPsdLib().then(function (lib) {
      return file.arrayBuffer().then(function (buf) {
        var psd = lib.readPsd(buf, { skipLayerImageData: true, skipThumbnail: true, logMissingFeatures: false });
        if (!psd || !psd.canvas) throw new Error('这个 PSD 没有可读取的合层预览');
        return psd.canvas;
      });
    });
  }

  function setStatus(text, color) {
    var el = $('#wmStatus');
    if (!el) return;
    el.textContent = text;
    el.style.color = color || '';
  }

  function setBaseFromCanvas(canvas, name, kind) {
    WM.base = { canvas: canvas, width: canvas.width, height: canvas.height };
    WM.baseName = name;
    WM.baseKind = kind;
    var empty = $('#wmEmpty');
    var cv = $('#wmCanvas');
    if (empty) empty.hidden = true;
    if (cv) cv.hidden = false;
    setStatus(kind === 'psd' ? 'PSD 合层预览已读取（导出 PNG/JPG，不保留图层）' : '图片已载入', 'var(--ok)');
    resetHistory();
    scheduleRender();
  }

  function setBaseFile(file) {
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) {
      setStatus('文件不能超过 60MB', 'var(--warn)');
      log('bad_file', 'watermark base oversize ' + file.name);
      return;
    }
    setStatus('正在读取图片…');
    detectKind(file).then(function (kind) {
      if (!kind) throw new Error('只支持 PNG / JPG / PSD');
      if (kind === 'psd') {
        setStatus('正在加载 PSD 解析库…');
        return readPsd(file).then(function (canvas) { setBaseFromCanvas(canvas, file.name, 'psd'); });
      }
      return loadImage(file).then(function (img) {
        WM.base = { img: img, width: img.naturalWidth, height: img.naturalHeight };
        WM.baseName = file.name;
        WM.baseKind = kind;
        var empty = $('#wmEmpty');
        var cv = $('#wmCanvas');
        if (empty) empty.hidden = true;
        if (cv) cv.hidden = false;
        setStatus('图片已载入', 'var(--ok)');
        resetHistory();
        scheduleRender();
      });
    }).catch(function (e) {
      setStatus(e.message || '图片读取失败', 'var(--fail)');
      log('bad_file', 'watermark base ' + (e.message || ''));
    });
  }

  function setLogoFile(file) {
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      setStatus('水印图不能超过 30MB', 'var(--warn)');
      log('bad_file', 'watermark logo oversize ' + file.name);
      return;
    }
    detectKind(file).then(function (kind) {
      if (!kind) throw new Error('水印图只支持 PNG / JPG / PSD');
      if (kind === 'psd') {
        setStatus('正在读取 PSD 水印图…');
        return readPsd(file).then(function (canvas) {
          WM.logo = { canvas: canvas, width: canvas.width, height: canvas.height };
          WM.logoName = file.name;
          setStatus('PSD 水印图已载入', 'var(--ok)');
          resetHistory();
          scheduleRender();
        });
      }
      return loadImage(file).then(function (img) {
        WM.logo = { img: img, width: img.naturalWidth, height: img.naturalHeight };
        WM.logoName = file.name;
        setStatus('图片水印已载入', 'var(--ok)');
        resetHistory();
        scheduleRender();
      });
    }).catch(function (e) {
      setStatus(e.message || '水印图读取失败', 'var(--fail)');
      log('bad_file', 'watermark logo ' + (e.message || ''));
    });
  }

  function sourceSize(src) {
    return { w: src.canvas ? src.canvas.width : src.width, h: src.canvas ? src.canvas.height : src.height };
  }

  function sourceDrawable(src) {
    return src.canvas || src.img;
  }

  function posXY(pos, w, h, bw, bh, margin) {
    var x = bw / 2;
    var y = bh / 2;
    if (pos.indexOf('l') === 0) x = margin + w / 2;
    else if (pos.indexOf('r') === 0) x = bw - margin - w / 2;
    if (pos[0] === 't' || pos[0] === 'm' || pos[0] === 'b') {
      if (pos[0] === 't') y = margin + h / 2;
      else if (pos[0] === 'b') y = bh - margin - h / 2;
    }
    if (pos === 'tl' || pos === 'ml' || pos === 'bl') x = margin + w / 2;
    if (pos === 'tc' || pos === 'mc' || pos === 'bc') x = bw / 2;
    if (pos === 'tr' || pos === 'mr' || pos === 'br') x = bw - margin - w / 2;
    if (pos === 'tl' || pos === 'tc' || pos === 'tr') y = margin + h / 2;
    if (pos === 'ml' || pos === 'mc' || pos === 'mr') y = bh / 2;
    if (pos === 'bl' || pos === 'bc' || pos === 'br') y = bh - margin - h / 2;
    return { x: x, y: y };
  }

  function drawText(ctx, outW, outH) {
    var text = (WM.text || '').trim();
    if (!text) return;
    var size = Math.max(12, Math.round(outW * WM.size / 100));
    var font = (WM.bold ? '700 ' : '400 ') + size + 'px "Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif';
    ctx.font = font;
    var tw = Math.max(1, ctx.measureText(text).width);
    var th = size * 1.2;
    var margin = Math.round(outW * .035);
    ctx.globalAlpha = WM.opacity / 100;
    ctx.fillStyle = WM.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (WM.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur = Math.max(2, size * .12);
      ctx.shadowOffsetY = Math.max(1, size * .05);
    }
    var rot = WM.rotate * Math.PI / 180;
    function one(x, y) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    if (WM.tile) {
      var sx = tw + Math.max(40, outW * .09);
      var sy = th + Math.max(30, outH * .06);
      for (var y = sy / 2; y < outH + sy; y += sy) {
        for (var x = sx / 2; x < outW + sx; x += sx) one(x, y);
      }
    } else {
      var p = posXY(WM.pos, tw, th, outW, outH, margin);
      one(p.x, p.y);
    }
  }

  function logoMetrics(outW, outH) {
    var sw = WM.logo.width;
    var sh = WM.logo.height;
    var lw = Math.max(24, outW * WM.logoSize / 100);
    var lh = lw * sh / sw;
    if (lh > outH * .5) { lh = outH * .5; lw = lh * sw / sh; }
    return { w: lw, h: lh, margin: Math.round(outW * .035) };
  }

  function logoCenter(outW, outH) {
    var m = logoMetrics(outW, outH);
    if (WM.freeX != null && WM.freeY != null) {
      return { x: WM.freeX * outW, y: WM.freeY * outH, w: m.w, h: m.h, margin: m.margin };
    }
    var p = posXY(WM.pos, m.w, m.h, outW, outH, m.margin);
    return { x: p.x, y: p.y, w: m.w, h: m.h, margin: m.margin };
  }

  function drawLogo(ctx, outW, outH) {
    if (!WM.logo) return;
    var src = sourceDrawable(WM.logo);
    var m = logoMetrics(outW, outH);
    var lw = m.w;
    var lh = m.h;
    var margin = m.margin;
    ctx.globalAlpha = WM.opacity / 100;
    var rot = WM.rotate * Math.PI / 180;
    function one(x, y) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(src, -lw / 2, -lh / 2, lw, lh);
      ctx.restore();
    }
    if (WM.tile) {
      var sx = lw + Math.max(30, outW * .05);
      var sy = lh + Math.max(24, outH * .05);
      for (var y = sy / 2; y < outH + sy; y += sy) {
        for (var x = sx / 2; x < outW + sx; x += sx) one(x, y);
      }
    } else {
      var p = logoCenter(outW, outH);
      one(p.x, p.y);
    }
  }

  function drawGuides(ctx, outW, outH) {
    if (WM.guideX == null && WM.guideY == null) return;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(34,211,238,.9)';
    ctx.lineWidth = Math.max(1, outW / 1100);
    ctx.setLineDash([Math.max(5, outW * .012), Math.max(4, outW * .008)]);
    if (WM.guideX != null) {
      ctx.beginPath();
      ctx.moveTo(WM.guideX * outW, 0);
      ctx.lineTo(WM.guideX * outW, outH);
      ctx.stroke();
    }
    if (WM.guideY != null) {
      ctx.beginPath();
      ctx.moveTo(0, WM.guideY * outH);
      ctx.lineTo(outW, WM.guideY * outH);
      ctx.stroke();
    }
    ctx.restore();
  }

  function render() {
    scheduled = false;
    if (!WM.base) return;
    var src = WM.base.canvas || WM.base.img;
    var sw = sourceSize(WM.base);
    var scale = Math.min(1, 6000 / Math.max(sw.w, sw.h));
    var outW = Math.max(1, Math.round(sw.w * scale));
    var outH = Math.max(1, Math.round(sw.h * scale));
    var cv = $('#wmCanvas');
    if (!cv) return;
    cv.width = outW;
    cv.height = outH;
    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(src, 0, 0, outW, outH);
    ctx.save();
    if (WM.type === 'text') drawText(ctx, outW, outH);
    else drawLogo(ctx, outW, outH);
    ctx.restore();
    drawGuides(ctx, outW, outH);
    var dims = $('#wmDims');
    if (dims) dims.textContent = outW + ' × ' + outH + (WM.baseKind === 'psd' ? ' · PSD 预览' : '');
    var dl = $('#wmDownload');
    if (dl) dl.disabled = false;
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  }

  var HISTORY = [];
  var historyIndex = -1;
  var historyTimer = null;
  var applyingHistory = false;

  function snapshot() {
    return {
      type: WM.type, text: WM.text, size: WM.size, color: WM.color, opacity: WM.opacity,
      rotate: WM.rotate, bold: WM.bold, shadow: WM.shadow, logoSize: WM.logoSize,
      pos: WM.pos, freeX: WM.freeX, freeY: WM.freeY, tile: WM.tile
    };
  }

  function sameSnapshot(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function updateHistoryButtons() {
    var u = $('#wmUndo');
    var r = $('#wmRedo');
    if (u) u.disabled = historyIndex <= 0;
    if (r) r.disabled = historyIndex < 0 || historyIndex >= HISTORY.length - 1;
  }

  function resetHistory() {
    HISTORY = [snapshot()];
    historyIndex = 0;
    clearTimeout(historyTimer);
    updateHistoryButtons();
  }

  function commitHistory(immediate) {
    if (applyingHistory) return;
    clearTimeout(historyTimer);
    function push() {
      var s = snapshot();
      if (historyIndex >= 0 && sameSnapshot(HISTORY[historyIndex], s)) return;
      HISTORY = HISTORY.slice(0, historyIndex + 1);
      HISTORY.push(s);
      if (HISTORY.length > 60) HISTORY.shift();
      historyIndex = HISTORY.length - 1;
      updateHistoryButtons();
    }
    if (immediate) push();
    else historyTimer = setTimeout(push, 260);
  }

  function syncUI() {
    function val(id, v) { var e = $('#' + id); if (e) e.value = v; }
    function checked(id, v) { var e = $('#' + id); if (e) e.checked = !!v; }
    val('wmText', WM.text);
    val('wmSize', WM.size);
    val('wmColor', WM.color);
    val('wmOpacity', WM.opacity);
    val('wmRotate', WM.rotate);
    val('wmLogoSize', WM.logoSize);
    checked('wmBold', WM.bold);
    checked('wmShadow', WM.shadow);
    checked('wmTile', WM.tile);
    var labels = { wmSizeVal: WM.size + '%', wmOpacityVal: WM.opacity + '%', wmRotateVal: WM.rotate + '°', wmLogoSizeVal: WM.logoSize + '%' };
    Object.keys(labels).forEach(function (id) { var e = $('#' + id); if (e) e.textContent = labels[id]; });
    $$('#wmTabs [data-wmtype]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.wmtype === WM.type); });
    var tp = $('#wmTextPanel');
    var ip = $('#wmImagePanel');
    if (tp) tp.hidden = WM.type !== 'text';
    if (ip) ip.hidden = WM.type !== 'image';
    $$('#wmPos button').forEach(function (b) {
      b.classList.toggle('is-active', WM.freeX == null && b.dataset.pos === WM.pos);
    });
  }

  function applySnapshot(s) {
    applyingHistory = true;
    clearTimeout(historyTimer);
    Object.keys(s).forEach(function (k) { WM[k] = s[k]; });
    WM.guideX = WM.guideY = null;
    syncUI();
    render();
    applyingHistory = false;
    updateHistoryButtons();
  }

  function undo() {
    commitHistory(true);
    if (historyIndex <= 0) return;
    historyIndex--;
    applySnapshot(HISTORY[historyIndex]);
  }

  function redo() {
    if (historyIndex < 0 || historyIndex >= HISTORY.length - 1) return;
    historyIndex++;
    applySnapshot(HISTORY[historyIndex]);
  }

  function bindDrag() {
    var cv = $('#wmCanvas');
    if (!cv) return;
    var drag = null;
    function point(e) {
      var rect = cv.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(cv.width, (e.clientX - rect.left) / rect.width * cv.width)),
        y: Math.max(0, Math.min(cv.height, (e.clientY - rect.top) / rect.height * cv.height))
      };
    }
    cv.addEventListener('pointerdown', function (e) {
      if (WM.type !== 'image' || !WM.logo || WM.tile) return;
      var p = point(e);
      var c = logoCenter(cv.width, cv.height);
      var pad = Math.max(8, cv.width * .012);
      if (Math.abs(p.x - c.x) > c.w / 2 + pad || Math.abs(p.y - c.y) > c.h / 2 + pad) return;
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      cv.classList.add('is-dragging');
      drag = { id: e.pointerId };
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      e.preventDefault();
      var p = point(e);
      var nx = p.x / cv.width;
      var ny = p.y / cv.height;
      var snapsX = [0.5, 1 / 3, 2 / 3];
      var snapsY = [0.5, 1 / 3, 2 / 3];
      WM.guideX = null;
      WM.guideY = null;
      for (var i = 0; i < snapsX.length; i++) {
        if (Math.abs(nx - snapsX[i]) < (i === 0 ? .025 : .018)) { nx = snapsX[i]; WM.guideX = snapsX[i]; break; }
      }
      for (var j = 0; j < snapsY.length; j++) {
        if (Math.abs(ny - snapsY[j]) < (j === 0 ? .025 : .018)) { ny = snapsY[j]; WM.guideY = snapsY[j]; break; }
      }
      WM.freeX = Math.max(0, Math.min(1, nx));
      WM.freeY = Math.max(0, Math.min(1, ny));
      $$('#wmPos button').forEach(function (b) { b.classList.remove('is-active'); });
      render();
    });
    function end(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      drag = null;
      cv.classList.remove('is-dragging');
      WM.guideX = WM.guideY = null;
      render();
      commitHistory(true);
    }
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }

  var CV = { src: null, name: '', kind: '', natW: 0, natH: 0, format: 'png', quality: 90 };

  function convStatus(text, color) {
    var el = $('#wmConvStatus');
    if (!el) return;
    el.textContent = text;
    el.style.color = color || '';
  }

  function setConvFile(file) {
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) { convStatus('文件不能超过 60MB', 'var(--warn)'); return; }
    convStatus('正在读取图片…');
    detectKind(file).then(function (kind) {
      if (!kind) throw new Error('只支持 PNG / JPG / WebP / PSD');
      if (kind === 'psd') {
        convStatus('正在加载 PSD 解析库…');
        return readPsd(file).then(function (canvas) {
          CV = { src: canvas, name: file.name, kind: 'psd', natW: canvas.width, natH: canvas.height, format: CV.format, quality: CV.quality };
        });
      }
      return loadImage(file).then(function (img) {
        CV = { src: img, name: file.name, kind: kind, natW: img.naturalWidth, natH: img.naturalHeight, format: CV.format, quality: CV.quality };
      });
    }).then(function () {
      var cv = $('#wmConvCanvas');
      var empty = $('#wmConvEmpty');
      if (empty) empty.hidden = true;
      if (cv) cv.hidden = false;
      var w = $('#wmConvW');
      var h = $('#wmConvH');
      if (w) w.value = CV.natW;
      if (h) h.value = CV.natH;
      convStatus('已载入 · ' + CV.natW + ' × ' + CV.natH, 'var(--ok)');
      renderConv();
    }).catch(function (e) {
      convStatus(e.message || '读取失败', 'var(--fail)');
      log('bad_file', 'convert ' + (e.message || ''));
    });
  }

  function renderConv() {
    if (!CV.src) return;
    var sw = CV.src.canvas ? CV.src.canvas.width : CV.src.width;
    var sh = CV.src.canvas ? CV.src.canvas.height : CV.src.height;
    var scale = Math.min(1, 6000 / Math.max(sw, sh));
    var w = Math.max(1, Math.round(sw * scale));
    var h = Math.max(1, Math.round(sh * scale));
    var cv = $('#wmConvCanvas');
    if (!cv) return;
    cv.width = w;
    cv.height = h;
    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(CV.src.canvas || CV.src, 0, 0, w, h);
    var dims = $('#wmConvDims');
    if (dims) dims.textContent = CV.natW + ' × ' + CV.natH + (CV.kind === 'psd' ? ' · PSD 预览' : '');
  }

  function downloadConv() {
    if (!CV.src) { convStatus('先选择一张图片', 'var(--warn)'); return; }
    var w = Math.max(1, Math.min(12000, parseInt($('#wmConvW').value, 10) || CV.natW));
    var h = Math.max(1, Math.min(12000, parseInt($('#wmConvH').value, 10) || CV.natH));
    var fmt = CV.format;
    var out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    var ctx = out.getContext('2d');
    if (fmt === 'jpg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(CV.src.canvas || CV.src, 0, 0, w, h);
    out.toBlob(function (blob) {
      if (!blob) { convStatus('浏览器不支持这个导出格式', 'var(--fail)'); return; }
      var ext = fmt === 'jpg' ? 'jpg' : fmt;
      var name = (CV.name || 'image').replace(/\.[^.]+$/, '') + '-convert.' + ext;
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      convStatus('已导出 ' + name, 'var(--ok)');
    }, fmt === 'jpg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png', CV.quality / 100);
  }

  function bindConvert() {
    var input = $('#wmConvFile');
    var drop = $('#wmConvDrop');
    if (drop && input) {
      drop.addEventListener('click', function () { input.click(); });
      drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-drag'); });
      drop.addEventListener('dragleave', function () { drop.classList.remove('is-drag'); });
      drop.addEventListener('drop', function (e) {
        e.preventDefault();
        drop.classList.remove('is-drag');
        var f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) setConvFile(f);
      });
      input.addEventListener('change', function () {
        if (input.files && input.files[0]) setConvFile(input.files[0]);
        input.value = '';
      });
    }
    var fmt = $('#wmConvFormat');
    if (fmt) fmt.addEventListener('change', function () {
      CV.format = fmt.value;
      var q = $('#wmConvQualityWrap');
      if (q) q.hidden = fmt.value === 'png';
    });
    var q = $('#wmConvQuality');
    if (q) q.addEventListener('input', function () {
      CV.quality = +q.value;
      var o = $('#wmConvQualityVal');
      if (o) o.textContent = CV.quality + '%';
    });
    var w = $('#wmConvW');
    var h = $('#wmConvH');
    function keepRatio(from) {
      var keep = $('#wmConvKeep');
      if (!keep || !keep.checked || !CV.natW) return;
      if (from === 'w') {
        var nw = parseInt(w.value, 10);
        if (nw > 0) h.value = Math.max(1, Math.round(nw * CV.natH / CV.natW));
      } else {
        var nh = parseInt(h.value, 10);
        if (nh > 0) w.value = Math.max(1, Math.round(nh * CV.natW / CV.natH));
      }
    }
    if (w) w.addEventListener('input', function () { keepRatio('w'); });
    if (h) h.addEventListener('input', function () { keepRatio('h'); });
    var dl = $('#wmConvDownload');
    if (dl) dl.addEventListener('click', downloadConv);
  }

  function bind() {
    var close = $('#wmClose');
    if (close) close.addEventListener('click', closeTool);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeTool(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && !overlay.hidden) closeTool();
    });
    document.addEventListener('keydown', function (e) {
      if (!overlay || overlay.hidden) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    });

    $$('#wmModeTabs [data-wmmode]').forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.dataset.wmmode;
        $$('#wmModeTabs [data-wmmode]').forEach(function (x) { x.classList.toggle('is-active', x.dataset.wmmode === mode); });
        $('#wmWatermarkBody').hidden = mode !== 'watermark';
        $('#wmConvertBody').hidden = mode !== 'convert';
        var hist = document.querySelector('.wm-history');
        if (hist) hist.hidden = mode !== 'watermark';
      });
    });

    var undoBtn = $('#wmUndo');
    var redoBtn = $('#wmRedo');
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);
    bindDrag();
    bindConvert();

    var baseInput = $('#wmBaseFile');
    var drop = $('#wmDrop');
    if (drop && baseInput) {
      drop.addEventListener('click', function (e) {
        if (e.target.closest('canvas')) return;
        baseInput.click();
      });
      drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-drag'); });
      drop.addEventListener('dragleave', function () { drop.classList.remove('is-drag'); });
      drop.addEventListener('drop', function (e) {
        e.preventDefault();
        drop.classList.remove('is-drag');
        var f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) setBaseFile(f);
      });
      baseInput.addEventListener('change', function () {
        if (baseInput.files && baseInput.files[0]) setBaseFile(baseInput.files[0]);
        baseInput.value = '';
      });
    }

    $$('#wmTabs [data-wmtype]').forEach(function (b) {
      b.addEventListener('click', function () {
        WM.type = b.dataset.wmtype;
        $$('#wmTabs [data-wmtype]').forEach(function (x) { x.classList.toggle('is-active', x.dataset.wmtype === WM.type); });
        var tp = $('#wmTextPanel');
        var ip = $('#wmImagePanel');
        if (tp) tp.hidden = WM.type !== 'text';
        if (ip) ip.hidden = WM.type !== 'image';
        scheduleRender();
        commitHistory();
      });
    });

    function bindVal(id, key, fn) {
      var el = $('#' + id);
      if (!el) return;
      el.addEventListener('input', function () {
        WM[key] = fn ? fn(el) : el.value;
        scheduleRender();
        commitHistory();
      });
    }
    bindVal('wmText', 'text');
    bindVal('wmSize', 'size', function (el) { var v = +el.value; var o = $('#wmSizeVal'); if (o) o.textContent = v + '%'; return v; });
    bindVal('wmColor', 'color');
    bindVal('wmOpacity', 'opacity', function (el) { var v = +el.value; var o = $('#wmOpacityVal'); if (o) o.textContent = v + '%'; return v; });
    bindVal('wmRotate', 'rotate', function (el) { var v = +el.value; var o = $('#wmRotateVal'); if (o) o.textContent = v + '°'; return v; });
    bindVal('wmLogoSize', 'logoSize', function (el) { var v = +el.value; var o = $('#wmLogoSizeVal'); if (o) o.textContent = v + '%'; return v; });
    bindVal('wmQuality', 'quality', function (el) { var v = +el.value; var o = $('#wmQualityVal'); if (o) o.textContent = v + '%'; return v; });
    var bold = $('#wmBold');
    if (bold) bold.addEventListener('change', function () { WM.bold = bold.checked; scheduleRender(); commitHistory(); });
    var shadow = $('#wmShadow');
    if (shadow) shadow.addEventListener('change', function () { WM.shadow = shadow.checked; scheduleRender(); commitHistory(); });
    var tile = $('#wmTile');
    if (tile) tile.addEventListener('change', function () { WM.tile = tile.checked; scheduleRender(); commitHistory(); });
    var fmt = $('#wmFormat');
    if (fmt) fmt.addEventListener('change', function () {
      WM.format = fmt.value;
      var wrap = $('#wmQualityWrap');
      if (wrap) wrap.hidden = WM.format !== 'jpg' && WM.format !== 'webp';
    });

    $$('#wmPos button').forEach(function (b) {
      b.addEventListener('click', function () {
        WM.pos = b.dataset.pos;
        WM.freeX = WM.freeY = null;
        WM.guideX = WM.guideY = null;
        $$('#wmPos button').forEach(function (x) { x.classList.toggle('is-active', x.dataset.pos === WM.pos); });
        scheduleRender();
        commitHistory(true);
      });
    });

    var logoInput = $('#wmLogoFile');
    var logoPick = $('#wmLogoPick');
    if (logoPick && logoInput) {
      logoPick.addEventListener('click', function () { logoInput.click(); });
      logoInput.addEventListener('change', function () {
        if (logoInput.files && logoInput.files[0]) {
          setLogoFile(logoInput.files[0]);
          var st = $('#wmLogoStatus');
          if (st) st.textContent = logoInput.files[0].name;
        }
        logoInput.value = '';
      });
    }

    var dl = $('#wmDownload');
    if (dl) dl.addEventListener('click', download);
  }

  function download() {
    if (!WM.base) { setStatus('先选择一张图片', 'var(--warn)'); return; }
    WM.guideX = WM.guideY = null;
    render();
    var cv = $('#wmCanvas');
    if (!cv || !cv.width) return;
    var fmt = WM.format;
    var out = cv;
    if (fmt === 'jpg') {
      out = document.createElement('canvas');
      out.width = cv.width;
      out.height = cv.height;
      var ctx = out.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(cv, 0, 0);
    }
    out.toBlob(function (blob) {
      if (!blob) { setStatus('导出失败，请换一张图片', 'var(--fail)'); return; }
      var name = (WM.baseName || 'watermark').replace(/\.[^.]+$/, '') + '-watermark.' + fmt;
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      setStatus('已导出 ' + name, 'var(--ok)');
    }, fmt === 'jpg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png', WM.quality / 100);
  }

  function template() {
    return '<div class="wm-overlay" id="wmOverlay" hidden>' +
      '<div class="wm-modal" role="dialog" aria-modal="true" aria-label="图片工具">' +
      '<div class="wm-head"><div><h3>图片工具</h3><p>加水印 / 格式转换 · 本地处理，不上传服务器</p></div>' +
      '<div class="wm-history"><button type="button" id="wmUndo" title="上一步（Ctrl+Z）" disabled>↶</button><button type="button" id="wmRedo" title="下一步（Ctrl+Shift+Z）" disabled>↷</button></div>' +
      '<button class="wm-close" type="button" id="wmClose" aria-label="关闭">×</button></div>' +
      '<div class="wm-mode-tabs" id="wmModeTabs"><button type="button" data-wmmode="watermark" class="is-active">加水印</button><button type="button" data-wmmode="convert">格式转换</button></div>' +
      '<div class="wm-body" id="wmWatermarkBody">' +
      '<div class="wm-preview">' +
      '<div class="wm-drop" id="wmDrop"><input id="wmBaseFile" type="file" accept=".png,.jpg,.jpeg,.webp,.psd,image/png,image/jpeg,image/webp" hidden><div class="wm-empty" id="wmEmpty">点击或拖入图片<span>PNG / JPG / WebP / PSD</span></div><canvas id="wmCanvas" hidden></canvas></div>' +
      '<div class="wm-meta"><span id="wmStatus">选择图片开始</span><span id="wmDims"></span></div>' +
      '</div>' +
      '<div class="wm-controls">' +
      '<div class="wm-tabs" id="wmTabs"><button type="button" data-wmtype="text" class="is-active">文字水印</button><button type="button" data-wmtype="image">图片水印</button></div>' +
      '<div id="wmTextPanel">' +
      '<label class="wm-field">水印文字<input id="wmText" type="text" maxlength="40" value="效果图网址" autocomplete="off"></label>' +
      '<div class="wm-row"><label>字号 <input id="wmSize" type="range" min="1" max="20" value="5"><b id="wmSizeVal">5%</b></label><label>颜色 <input id="wmColor" type="color" value="#ffffff"></label></div>' +
      '<div class="wm-row"><label class="wm-check"><input id="wmBold" type="checkbox" checked> 加粗</label><label class="wm-check"><input id="wmShadow" type="checkbox" checked> 阴影</label></div>' +
      '</div>' +
      '<div id="wmImagePanel" hidden>' +
      '<div class="wm-logo-row"><button class="btn btn-sm" type="button" id="wmLogoPick">上传水印图片</button><input id="wmLogoFile" type="file" accept=".png,.jpg,.jpeg,.webp,.psd,image/png,image/jpeg,image/webp" hidden><span id="wmLogoStatus">PNG / JPG / WebP / PSD</span></div>' +
      '<div class="wm-row"><label>大小 <input id="wmLogoSize" type="range" min="5" max="60" value="20"><b id="wmLogoSizeVal">20%</b></label></div>' +
      '<p class="wm-drag-tip">图片水印可直接在左侧画布拖动；靠近中线/三分线会出现辅助线。</p>' +
      '</div>' +
      '<div class="wm-row"><label>透明度 <input id="wmOpacity" type="range" min="5" max="100" value="55"><b id="wmOpacityVal">55%</b></label><label>旋转 <input id="wmRotate" type="range" min="-45" max="45" value="0"><b id="wmRotateVal">0°</b></label></div>' +
      '<h4>水印方位</h4>' +
      '<div class="wm-pos" id="wmPos">' +
      '<button type="button" data-pos="tl">左上</button><button type="button" data-pos="tc">上中</button><button type="button" data-pos="tr">右上</button>' +
      '<button type="button" data-pos="ml">左中</button><button type="button" data-pos="mc">居中</button><button type="button" data-pos="mr">右中</button>' +
      '<button type="button" data-pos="bl">左下</button><button type="button" data-pos="bc">下中</button><button type="button" data-pos="br" class="is-active">右下</button>' +
      '</div>' +
      '<label class="wm-check"><input id="wmTile" type="checkbox"> 平铺水印</label>' +
      '<h4>导出</h4>' +
      '<div class="wm-row"><label>格式 <select id="wmFormat"><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option></select></label><label id="wmQualityWrap" hidden>质量 <input id="wmQuality" type="range" min="50" max="100" value="90"><b id="wmQualityVal">90%</b></label></div>' +
      '<button class="btn btn-primary" type="button" id="wmDownload">下载水印图片</button>' +
      '<p class="wm-note">PSD 会读取合层预览后加水印，导出 PNG/JPG/WebP，不会保留 PSD 图层。图片只在本机处理，不上传。</p>' +
      '</div></div>' +
      '<div class="wm-convert-body" id="wmConvertBody" hidden>' +
      '<div class="wm-preview">' +
      '<div class="wm-drop" id="wmConvDrop"><input id="wmConvFile" type="file" accept=".png,.jpg,.jpeg,.webp,.psd,image/png,image/jpeg,image/webp" hidden><div class="wm-empty" id="wmConvEmpty">点击或拖入图片<span>PNG / JPG / WebP / PSD</span></div><canvas id="wmConvCanvas" hidden></canvas></div>' +
      '<div class="wm-meta"><span id="wmConvStatus">选择图片开始</span><span id="wmConvDims"></span></div>' +
      '</div>' +
      '<div class="wm-controls">' +
      '<h4>输出格式</h4>' +
      '<div class="wm-row"><label>格式 <select id="wmConvFormat"><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option></select></label><label id="wmConvQualityWrap" hidden>质量 <input id="wmConvQuality" type="range" min="50" max="100" value="90"><b id="wmConvQualityVal">90%</b></label></div>' +
      '<h4>尺寸</h4>' +
      '<div class="wm-row"><label>宽 <input id="wmConvW" type="number" min="1" max="12000" placeholder="宽"></label><label>高 <input id="wmConvH" type="number" min="1" max="12000" placeholder="高"></label></div>' +
      '<label class="wm-check"><input id="wmConvKeep" type="checkbox" checked> 保持比例</label>' +
      '<button class="btn btn-primary" type="button" id="wmConvDownload">转换并下载</button>' +
      '<p class="wm-note">支持 PNG / JPG / WebP / PSD 输入；PSD 读取合层预览；输出 PNG / JPG / WebP。这里是图片格式转换，不包含 PDF、Word 等文档转换。</p>' +
      '</div></div></div></div>';
  }

  function openTool() {
    if (!overlay) {
      var wrap = document.createElement('div');
      wrap.innerHTML = template();
      overlay = wrap.firstChild;
      document.body.appendChild(overlay);
      bind();
    }
    overlay.hidden = false;
    document.body.classList.add('wm-open');
    setTimeout(function () { var c = $('#wmClose'); if (c) c.focus(); }, 50);
  }

  function closeTool() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove('wm-open');
  }

  function boot() {
    var btn = $('#watermarkBtn');
    if (btn) btn.addEventListener('click', openTool);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
