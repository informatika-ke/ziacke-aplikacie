// Vygeneruje rozcestníky galérie (úvod -> školský rok -> trieda) z apps.json
// a skontroluje žiacke aplikácie. Žiacke súbory nikdy nemení.
// Spustenie: node tools/build.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_APP_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const REQUIRED = ['rok', 'trieda', 'priecinok', 'nazov', 'autor', 'typ'];
const TEXT_EXT = new Set(['.html', '.htm', '.js', '.css', '.svg']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const ALLOWED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.w3.org'];
const RISKY = [
  [/<form[\s>]/i, 'formulár <form>'],
  [/\bfetch\s*\(/, 'volanie fetch()'],
  [/XMLHttpRequest/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/<iframe[\s>]/i, '<iframe>'],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/, 'e-mailová adresa'],
];

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
  valid.push({ ...a, priecinok: folder, parts, abs });
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

for (const a of valid) {
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

const card = (href, title, sub, tag) =>
  `      <li><a class="card" href="${href}"><strong>${esc(title)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}${tag ? `<br><span class="tag">${esc(tag)}</span>` : ''}</a></li>`;

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
    body: valid.length
      ? `    <h2>Školské roky</h2>\n    <ul class="grid">\n${years
          .map((y) => card(`${y}/`, y, `${[...byYear.get(y).keys()].length} tried`, ''))
          .join('\n')}\n    </ul>`
      : '    <p>Zatiaľ tu nie sú žiadne aplikácie.</p>',
  })
);

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
        .map((k) => card(`${k}/`, classes.get(k).label, `${classes.get(k).apps.length} aplikácií`, ''))
        .join('\n')}\n    </ul>`,
    })
  );
  // triedy
  for (const k of keys) {
    const { label, apps: list } = classes.get(k);
    list.sort((a, b) => sk(a.nazov, b.nazov));
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
        lead: `Školský rok ${y}`,
        body: `    <ul class="grid">\n${list
          .map((a) => card(`${a.parts[2]}/`, a.nazov, a.autor, a.typ))
          .join('\n')}\n    </ul>`,
      })
    );
  }
}

// ---------- súhrn ----------
console.log(`Hotovo: ${valid.length} aplikácií, ${years.length} rokov, ${written.length} vygenerovaných stránok.`);
if (warnings.length) {
  console.log(`\nUpozornenia (${warnings.length}) – skontrolujte pred zverejnením:`);
  warnings.forEach((w) => console.log('  ! ' + w));
} else {
  console.log('Žiadne upozornenia.');
}
