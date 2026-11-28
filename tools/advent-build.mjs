// Adventné kalendáre: z advent.json vygeneruje 6 stránok tried, rozcestník, stránku na odovzdávanie
// a učiteľskú stránku. Žiacke aktivity sa neukladajú v repozitári, ale v úložisku (api/*, lib/uloziste.js).
// Volá sa z tools/build.mjs.
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'advent/2026';
const POSUN_ZNACKY = { x: 16, y: 10 }; // viewBox 1600×1000 -> percentá

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- načítanie a kontrola ----------
export function nacitajAdvent(ROOT) {
  const out = { cfg: null, errors: [], warnings: [], sekciaUvod: '' };
  const cesta = join(ROOT, 'advent.json');
  if (!existsSync(cesta)) return out;
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(cesta, 'utf8'));
  } catch (e) {
    out.errors.push('advent.json sa nedá načítať: ' + e.message);
    return out;
  }
  if (cfg.zobrazit === false) return out;
  if (cfg.rok !== 2026) out.errors.push('advent.json: rok musí byť 2026 (adresy a server sú zatiaľ pripravené len na 2026)');
  if (!Array.isArray(cfg.triedy) || !cfg.triedy.length) {
    out.errors.push('advent.json: chýba zoznam „triedy“');
    return out;
  }
  const videne = new Set();
  for (const t of cfg.triedy) {
    if (!t || !/^[a-z0-9]{2,10}$/.test(t.kluc || '')) out.errors.push(`advent.json: trieda má neplatný „kluc“ (2 až 10 znakov a–z, 0–9): ${JSON.stringify(t)}`);
    else if (videne.has(t.kluc)) out.errors.push(`advent.json: kľúč „${t.kluc}“ je dvakrát`);
    else videne.add(t.kluc);
    if (t && (!t.nazov || !cfg.motivy?.[t.motiv])) out.errors.push(`advent.json: trieda „${t.kluc}“ potrebuje „nazov“ a existujúci „motiv“`);
  }
  if (out.errors.length) return out;
  if (cfg.uvodny_obrazok !== undefined) {
    const p = cfg.uvodny_obrazok;
    if (typeof p !== 'string' || !p.startsWith(BASE + '/') || /\.\.|[\\"<>]/.test(p)) out.errors.push(`advent.json: „uvodny_obrazok“ musí byť cesta v ${BASE}/`);
    else if (!existsSync(join(ROOT, ...p.split('/')))) out.errors.push(`advent.json: súbor „${p}“ neexistuje`);
    else if (statSync(join(ROOT, ...p.split('/'))).size > 200 * 1024) out.warnings.push(`${p}: má viac ako 200 kB – úvodná stránka sa bude pomalšie načítavať`);
  }
  for (const t of cfg.triedy) {
    const cestaOk =(p) => typeof p === 'string' && p.startsWith(BASE + '/') && !/\.\.|[\\"<>]/.test(p);
    for (const [pole, limitKb] of [['obrazok', 700], ['nahlad', 200]]) {
      if (t[pole] === undefined) continue;
      const p = t[pole];
      if (!cestaOk(p)) out.errors.push(`advent.json: trieda ${t.kluc}: „${pole}“ musí byť cesta v ${BASE}/ (napr. ${BASE}/obrazky/krajinka.webp)`);
      else if (!existsSync(join(ROOT, ...p.split('/')))) out.errors.push(`advent.json: trieda ${t.kluc}: súbor „${p}“ neexistuje`);
      else {
        const kb = statSync(join(ROOT, ...p.split('/'))).size / 1024;
        if (kb > limitKb) out.warnings.push(`${p}: má ${Math.round(kb)} kB (odporúčané do ${limitKb} kB) – na telefóne sa bude dlho načítavať`);
      }
    }
    if (t.obrazok !== undefined) {
      const ok = Array.isArray(t.okienka) && t.okienka.length === 24 &&
        t.okienka.every((p) => Array.isArray(p) && p.length === 2 && p[0] >= 60 && p[0] <= 2340 && p[1] >= 60 && p[1] <= 1440);
      if (!ok) out.errors.push(`advent.json: trieda ${t.kluc}: „okienka“ musí obsahovať presne 24 dvojíc [x, y] (stred okienka v pixeloch obrázka 2400×1500, vnútri obrázka)`);
      else
        for (let i = 0; i < 24; i++)
          for (let k = i + 1; k < 24; k++)
            if (Math.hypot(t.okienka[i][0] - t.okienka[k][0], t.okienka[i][1] - t.okienka[k][1]) < 115)
              out.warnings.push(`advent.json: trieda ${t.kluc}: okienka na pozíciách #${i + 1} a #${k + 1} sa prekrývajú`);
    }
  }
  if (out.errors.length) return out;
  out.cfg = cfg;

  out.sekciaUvod = sekciaUvod(cfg);
  return out;
}

// ---------- pomocné: náhodné čísla, geometria ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
const hashText = (t) => [...t].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);
const r1 = (n) => Math.round(n * 10) / 10;

// 24 pozícií okienok (ľavý horný roh v jednotkách viewBoxu 1600×1000): okná troch domov + 5 gúľ na stromčeku
const OKNA = [
  ...[[130, 490], [250, 490], [130, 600], [250, 600]],
  ...[430, 540, 650].flatMap((y) => [520, 640, 760].map((x) => [x, y])),
  ...[475, 575, 675].flatMap((y) => [1025, 1155].map((x) => [x, y])),
];
const KULE = [[1390, 380], [1340, 510], [1440, 510], [1320, 640], [1460, 640]];
// Okienka na ilustrácii 2400×1500: stredy v pixeloch berie z advent.json (trieda.okienka).
const SIRKA_OBRAZKA = 4.4; // šírka okienka v % šírky scény
const slotyObrazka = (t) => t.okienka.map(([x, y]) => ({
  lx: r1(x / 24 - SIRKA_OBRAZKA / 2), ty: r1(y / 15 - SIRKA_OBRAZKA * 0.8), kula: true,
}));
const SLOTY = [...OKNA.map(([x, y]) => ({ x, y, kula: false })), ...KULE.map(([x, y]) => ({ x, y, kula: true }))];

function bulby(p0, p1, p2, n, odIndex = 0) {
  const farby = ['#ffd166', '#ff6b6b', '#6bd67f', '#5ab4ff'];
  let svg = `<path d="M${p0}Q${p1} ${p2}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="2"/>`;
  const [x0, y0] = p0.split(' ').map(Number), [x1, y1] = p1.split(' ').map(Number), [x2, y2] = p2.split(' ').map(Number);
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * x0 + 2 * u * t * x1 + t * t * x2, y = u * u * y0 + 2 * u * t * y1 + t * t * y2;
    svg += `<circle class="zar" cx="${r1(x)}" cy="${r1(y + 6)}" r="6" fill="${farby[(i + odIndex) % 4]}" style="animation-delay:${((i * 0.37 + odIndex) % 2.4).toFixed(2)}s"/>`;
  }
  return svg;
}

function strecha(x, y, w, rh) {
  const cx = x + w / 2, L = x - 25, R = x + w + 25, f = 0.9;
  const ly = y - rh + rh * f, lx = cx + (L - cx) * f, rx = cx + (R - cx) * f;
  const n = 7, krok = (rx - lx) / n;
  let p = `M${cx} ${y - rh}L${r1(rx)} ${r1(ly)}`;
  for (let i = n; i > 0; i--) p += `Q${r1(lx + krok * (i - 0.5))} ${r1(ly + 18)} ${r1(lx + krok * (i - 1))} ${r1(ly)}`;
  return `<polygon points="${L},${y} ${cx},${y - rh} ${R},${y}" fill="var(--strecha)"/><path d="${p}Z" fill="var(--sneh)"/>`;
}

function dom(x, y, w, h, rh, okna, komin = null) {
  let s = '';
  if (komin) s += `<rect x="${komin}" y="${y - rh * 0.8}" width="36" height="${rh * 0.7}" fill="var(--strecha)"/><rect x="${komin - 4}" y="${y - rh * 0.8 - 8}" width="44" height="12" rx="5" fill="var(--sneh)"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--dom)"/>`;
  s += strecha(x, y, w, rh);
  for (const [wx, wy] of okna)
    s += `<rect x="${wx - 5}" y="${wy - 5}" width="90" height="90" rx="8" fill="rgba(0,0,0,.35)"/>` +
      `<rect x="${wx}" y="${wy}" width="80" height="80" rx="5" fill="url(#okno)"/>` +
      `<path d="M${wx + 40} ${wy}V${wy + 80}M${wx} ${wy + 40}H${wx + 80}" stroke="rgba(60,30,0,.45)" stroke-width="4"/>` +
      `<rect x="${wx - 9}" y="${wy + 82}" width="98" height="9" rx="4" fill="var(--sneh)"/>`;
  return s;
}

function minyStrom(x, zem, v, sir) {
  const tier = (i) => {
    const top = zem - v + i * (v * 0.26), base = top + v * 0.46, half = sir * (0.4 + i * 0.3);
    return `<polygon points="${x},${r1(top)} ${r1(x + half)},${r1(base)} ${r1(x - half)},${r1(base)}" fill="var(--strom)"/>` +
      `<path d="M${x} ${r1(top)}L${r1(x + half * 0.62)} ${r1(top + (base - top) * 0.62)}Q${x} ${r1(top + (base - top) * 0.78)} ${r1(x - half * 0.62)} ${r1(top + (base - top) * 0.62)}Z" fill="var(--sneh)" opacity=".92"/>`;
  };
  return `<rect x="${x - 8}" y="${zem - 28}" width="16" height="34" fill="#4a3322"/>${tier(0)}${tier(1)}${tier(2)}`;
}

function krajina(cfgTriedy, kluc) {
  const rand = rng(hashText(kluc) + 99);
  let s = `<svg class="krajina" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">`;
  s += `<defs>
<linearGradient id="obloha" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--obloha1)"/><stop offset="1" style="stop-color:var(--obloha2)"/></linearGradient>
<linearGradient id="okno" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset="1" stop-color="#ffb347"/></linearGradient>
<radialGradient id="luna" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff8dc" stop-opacity=".55"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></radialGradient>
<linearGradient id="zem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sneh)"/><stop offset="1" stop-color="#b9cde6"/></linearGradient>
</defs>`;
  s += `<rect width="1600" height="1000" fill="url(#obloha)"/>`;
  for (let i = 0; i < 90; i++) {
    const x = r1(rand() * 1600), y = r1(rand() * 520), r = r1(0.8 + rand() * 1.8);
    s += `<circle class="hviezda" cx="${x}" cy="${y}" r="${r}" fill="#fff" style="animation-delay:${(rand() * 4).toFixed(2)}s"/>`;
  }
  s += `<circle cx="1190" cy="125" r="150" fill="url(#luna)"/><circle cx="1190" cy="125" r="52" fill="#fff8dc"/>`;
  s += `<path d="M0 640Q250 520 520 610T1060 590T1600 610V1000H0Z" fill="var(--kopec)"/>`;
  s += `<path d="M0 640Q250 520 520 610T1060 590T1600 610" fill="none" stroke="var(--sneh)" stroke-width="10" opacity=".55"/>`;
  s += minyStrom(35, 780, 190, 60) + minyStrom(430, 785, 175, 55) + minyStrom(935, 785, 205, 62);
  s += dom(60, 470, 340, 300, 130, OKNA.slice(0, 4), 300);
  s += `<rect x="195" y="692" width="70" height="78" rx="6" fill="var(--strecha)"/><circle cx="252" cy="735" r="4" fill="var(--akcent)"/>`;
  s += dom(450, 400, 460, 370, 150, OKNA.slice(4, 13), 760);
  s += dom(980, 450, 300, 320, 120, OKNA.slice(13, 19), 1200);
  s += bulby('60 472', '230 492', '400 472', 11) + bulby('450 402', '680 440', '910 402', 15, 1) + bulby('980 452', '1130 482', '1280 452', 10, 2);
  // veľký stromček
  s += `<rect x="1405" y="770" width="50" height="40" fill="#4a3322"/>`;
  for (const [ay, by, hw] of [[200, 470, 100], [330, 620, 140], [470, 790, 170]])
    s += `<polygon points="1430,${ay} ${1430 + hw},${by} ${1430 - hw},${by}" fill="var(--strom)"/>` +
      `<path d="M1430 ${ay}L${1430 + hw * 0.66} ${ay + (by - ay) * 0.66}Q1430 ${ay + (by - ay) * 0.8} ${1430 - hw * 0.66} ${ay + (by - ay) * 0.66}Z" fill="var(--sneh)" opacity=".9"/>`;
  s += bulby('1398 328', '1430 352', '1462 328', 5, 3) + bulby('1364 466', '1430 498', '1496 466', 7, 0) + bulby('1350 608', '1430 650', '1510 608', 8, 2);
  s += `<polygon class="zar" points="1430,150 1438,176 1466,176 1444,192 1452,218 1430,203 1408,218 1416,192 1394,176 1422,176" fill="#ffd166"/>`;
  // popredie
  s += `<path d="M0 785Q400 750 800 785T1600 772V1000H0Z" fill="url(#zem)"/>`;
  s += `<path d="M640 1000Q700 860 830 792L890 792Q870 870 980 1000Z" fill="rgba(150,180,220,.35)"/>`;
  s += `<path d="M0 900Q300 860 600 905T1200 890T1600 900V1000H0Z" fill="rgba(120,150,200,.25)"/>`;
  s += `<g><circle cx="300" cy="915" r="60" fill="#f7fbff"/><circle cx="300" cy="846" r="44" fill="#f7fbff"/><circle cx="300" cy="795" r="31" fill="#f7fbff"/>` +
    `<rect x="279" y="750" width="42" height="30" rx="3" fill="#222"/><rect x="270" y="776" width="60" height="8" rx="3" fill="#222"/>` +
    `<circle cx="291" cy="791" r="3.5" fill="#222"/><circle cx="309" cy="791" r="3.5" fill="#222"/><polygon points="300,797 335,803 300,808" fill="#ff8a3d"/>` +
    `<rect x="268" y="820" width="64" height="13" rx="6" fill="var(--akcent)"/><circle cx="300" cy="860" r="4" fill="#222"/><circle cx="300" cy="880" r="4" fill="#222"/></g>`;
  s += `<rect x="1100" y="730" width="8" height="120" fill="#2b2b33"/><circle class="zar" cx="1104" cy="722" r="46" fill="#ffe9a8" opacity=".25"/><circle cx="1104" cy="722" r="14" fill="#ffe9a8"/>`;
  s += `<g><rect x="1195" y="810" width="64" height="52" fill="var(--akcent2)"/><rect x="1223" y="810" width="8" height="52" fill="var(--sneh)"/><rect x="1195" y="832" width="64" height="8" fill="var(--sneh)"/>` +
    `<rect x="1268" y="826" width="46" height="38" fill="var(--akcent)"/><rect x="1288" y="826" width="7" height="38" fill="var(--sneh)"/></g>`;
  return s + '</svg>';
}

function sneh(n, seed) {
  const rand = rng(seed);
  let s = '<div class="snezenie" aria-hidden="true">';
  for (let i = 0; i < n; i++)
    s += `<i style="left:${r1(rand() * 100)}%;--v:${r1(3 + rand() * 5)}px;--t:${r1(9 + rand() * 12)}s;--d:-${r1(rand() * 20)}s;--dx:${Math.round((rand() - 0.5) * 80)}px"></i>`;
  return s + '</div>';
}

function stylMotivu(m) {
  return ['obloha1', 'obloha2', 'kopec', 'sneh', 'dom', 'strecha', 'strom', 'akcent', 'akcent2'].map((k) => `--${k}:${m[k]}`).join(';');
}

function poradie(kluc) {
  const rand = rng(hashText(kluc));
  const idx = Array.from({ length: 24 }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx; // okienko č. n (od 0) -> slot idx[n]
}

// ---------- stránky ----------
const hlavicka = (title, depth) => `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="${'../'.repeat(depth)}assets/advent.css">
</head>`;

// Úvodná stránka: iba jedno kompaktné tlačidlo (žiacke aplikácie ostávajú hore a na očiach).
function sekciaUvod(cfg) {
  return `    <h2>🎄 Špeciálne</h2>
    <ul class="grid">
      <li class="advent-banner-li"><a class="card advent-banner" href="${BASE}/">${cfg.uvodny_obrazok ? `<img src="${esc(cfg.uvodny_obrazok)}" width="960" height="600" alt="" loading="lazy" decoding="async">` : ''}<span class="advent-banner-text"><strong>🎄 ${esc(cfg.nazov || 'Adventné kalendáre 2026')}</strong><span>Okienko každý deň od 1. do 24. decembra · ${cfg.triedy.length} tried</span></span></a></li>
    </ul>
`;
}

// Samostatná stránka s výberom triedy: /advent/2026/
function stranaRozcestnik(cfg) {
  const karty = cfg.triedy
    .map((t) => {
      const m = cfg.motivy[t.motiv];
      const img = t.nahlad ? `<img src="${esc(t.nahlad.slice(BASE.length + 1))}" width="560" height="350" alt="" loading="lazy" decoding="async">` : '';
      return `      <li><a class="card advent-karta" style="--a:${m.akcent};--b:${m.obloha2}" href="${t.kluc}/">${img}<strong>${esc(t.nazov)}</strong><span>${esc(m.nazov)}</span></a></li>`;
    })
    .join('\n');
  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${esc(cfg.nazov || 'Adventné kalendáre 2026')} – Žiacke aplikácie</title>
  <link rel="stylesheet" href="../../assets/galeria.css">
  <link rel="stylesheet" href="../../assets/zdielat.css">
</head>
<body data-qr="karty">
  <header>
    <nav class="crumbs"><a href="../../">Žiacke aplikácie</a></nav>
    <h1>🎄 ${esc(cfg.nazov || 'Adventné kalendáre 2026')}</h1>
    <p>Každú polnoc od 1. do 24. decembra sa otvorí ďalšie okienko. Vyberte si svoju triedu.</p>
  </header>
  <main>
    <ul class="grid advent-grid">
${karty}
    </ul>
    <p class="advent-lead">Robíš vlastnú aktivitu? <a href="dielna/">Adventná AI dielňa (generátor promptov)</a> · <a href="odovzdat/">Odovzdať aktivitu</a></p>
  </main>
  <footer>Automaticky vygenerované – neupravujte ručne (zdroj: advent.json).</footer>
  <script src="../../assets/qrcode.js"></script>
  <script src="../../assets/zdielat.js"></script>
</body>
</html>
`;
}

function pozadieObrazok(t) {
  const src = '../' + t.obrazok.slice('advent/2026/'.length);
  return `<div class="pozadie"><img class="obrazok" src="${esc(src)}" width="2400" height="1500" alt="" fetchpriority="high" decoding="async"></div>`;
}

function stranaKalendara(cfg, t) {
  const m = cfg.motivy[t.motiv];
  const obraz = !!t.obrazok;
  const sloty = obraz ? slotyObrazka(t) : SLOTY;
  const poz = poradie(t.kluc);
  let dvierka = '';
  for (let n = 1; n <= 24; n++) {
    const sl = sloty[poz[n - 1]];
    const x = obraz ? sl.lx : r1((sl.x / 1600) * 100), y = obraz ? sl.ty : r1((sl.y / 1000) * 100);
    dvierka += `      <li class="${sl.kula ? 'kula' : ''}" style="--x:${x}%;--y:${y}%">` +
      `<button type="button" class="dv" data-den="${n}" data-stav="zamknute" aria-label="Okienko ${n}">` +
      `<span class="dv-vnutro" data-den="${n}" aria-hidden="true"></span><span class="dv-listy" aria-hidden="true"><b>${n}</b></span><span class="dv-zamok" aria-hidden="true">🔒</span></button></li>\n`;
  }
  return `${hlavicka(`Adventný kalendár ${t.nazov} – ${cfg.nazov}`, 3).replace('</head>', '  <link rel="stylesheet" href="../../../assets/zdielat.css">\n</head>')}
<body style="${stylMotivu(m)}">
  <header class="adv-hlava">
    <nav class="crumbs"><a href="../../../">Žiacke aplikácie</a> › <a href="../">Adventné kalendáre</a></nav>
    <h1>🎄 Adventný kalendár <span class="trieda">${esc(t.nazov)}</span></h1>
    <p id="odpocet" class="adv-odpocet">Načítavam…</p>
    <p id="hlaska" class="adv-hlaska" role="status" aria-live="polite"></p>
    <p id="ucitel-pas" class="adv-ucitel" hidden></p>
    <button type="button" class="qr-btn qr-hlava" data-qr-tlacidlo="Adventný kalendár ${esc(t.nazov)}">📱 QR a odkaz na kalendár</button>
  </header>
  <main data-kalendar data-trieda="${t.kluc}" data-nazov="${esc(t.nazov)}">
    <div class="scena${obraz ? ' scena-obraz' : ''}">
${obraz ? pozadieObrazok(t) : krajina(cfg.triedy, t.kluc)}
${sneh(38, hashText(t.kluc) + 5)}
      <ol class="dvierka">
${dvierka}      </ol>
    </div>
    <noscript><p class="adv-hlaska">Kalendár potrebuje zapnutý JavaScript.</p></noscript>
  </main>
  <dialog id="okno" aria-labelledby="okno-nadpis">
    <div class="okno-hlava">
      <h2 id="okno-nadpis"></h2>
      <button type="button" id="okno-cela">⛶ Celá obrazovka</button>
      <button type="button" id="okno-zavriet">✕ Zavrieť</button>
    </div>
    <iframe id="okno-iframe" title="Aktivita adventného okienka" sandbox="allow-scripts allow-modals allow-pointer-lock" allow="fullscreen" allowfullscreen referrerpolicy="no-referrer"></iframe>
  </dialog>
  <footer class="adv-pata">Okienká sa otvárajú automaticky o polnoci (čas Europe/Bratislava). Stránka je vygenerovaná z advent.json.</footer>
  <script src="../../../assets/qrcode.js"></script>
  <script src="../../../assets/zdielat.js"></script>
  <script type="module" src="../../../assets/advent.js"></script>
</body>
</html>
`;
}

// Stránka, cez ktorú žiaci odovzdávajú aktivity: /advent/2026/odovzdat/
function stranaOdovzdat(cfg) {
  const triedy = cfg.triedy.map((t) => `<option value="${t.kluc}">${esc(t.nazov)}</option>`).join('');
  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Odovzdať aktivitu – ${esc(cfg.nazov || 'Adventné kalendáre')}</title>
  <link rel="stylesheet" href="../../../assets/galeria.css">
</head>
<body>
  <header>
    <nav class="crumbs"><a href="../../../">Žiacke aplikácie</a> › <a href="../">Adventné kalendáre</a></nav>
    <h1>📤 Odovzdať aktivitu</h1>
    <p>Nahraj svoju hotovú aktivitu a zavolaj učiteľku, ktorá ju skontroluje a zverejní. Ešte ju nemáš? Vymysli ju v <a href="../dielna/">Adventnej AI dielni</a>.</p>
  </header>
  <main class="odovzdat">
    <form method="post" action="/api/advent-odovzdat/" enctype="multipart/form-data">
      <label>Trieda <select name="trieda" required>${triedy}</select></label>
      <label>Kód triedy <small>(dostaneš ho od učiteľky)</small><input type="text" name="kod" required autocomplete="off" maxlength="40"></label>
      <label>Meno a Priezvisko<input type="text" name="autor" maxlength="50" autocomplete="off"></label>
      <label>Súbor <small>(jeden hotový súbor, najviac 300 kB)</small><input type="file" name="subor" accept=".html,.htm,text/html" required></label>
      <button type="submit">Nahrať</button>
    </form>
    <h2>Pravidlá</h2>
    <ul>
      <li>Aktivita je <strong>jeden HTML súbor</strong> (HTML, CSS aj JavaScript v ňom). Žiadne ďalšie súbory.</li>
      <li>Bez internetu, bez <code>localStorage</code>/cookies, bez <code>fetch</code>, <code>&lt;form&gt;</code> a <code>&lt;iframe&gt;</code>.</li>
      <li>Obrázky len ako emoji, CSS, SVG alebo <code>data:</code>. Žiadne fotky ľudí, žiadne osobné údaje.</li>
      <li>Texty po slovensky, funguje na mobile aj na počítači, má tlačidlo „Hrať znova“.</li>
    </ul>
    <p>Po nahratí dostaneš <strong>kontrolný kód</strong>. Povedz ho učiteľke – ona aktivitu skontroluje, vyberie jej deň v kalendári a zverejní ju.</p>
  </main>
  <footer>Automaticky vygenerované – neupravujte ručne (zdroj: advent.json).</footer>
</body>
</html>
`;
}

function stranaUcitel(cfg) {
  const tabulkaTried = cfg.triedy.map((t) => `${t.kluc}:${t.nazov}`).join(',');
  const moznostiTried = cfg.triedy.map((t) => `<option value="${t.kluc}">${esc(t.nazov)}</option>`).join('');
  const datumy = [['', 'Skutočný čas (bez simulácie)'], ['2026-11-30', 'Pred adventom (30. 11.)'],
    ...Array.from({ length: 24 }, (_, i) => [`2026-12-${String(i + 1).padStart(2, '0')}`, `${i + 1}. decembra`]),
    ['2026-12-27', 'Po Vianociach (27. 12.)']]
    .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  return `${hlavicka('Učiteľský režim – ' + cfg.nazov, 3)}
<body class="strana-ucitel">
  <header class="adv-hlava"><nav class="crumbs"><a href="../../../">Žiacke aplikácie</a></nav><h1>🧑‍🏫 Učiteľský testovací režim</h1></header>
  <main class="uc">
    <section id="uc-prihlasenie" hidden>
      <p>Po prihlásení si môžete vybrať triedu a simulovať dátum. Simulácia funguje len vo vašom prehliadači a bez hesla ju nikto nevyvolá.</p>
      <form method="post" action="/api/ucitel-prihlasenie">
        <label>Heslo <input type="password" name="heslo" autocomplete="current-password" required></label>
        <button type="submit">Prihlásiť</button>
      </form>
      <p id="uc-chyba" class="chyba" hidden>Nesprávne heslo.</p>
    </section>
    <section id="uc-nastroje" hidden>
      <form id="uc-vyber">
        <label>Trieda <select id="uc-trieda">${moznostiTried}</select></label>
        <label>Simulovaný dátum <select id="uc-datum">${datumy}</select></label>
        <button type="submit">Otvoriť kalendár</button>
      </form>
      <h2>Čakajúce na schválenie <span id="uc-pocet"></span></h2>
      <p class="poznamka">Žiak vám povie kontrolný kód. Aktivitu si pozrite (náhľad beží v izolovanom okne) a schváľte alebo zamietnite. Heslo nezadávajte na počítači žiaka.</p>
      <div class="filter"><label>Trieda <select id="f-c-trieda"><option value="">všetky</option>${moznostiTried}</select></label>
        <label>Hľadať meno alebo kód <input type="search" id="f-c-text" maxlength="50" autocomplete="off"></label>
        <span id="f-c-info" class="poznamka"></span></div>
      <div id="uc-cakajuce" class="tabulka">Načítavam…</div>
      <h2>Zverejnené aktivity</h2>
      <div class="tabulka"><table id="uc-matica" data-triedy="${esc(tabulkaTried)}"></table></div>
      <p class="poznamka">✓ = zverejnené, · = zobrazí sa „Prekvapenie pre tento deň ešte pripravujeme.“ Okienko sa žiakom otvorí až v deň odomknutia.</p>
      <div class="filter"><label>Trieda <select id="f-v-trieda"><option value="">všetky</option>${moznostiTried}</select></label>
        <label>Deň <select id="f-v-den"><option value="">všetky</option>${Array.from({ length: 24 }, (_, i) => `<option value="${i + 1}">${i + 1}. december</option>`).join('')}</select></label>
        <span id="f-v-info" class="poznamka"></span></div>
      <div id="uc-vydane" class="tabulka"></div>
      <p><a class="tlacidlo" href="/api/ucitel-zaloha/">⬇ Stiahnuť zálohu všetkých aktivít (ZIP)</a></p>
      <form method="post" action="/api/ucitel-odhlasenie"><button type="submit">Odhlásiť</button></form>
    </section>
  </main>
  <dialog id="uc-nahlad" aria-label="Náhľad aktivity">
    <div class="okno-hlava"><h2 id="uc-nahlad-nadpis"></h2><button type="button" id="uc-nahlad-zavriet">✕ Zavrieť</button></div>
    <iframe id="uc-nahlad-iframe" title="Náhľad aktivity" sandbox="allow-scripts allow-modals allow-pointer-lock" referrerpolicy="no-referrer"></iframe>
  </dialog>
  <script src="../../../assets/advent-ucitel.js"></script>
</body>
</html>
`;
}

export function zapisAdvent(ROOT, adv) {
  if (!adv.cfg) return [];
  const written = [];
  const zapis = (rel, obsah) => {
    mkdirSync(join(ROOT, ...rel.split('/').slice(0, -1)), { recursive: true });
    writeFileSync(join(ROOT, ...rel.split('/')), obsah);
    written.push(rel);
  };
  for (const t of adv.cfg.triedy) {
    zapis(`${BASE}/${t.kluc}/index.html`, stranaKalendara(adv.cfg, t));
  }
  zapis(`${BASE}/index.html`, stranaRozcestnik(adv.cfg));
  zapis(`${BASE}/odovzdat/index.html`, stranaOdovzdat(adv.cfg));
  zapis(`${BASE}/ucitel/index.html`, stranaUcitel(adv.cfg));
  return written;
}
