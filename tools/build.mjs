// Vygeneruje rozcestníky galérie (úvod -> školský rok -> trieda) z apps.json
// a skontroluje žiacke aplikácie. Žiacke súbory nikdy nemení.
// Spustenie: node tools/build.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_HOSTS, RISKY } from './kontroly.mjs';
import { nacitajAdvent, zapisAdvent } from './advent-build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_APP_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const REQUIRED = ['rok', 'trieda', 'priecinok', 'autor'];
const TEXT_EXT = new Set(['.html', '.htm', '.js', '.css', '.svg']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

const errors = [];
const warnings = [];

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const posix = (p) => p.split(sep).join('/');

// ---------- načítanie ----------
let data;
try {
  data = JSON.parse(readFileSync(join(ROOT, 'apps.json'), 'utf8'));
} catch (e) {
  console.error('CHYBA: apps.json sa nedá načítať: ' + e.message);
  process.exit(1);
}
const titul = data.titul || 'Žiacke aplikácie';
const podtitul = data.podtitul || '';
const apps = Array.isArray(data.aplikacie) ? data.aplikacie : [];

// ---------- kontrola záznamov ----------
const seen = new Set();
const valid = [];
apps.forEach((a, i) => {
  const kde = `apps.json záznam #${i + 1}${a && a.nazov ? ` („${a.nazov}“)` : ''}`;
  const missing = REQUIRED.filter((k) => !a || typeof a[k] !== 'string' || !a[k].trim());
  if (missing.length) return errors.push(`${kde}: chýba pole ${missing.join(', ')}`);
  const folder = a.priecinok.replace(/\/+$/, '');
  const parts = folder.split('/');
  if (parts.length !== 3 || parts.some((p) => !p || p === '..' || p === '.'))
    return errors.push(`${kde}: priečinok musí mať tvar „rok/trieda/aplikacia“, nie „${a.priecinok}“`);
  if (parts[0] !== a.rok) return errors.push(`${kde}: prvá časť priečinka („${parts[0]}“) sa nezhoduje s rokom („${a.rok}“)`);
  if (seen.has(folder)) return errors.push(`${kde}: priečinok „${folder}“ je v zozname viackrát`);
  seen.add(folder);
  const abs = join(ROOT, ...parts);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return errors.push(`${kde}: priečinok „${folder}“ neexistuje`);
  if (!existsSync(join(abs, 'index.html'))) return errors.push(`${kde}: v priečinku „${folder}“ chýba index.html`);
  // placeholder = stránka s <meta name="galeria-placeholder">; inak hotová aplikácia
  const html = readFileSync(join(abs, 'index.html'), 'utf8');
  const placeholder = /<meta[^>]+name=["']galeria-placeholder["']/i.test(html);
  let nazov = typeof a.nazov === 'string' ? a.nazov.trim() : '';
  if (!nazov && !placeholder) {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    nazov = m
      ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
      : '';
  }
  if (!nazov) nazov = placeholder ? 'Pripravuje sa' : 'Aplikácia';
  valid.push({ ...a, nazov, typ: typeof a.typ === 'string' ? a.typ.trim() : '', priecinok: folder, parts, abs, placeholder });
});

// ---------- kontrola obsahu aplikácií ----------
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push({ path: p, size: st.size });
  }
  return out;
}

// Overí lokálnu cestu s ohľadom na veľkosť písmen (Vercel beží na Linuxe).
// Vráti 'ok', 'missing' alebo 'case:<skutočný názov>'.
function checkPath(baseDir, appRoot, rel) {
  let cur = baseDir;
  let caseIssue = null;
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { cur = dirname(cur); if (!cur.startsWith(appRoot)) return 'ok'; continue; }
    if (!existsSync(cur) || !statSync(cur).isDirectory()) return 'missing';
    const names = readdirSync(cur);
    if (names.includes(seg)) { cur = join(cur, seg); continue; }
    const alt = names.find((n) => n.toLowerCase() === seg.toLowerCase());
    if (!alt) return 'missing';
    caseIssue = caseIssue || alt;
    cur = join(cur, alt);
  }
  return caseIssue ? `case:${caseIssue}` : 'ok';
}

const SKIP_REF = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
function refsOf(text, ext) {
  const refs = [];
  if (ext !== '.css') for (const m of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) refs.push(m[1]);
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+?)["']?\s*\)/gi)) refs.push(m[1]);
  return refs;
}

for (const a of valid) {
  if (a.placeholder) continue;
  const files = walk(a.abs);
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > MAX_APP_BYTES)
    warnings.push(`${a.priecinok}: priečinok má ${(total / 1048576).toFixed(1)} MB (limit ${MAX_APP_BYTES / 1048576} MB) – zmenšite obrázky`);
  for (const f of files) {
    const rel = posix(relative(ROOT, f.path));
    const ext = extname(f.path).toLowerCase();
    if (IMAGE_EXT.has(ext) && f.size > MAX_IMAGE_BYTES)
      warnings.push(`${rel}: obrázok má ${(f.size / 1048576).toFixed(1)} MB – zmenšite ho`);
    if (!TEXT_EXT.has(ext)) continue;
    const text = readFileSync(f.path, 'utf8');
    for (const [re, label] of RISKY) if (re.test(text)) warnings.push(`${rel}: obsahuje ${label}`);
    if (/\b[A-Za-z]:[\\/](?:Users|Documents|Desktop|Downloads)\b|file:\/\/\//i.test(text))
      warnings.push(`${rel}: obsahuje cestu na disk počítača (C:\\... alebo file:///) – na webe nebude fungovať`);
    if (ext !== '.js' && ext !== '.svg') {
      const reported = new Set();
      for (let ref of refsOf(text, ext)) {
        ref = ref.trim();
        if (!ref || SKIP_REF.test(ref) || reported.has(ref)) continue;
        reported.add(ref);
        if (ref.startsWith('/')) { warnings.push(`${rel}: cesta „${ref}“ začína lomkou – použite relatívnu cestu`); continue; }
        let clean;
        try { clean = decodeURIComponent(ref.split('#')[0].split('?')[0]); } catch { clean = ref.split('#')[0].split('?')[0]; }
        if (!clean) continue;
        const r = checkPath(dirname(f.path), a.abs, clean.replace(/\\/g, '/'));
        if (r === 'missing') warnings.push(`${rel}: odkazuje na „${ref}“, ale súbor neexistuje (nenakopírovali ste ho?)`);
        else if (r.startsWith('case:'))
          warnings.push(`${rel}: „${ref}“ sa líši veľkosťou písmen od súboru „${r.slice(5)}“ – na Verceli by sa nenačítal`);
      }
    }
    for (const m of text.matchAll(/https?:\/\/([^\/\s"'<>)]+)/gi)) {
      const host = m[1].toLowerCase();
      if (!ALLOWED_HOSTS.includes(host)) warnings.push(`${rel}: odkaz/zdroj na cudziu doménu ${host}`);
    }
  }
}

// priečinky na disku, ktoré nie sú v apps.json
for (const rok of readdirSync(ROOT)) {
  if (!/^\d{4}-\d{2}$/.test(rok)) continue;
  for (const trieda of readdirSync(join(ROOT, rok))) {
    const tp = join(ROOT, rok, trieda);
    if (!statSync(tp).isDirectory()) continue;
    for (const app of readdirSync(tp)) {
      if (!statSync(join(tp, app)).isDirectory()) continue;
      if (!seen.has(`${rok}/${trieda}/${app}`))
        warnings.push(`${rok}/${trieda}/${app}: priečinok nie je v apps.json (nezobrazí sa v galérii)`);
    }
  }
}

// ---------- adventné kalendáre (advent.json) ----------
const advent = nacitajAdvent(ROOT);
errors.push(...advent.errors);
warnings.push(...advent.warnings);

if (errors.length) {
  console.error('Build zastavený – opravte chyby:');
  errors.forEach((e) => console.error('  CHYBA: ' + e));
  process.exit(1);
}

// ---------- generovanie stránok ----------
function page({ depth, title, crumbs, heading, lead, body }) {
  const up = '../'.repeat(depth);
  const nav = crumbs.length
    ? `<nav class="crumbs">${crumbs.map((c) => `<a href="${c.href}">${esc(c.text)}</a>`).join(' › ')}</nav>`
    : '';
  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="${up}assets/galeria.css">
</head>
<body>
  <header>
    ${nav}
    <h1>${esc(heading)}</h1>
    ${lead ? `<p>${esc(lead)}</p>` : ''}
  </header>
  <main>
${body}
  </main>
  <footer>Automaticky vygenerované – neupravujte ručne (zdroj: apps.json).</footer>
</body>
</html>
`;
}

const card = (href, title, sub, tag, cls = '') =>
  `      <li><a class="card${cls ? ' ' + cls : ''}" href="${href}"><strong>${esc(title)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}${tag ? `<br><span class="tag">${esc(tag)}</span>` : ''}</a></li>`;
// Ak existuje assets/rok-<rok>.jpg, karta školského roka sa zobrazí ako široký obrázok (rovnako ako advent).
const rokKarta = (y, sub) =>
  existsSync(join(ROOT, 'assets', `rok-${y}.jpg`))
    ? `      <li class="advent-banner-li"><a class="card advent-banner" href="${y}/"><img src="assets/rok-${y}.jpg" width="1200" height="675" alt="" loading="lazy" decoding="async"><span class="advent-banner-text"><strong>${esc(y)}</strong><span>${esc(sub)}</span></span></a></li>`
    : card(`${y}/`, y, sub, '');
const appCard = (a) =>
  a.placeholder
    ? card(`${a.parts[2]}/`, a.autor, 'Pripravuje sa', '', 'placeholder')
    : card(`${a.parts[2]}/`, a.nazov, a.autor, a.typ);
const hotove = (list) => list.filter((a) => !a.placeholder).length;
const countText = (list) => `${hotove(list)} hotových z ${list.length}`;

const byYear = new Map();
for (const a of valid) {
  if (!byYear.has(a.rok)) byYear.set(a.rok, new Map());
  const classes = byYear.get(a.rok);
  const key = a.parts[1];
  if (!classes.has(key)) classes.set(key, { label: a.trieda, apps: [] });
  classes.get(key).apps.push(a);
}
const years = [...byYear.keys()].sort().reverse();
const sk = (x, y) => x.localeCompare(y, 'sk');

const written = [];
const write = (rel, content) => {
  writeFileSync(join(ROOT, ...rel.split('/')), content);
  written.push(rel);
};

// úvod
write(
  'index.html',
  page({
    depth: 0,
    title: titul,
    crumbs: [],
    heading: titul,
    lead: podtitul,
    body: (valid.length
      ? `    <h2>Školské roky</h2>\n    <ul class="grid">\n${years
          .map((y) => rokKarta(y, `${[...byYear.get(y).keys()].length} tried`))
          .join('\n')}\n    </ul>`
      : '    <p>Zatiaľ tu nie sú žiadne aplikácie.</p>') + '\n' + advent.sekciaUvod,
  })
);

// adventné kalendáre: 6 tried, učiteľská stránka, spoločný placeholder
written.push(...zapisAdvent(ROOT, advent));

for (const y of years) {
  const classes = byYear.get(y);
  const keys = [...classes.keys()].sort((a, b) => sk(classes.get(a).label, classes.get(b).label));
  // rok
  write(
    `${y}/index.html`,
    page({
      depth: 1,
      title: `${y} – ${titul}`,
      crumbs: [{ href: '../', text: titul }],
      heading: `Školský rok ${y}`,
      lead: '',
      body: `    <h2>Triedy</h2>\n    <ul class="grid">\n${keys
        .map((k) => card(`${k}/`, classes.get(k).label, countText(classes.get(k).apps), ''))
        .join('\n')}\n    </ul>`,
    })
  );
  // triedy
  for (const k of keys) {
    const { label, apps: list } = classes.get(k);
    // hotové aplikácie prvé (podľa názvu), placeholdery za nimi (podľa pseudonymu)
    list.sort((a, b) => a.placeholder - b.placeholder || (a.placeholder ? sk(a.autor, b.autor) : sk(a.nazov, b.nazov)));
    write(
      `${y}/${k}/index.html`,
      page({
        depth: 2,
        title: `${label} ${y} – ${titul}`,
        crumbs: [
          { href: '../../', text: titul },
          { href: '../', text: y },
        ],
        heading: `Trieda ${label}`,
        lead: `Školský rok ${y} · ${countText(list)}`,
        body: `    <ul class="grid">\n${list.map(appCard).join('\n')}\n    </ul>`,
      })
    );
  }
}

// ---------- súhrn ----------
console.log(`Hotovo: ${hotove(valid)} hotových aplikácií z ${valid.length} záznamov, ${years.length} rokov, ${written.length} vygenerovaných stránok.`);
if (advent.cfg) console.log(`Adventné kalendáre: ${advent.cfg.triedy.length} tried (aktivity sú v úložisku, nie v repozitári).`);
if (warnings.length) {
  console.log(`\nUpozornenia (${warnings.length}) – skontrolujte pred zverejnením:`);
  warnings.forEach((w) => console.log('  ! ' + w));
} else {
  console.log('Žiadne upozornenia.');
}
