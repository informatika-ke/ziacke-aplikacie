// Tlačidlo „QR“ pri kartách aplikácií a kalendárov + okno s QR kódom, kopírovaním odkazu a sťahovaním PNG.
// QR sa vytvára v prehliadači z adresy stránky (nič sa neposiela von). Používa assets/qrcode.js (MIT).
(function () {
  'use strict';
  var okno = null;

  function absolutna(href) {
    var u = new URL(href, location.href);
    u.search = ''; // bez ?datum=… (učiteľská simulácia)
    u.hash = '';
    return u.href;
  }

  function vytvorOkno() {
    if (okno) return okno;
    okno = document.createElement('dialog');
    okno.id = 'qr-okno';
    okno.setAttribute('aria-labelledby', 'qr-nadpis');
    okno.innerHTML =
      '<h2 id="qr-nadpis"></h2><div class="qr-kod" id="qr-kod"></div>' +
      '<p class="qr-adresa" id="qr-adresa"></p><p class="qr-hlaska" id="qr-hlaska" role="status" aria-live="polite"></p>' +
      '<div class="qr-akcie"><button type="button" id="qr-kopia">📋 Kopírovať odkaz</button>' +
      '<button type="button" id="qr-png">⬇ Stiahnuť QR</button>' +
      '<button type="button" id="qr-zdielat" hidden>📤 Zdieľať</button>' +
      '<button type="button" class="qr-zavriet" id="qr-zavriet">Zavrieť</button></div>';
    document.body.appendChild(okno);
    okno.addEventListener('click', function (e) { if (e.target === okno) okno.close(); });
    okno.querySelector('#qr-zavriet').addEventListener('click', function () { okno.close(); });
    return okno;
  }

  function qrObjekt(url) {
    var q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    return q;
  }

  function pngBlob(q, hotovo) {
    var n = q.getModuleCount(), px = 12, okraj = 4, rozmer = (n + 2 * okraj) * px;
    var c = document.createElement('canvas');
    c.width = c.height = rozmer;
    var g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, rozmer, rozmer);
    g.fillStyle = '#000';
    for (var r = 0; r < n; r++) {
      for (var k = 0; k < n; k++) {
        if (q.isDark(r, k)) g.fillRect((k + okraj) * px, (r + okraj) * px, px, px);
      }
    }
    c.toBlob(hotovo, 'image/png');
  }

  function hlaska(text) { document.getElementById('qr-hlaska').textContent = text; }

  function nazovSuboru(nazov) {
    var s = nazov.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'qr-' + (s || 'odkaz') + '.png';
  }

  function ukaz(nazov, url) {
    var d = vytvorOkno();
    var q = qrObjekt(url);
    d.querySelector('#qr-nadpis').textContent = nazov;
    d.querySelector('#qr-kod').innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    d.querySelector('#qr-adresa').textContent = url;
    hlaska('');
    var kopia = d.querySelector('#qr-kopia'), png = d.querySelector('#qr-png'), zd = d.querySelector('#qr-zdielat');
    kopia.onclick = function () {
      var hotovo = function () { hlaska('Odkaz je skopírovaný ✔'); };
      var zaloha = function () {
        var t = document.createElement('textarea');
        t.value = url; t.style.position = 'fixed'; t.style.opacity = '0';
        d.appendChild(t); t.select();
        try { if (document.execCommand('copy')) hotovo(); else hlaska('Označ a skopíruj odkaz ručne.'); }
        catch (e) { hlaska('Označ a skopíruj odkaz ručne.'); }
        d.removeChild(t);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(hotovo, zaloha);
      else zaloha();
    };
    png.onclick = function () {
      pngBlob(q, function (b) {
        if (!b) { hlaska('QR sa nepodarilo uložiť.'); return; }
        var a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = nazovSuboru(nazov);
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      });
    };
    if (navigator.share) {
      zd.hidden = false;
      zd.onclick = function () { navigator.share({ title: nazov, url: url }).catch(function () {}); };
    } else {
      zd.hidden = true;
    }
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }

  function init() {
    if (typeof qrcode !== 'function') return;
    // karty (zoznam aplikácií triedy, rozcestník kalendárov)
    if (document.body.dataset.qr === 'karty') {
      document.querySelectorAll('ul.grid > li').forEach(function (li) {
        var a = li.querySelector('a.card');
        if (!a || a.classList.contains('placeholder')) return;
        var s = a.querySelector('strong');
        var nazov = s ? s.textContent.trim() : 'Odkaz';
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'qr-btn';
        b.textContent = '📱 QR';
        b.setAttribute('aria-label', 'QR kód a odkaz: ' + nazov);
        b.addEventListener('click', function () { ukaz(nazov, absolutna(a.getAttribute('href'))); });
        li.classList.add('ma-qr');
        li.appendChild(b);
      });
    }
    // tlačidlo v záhlaví kalendára
    document.querySelectorAll('[data-qr-tlacidlo]').forEach(function (b) {
      b.addEventListener('click', function () { ukaz(b.dataset.qrTlacidlo || document.title, absolutna(location.href)); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
