// Vytvorí pre každého žiaka z CSV priečinok s placeholderom a doplní apps.json.
// CSV: hlavička Trieda;Priezvisko;Meno;Pseudonym (oddeľovač ; , alebo tabulátor).
// Do repozitára sa nikdy nezapíše priezvisko ani meno – iba pseudonym.
// Spustenie: node tools/placeholdery.mjs [cesta/k/ziaci.csv] [--rok 2026-27]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- argumenty ----------
const args = process.argv.slice(2);
let csvPath = join(ROOT, 'ziaci', 'ziaci.csv');
let rok = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--rok') rok = args[++i];
  else csvPath = resolve(args[i]);
}
if (!rok) {
  const d = new Date();
  const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; // od septembra
  rok = `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}
if (!/^\d{4}-\d{2}$/.test(rok)) {
  console.error(`CHYBA: školský rok „${rok}“ musí mať tvar 2026-27`);
  process.exit(1);
}

// ---------- pomocné ----------
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (s) =>
  plain(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function decode(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    console.log('Poznámka: súbor nie je UTF-8, čítam ako windows-1250 (Excel „CSV“).');
    return new TextDecoder('windows-1250').decode(buf);
  }
}

// jednoduchý CSV parser s úvodzovkami
function parseCsv(text, sep) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

// ---------- načítanie CSV ----------
if (!existsSync(csvPath)) {
  console.error(`CHYBA: súbor ${csvPath} neexistuje.`);
  console.error('Uložte zoznam ako ziaci/ziaci.csv alebo zadajte cestu: node tools/placeholdery.mjs cesta.csv');
  process.exit(1);
}
const text = decode(readFileSync(csvPath));
const firstLine = text.split(/\r?\n/, 1)[0];
const sep = ['\t', ';', ','].map((s) => [s, firstLine.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
const rows = parseCsv(text, sep);
if (rows.length < 2) {
  console.error('CHYBA: CSV neobsahuje žiadnych žiakov.');
  process.exit(1);
}
const header = rows[0].map((h) => slug(h));
const col = (name) => header.indexOf(name);
const iTr = col('trieda'), iPr = col('priezvisko'), iMe = col('meno'), iPs = col('pseudonym');
if ([iTr, iPr, iMe, iPs].includes(-1)) {
  console.error('CHYBA: v hlavičke musia byť stĺpce Trieda, Priezvisko, Meno, Pseudonym.');
  process.exit(1);
}

const errors = [];
const students = [];
const seen = new Map(); // "trieda/slug" -> pseudonym
rows.slice(1).forEach((r, idx) => {
  const riadok = idx + 2;
  const trieda = (r[iTr] || '').trim();
  const priezvisko = (r[iPr] || '').trim();
  const meno = (r[iMe] || '').trim();
  const pseudonym = (r[iPs] || '').trim();
  const kto = `${trieda} ${priezvisko} ${meno}`.trim();
  if (!trieda) return errors.push(`riadok ${riadok}: chýba trieda`);
  if (!pseudonym) return errors.push(`riadok ${riadok} (${kto}): chýba pseudonym`);
  const ts = slug(trieda.replace(/\./g, '')), ps = slug(pseudonym); // „2.A“ -> „2a“
  if (!ts) return errors.push(`riadok ${riadok}: z triedy „${trieda}“ sa nedá vytvoriť názov priečinka`);
  if (!ps) return errors.push(`riadok ${riadok} (${kto}): z pseudonymu „${pseudonym}“ sa nedá vytvoriť názov priečinka`);
  const key = `${ts}/${ps}`;
  if (seen.has(key))
    return errors.push(`riadok ${riadok} (${kto}): pseudonym „${pseudonym}“ sa v triede ${trieda} opakuje (alebo sa líši len diakritikou: „${seen.get(key)}“)`);
  seen.set(key, pseudonym);
  students.push({ trieda, ts, ps, pseudonym, kto, priecinok: `${rok}/${ts}/${ps}` });
});
if (errors.length) {
  console.error('Zoznam obsahuje chyby, nič sa nevytvorilo. Opravte CSV:');
  errors.forEach((e) => console.error('  CHYBA: ' + e));
  process.exit(1);
}

// ---------- placeholder ----------
const placeholderHtml = (trieda) => `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="galeria-placeholder" content="1">
  <title>Pripravuje sa</title>
  <link rel="stylesheet" href="../../../assets/galeria.css">
</head>
<body>
  <header>
    <nav class="crumbs"><a href="../../../">Žiacke aplikácie</a> › <a href="../../">${esc(rok)}</a> › <a href="../">${esc(trieda)}</a></nav>
    <h1>Pripravuje sa</h1>
    <p>Na aplikácii sa ešte pracuje. Pozrite sa sem neskôr.</p>
  </header>
</body>
</html>
`;

// ---------- apps.json ----------
const appsPath = join(ROOT, 'apps.json');
let data;
try {
  data = JSON.parse(readFileSync(appsPath, 'utf8'));
} catch (e) {
  console.error('CHYBA: apps.json sa nedá načítať: ' + e.message);
  process.exit(1);
}
if (!Array.isArray(data.aplikacie)) data.aplikacie = [];
const known = new Set(data.aplikacie.map((a) => a && a.priecinok));

let created = 0, existed = 0, added = 0;
const report = [];
for (const s of students) {
  const dir = join(ROOT, ...s.priecinok.split('/'));
  const index = join(dir, 'index.html');
  if (existsSync(index)) existed++;
  else {
    mkdirSync(dir, { recursive: true });
    writeFileSync(index, placeholderHtml(s.trieda));
    created++;
  }
  if (!known.has(s.priecinok)) {
    data.aplikacie.push({ rok, trieda: s.trieda, priecinok: s.priecinok, nazov: '', autor: s.pseudonym, typ: '' });
    known.add(s.priecinok);
    added++;
  }
  report.push(`${s.trieda.padEnd(5)} ${s.kto.padEnd(34)} → ${s.priecinok}/`);
}
writeFileSync(appsPath, JSON.stringify(data, null, 2) + '\n');

console.log(report.join('\n'));
console.log(`\nŽiakov: ${students.length}. Nové placeholdery: ${created}, priečinok už mal index.html: ${existed}, nové záznamy v apps.json: ${added}.`);
console.log('Ďalší krok: skopírujte žiakov index.html (a obrázky) do jeho priečinka, potom spustite node tools/build.mjs');
