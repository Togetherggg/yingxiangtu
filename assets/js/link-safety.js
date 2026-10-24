/* 本地链接安全检查：不联网、不暴露 API Key、对正常链接零打扰 */
(function () {
  'use strict';

  var SHORTENERS = {
    'bit.ly': 1, 't.co': 1, 't.cn': 1, 'tinyurl.com': 1, 'goo.gl': 1, 'ow.ly': 1,
    'is.gd': 1, 'buff.ly': 1, 'rebrand.ly': 1, 'cutt.ly': 1, 'shorturl.at': 1,
    's.id': 1, 'dwz.cn': 1, 'url.cn': 1, 'suo.im': 1, 'v.gd': 1, 'rb.gy': 1
  };
  var EXEC_EXT = /\.(exe|scr|bat|cmd|ps1|jar|msi|vbs|vbe|js|jse|wsf|hta|com|pif)(?:$|[?#])/i;
  var SUSPICIOUS_HOST = /(^|[.-])(login|signin|verify|account|secure|wallet|airdrop|claim|bonus|gift|prize|update)([.-]|$)/i;

  function result(level, reason, host) {
    return { level: level, reason: reason || '', host: host || '' };
  }

  function isPrivateIPv4(host) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m) return false;
    var a = +m[1], b = +m[2];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }

  function isIPv4(host) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  }

  function mixedScripts(host) {
    var latin = /[a-z]/i.test(host);
    var cyrillic = /[\u0400-\u04FF]/.test(host);
    var greek = /[\u0370-\u03FF]/.test(host);
    return latin && (cyrillic || greek);
  }

  function check(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return result('danger', '空链接');
    if (/[\u0000-\u001f\u007f]/.test(s)) return result('danger', '包含控制字符');

    var candidate = s;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = 'https://' + candidate;

    var u;
    try { u = new URL(candidate); } catch (e) { return result('danger', '链接格式无效'); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return result('danger', '只允许 http / https');
    if (!u.hostname) return result('danger', '缺少域名');

    var host = u.hostname.toLowerCase();

    if (u.username || u.password) return result('danger', '链接里藏了账号密码，容易伪装', host);
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
      return result('danger', '指向本机或局域网地址', host);
    }
    if (isIPv4(host)) {
      return isPrivateIPv4(host) ? result('danger', '指向内网 IP 地址', host) : result('warn', '直接使用 IP 地址，没有域名', host);
    }
    if (/^\[[0-9a-f:]+\]$/i.test(u.host) && /(^|:)(fc|fd|fe80)/i.test(host)) {
      return result('danger', '指向内网 IPv6 地址', host);
    }
    if (host.indexOf('xn--') >= 0) return result('warn', '包含 Punycode 国际化域名，注意仿冒', host);
    if (mixedScripts(host)) return result('danger', '域名混用不同文字，疑似仿冒', host);
    if (host.split('.').length > 5) return result('warn', '子域名层级过多', host);

    var bare = host.replace(/^www\./, '');
    if (SHORTENERS[bare] || SHORTENERS[host]) return result('warn', '短链接，跳转目标不可见', host);
    if (SUSPICIOUS_HOST.test(host)) return result('warn', '域名包含登录/验证等可疑词', host);
    if (u.href.length > 2048) return result('warn', '链接过长，可能藏有跳转参数', host);
    if (EXEC_EXT.test(u.pathname)) return result('danger', '链接指向可执行文件', host);
    if (/%00/i.test(s)) return result('danger', '包含空字节');

    return result('safe', '通过', host);
  }

  window.YXGLinkSafety = { check: check };
})();
