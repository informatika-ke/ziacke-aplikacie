// Testy bez sieťových závislostí: node tools/test-advent.mjs
// Overujú odomykanie podľa času Bratislavy, podpísanú učiteľskú cookie, odovzdávanie a schvaľovanie
// aktivít (na pamäťovom úložisku namiesto Vercel Blob) a serverovú ochranu budúcich dní.
import assert from 'node:assert/strict';
import { crc32 as nodeCrc32 } from 'node:zlib';
import { odomknutyDen, odomknutyDenPreDatum, cisloZTextu, okamihOdomknutia, formatOstava } from '../assets/advent-cas.js';
import { vytvorCookie, overCookie, hesloSedi, citajCookie } from '../lib/ucitel.js';
import { platnyDen, parsujKody } from '../lib/pristup.js';
import { skontrolujAktivitu } from '../lib/kontrola.js';
import { crc32, zip } from '../lib/zip.js';

let ok = 0;
const test = async (nazov, fn) => {
  try { await fn(); ok++; console.log('  ✓ ' + nazov); }
  catch (e) { console.error('  ✗ ' + nazov + '\n    ' + e.message); process.exitCode = 1; }
};
const D = (s) => new Date(s);

console.log('Odomykanie (Europe/Bratislava)');
await test('30. 11. 23:59:59 CET -> 0', () => assert.equal(odomknutyDen(D('2026-11-30T22:59:59Z')), 0));
await test('1. 12. 00:00:00 CET -> 1', () => assert.equal(odomknutyDen(D('2026-11-30T23:00:00Z')), 1));
await test('1. 12. 23:59:59 CET -> 1', () => assert.equal(odomknutyDen(D('2026-12-01T22:59:59Z')), 1));
await test('2. 12. 00:00 CET -> 2', () => assert.equal(odomknutyDen(D('2026-12-01T23:00:00Z')), 2));
await test('12. 12. poludnie -> 12', () => assert.equal(odomknutyDen(D('2026-12-12T11:00:00Z')), 12));
await test('24. 12. -> 24', () => assert.equal(odomknutyDen(D('2026-12-23T23:00:00Z')), 24));
await test('27. 12. a 15. 1. 2027 -> 24', () => {
  assert.equal(odomknutyDen(D('2026-12-27T10:00:00Z')), 24);
  assert.equal(odomknutyDen(D('2027-01-15T10:00:00Z')), 24);
});
await test('rok 2025 sa nepočíta (pred adventom 2026)', () => assert.equal(odomknutyDen(D('2025-12-20T10:00:00Z')), 0));
await test('okamih odomknutia dňa 1 = 30. 11. 23:00 UTC', () => assert.equal(okamihOdomknutia(1).toISOString(), '2026-11-30T23:00:00.000Z'));
await test('formatOstava', () => { assert.equal(formatOstava(3661000), '01:01:01'); assert.equal(formatOstava(90061000), '1 d 01:01:01'); });
await test('?datum: platné a neplatné formáty', () => {
  assert.equal(odomknutyDenPreDatum('2026-12-07'), 7);
  assert.equal(odomknutyDenPreDatum('2026-11-30'), 0);
  for (const zle of ['2026-13-01', '2026-02-30', '26-12-07', '2026-12-7', '', null, undefined, '2026-12-07<script>', '0x1'])
    assert.equal(cisloZTextu(zle), null, String(zle));
});

console.log('Učiteľská cookie');
const KLUC = 'testovaci-tajny-kluc-123456';
await test('platná cookie prejde, cudzí kľúč a podvrh nie', async () => {
  const c = await vytvorCookie(KLUC);
  assert.equal(await overCookie(c, KLUC), true);
  assert.equal(await overCookie(c, KLUC + 'x'), false);
  const [e, h] = c.split('.');
  assert.equal(await overCookie(`${Number(e) + 99999}.${h}`, KLUC), false);
  for (const zle of ['', 'abc', '1.', '.abc', `${e}.${h}.x`, '9999999999.deadbeef']) assert.equal(await overCookie(zle, KLUC), false, zle);
  assert.equal(await overCookie(c, ''), false);
});
await test('expirovaná cookie neprejde', async () => {
  assert.equal(await overCookie(await vytvorCookie(KLUC, Date.now() - 31 * 86400 * 1000), KLUC), false);
});
await test('heslo a čítanie cookie', async () => {
  assert.equal(await hesloSedi('tajne', 'tajne', KLUC), true);
  assert.equal(await hesloSedi('zle', 'tajne', KLUC), false);
  assert.equal(await hesloSedi('', '', KLUC), false);
  assert.equal(citajCookie('a=1; advent_ucitel=xyz; b=2', 'advent_ucitel'), 'xyz');
});

console.log('Pomocné funkcie');
await test('platnyDen', () => {
  assert.deepEqual(platnyDen('1C', '7'), { trieda: '1c', den: 7 });
  for (const [t, d] of [['1c', '0'], ['1c', '25'], ['1c', '07x'], ['1', '5'], ['../', '5'], ['1c', ''], [null, null], ['abcdefghijk', '5']]) assert.equal(platnyDen(t, d), null, `${t}/${d}`);
});
await test('parsujKody', () => {
  assert.deepEqual(parsujKody('1a=Sneh, 1b = Vločka;1c=x\n1d=y'), { '1a': 'sneh', '1b': 'vločka', '1c': 'x', '1d': 'y' });
  assert.deepEqual(parsujKody(''), {});
  assert.deepEqual(parsujKody('zle,=x,1a='), {});
});
await test('skontrolujAktivitu hlási porušenia pravidiel', () => {
  const dobry = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head><body><script>let s=0</script></body></html>';
  assert.deepEqual(skontrolujAktivitu(dobry), []);
  const zly = '<html><body><img src="obr.png"><script>localStorage.x=1;fetch("https://cdn.example.com/a.js")</script></body></html>';
  const w = skontrolujAktivitu(zly).join('\n');
  for (const cast of ['viewport', 'fetch()', 'localStorage', 'cdn.example.com', 'obr.png']) assert.ok(w.includes(cast), cast);
});
await test('zip: CRC32 sedí s Node a štruktúra archívu je platná', () => {
  const data = new TextEncoder().encode('Ahoj, vianoce! ❄');
  assert.equal(crc32(data), nodeCrc32(data));
  const z = zip([{ name: '1c/07.html', data }, { name: '1a/01.html', data }], new Date('2026-12-01T10:00:00'));
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  const eocd = z.length - 22;
  assert.equal(v.getUint32(eocd, true), 0x06054b50);
  assert.equal(v.getUint16(eocd + 10, true), 2); // počet súborov
  const cdOffset = v.getUint32(eocd + 16, true);
  assert.equal(v.getUint32(cdOffset, true), 0x02014b50);
});

console.log('Server: odovzdanie, schválenie, vydanie');
process.env.ADVENT_TAJNY_KLUC = KLUC;
process.env.ADVENT_UCITEL_HESLO = 'ucitelske-heslo';
process.env.ADVENT_KODY = '1a=sneh,1c=hviezda';

// pamäťové úložisko namiesto Vercel Blob
const { uloziste } = await import('../lib/uloziste.js');
const cakajuce = new Map(), vydane = new Map();
const k = (t, d) => `${t}-${d}`;
const kc = (t, kod) => `${t}-${kod}`;
Object.assign(uloziste, {
  ulozCakajuce: async (z) => { cakajuce.set(kc(z.trieda, z.kod), z); },
  nacitajCakajuce: async (t, kod) => cakajuce.get(kc(t, kod)) ?? null,
  zoznamCakajucich: async () => [...cakajuce.values()].map(({ html, ...m }) => m),
  zmazCakajuce: async (t, kod) => { cakajuce.delete(kc(t, kod)); },
  vydaj: async (t, d, html, meta) => { vydane.set(k(t, d), { html, meta }); },
  nacitajVydane: async (t, d) => vydane.get(k(t, d))?.html ?? null,
  zoznamVydanych: async () => [...vydane].map(([id, v]) => ({ trieda: id.split('-')[0], den: Number(id.split('-')[1]), autor: v.meta.autor, cas: v.meta.cas, velkost: v.html.length })),
  zmazVydane: async (t, d) => { vydane.delete(k(t, d)); },
  vsetkoVydane: async () => [...vydane].map(([id, v]) => ({ trieda: id.split('-')[0], den: Number(id.split('-')[1]), html: v.html })),
});
const odovzdat = await import('../api/advent-odovzdat.js');
const aktivita = await import('../api/advent-aktivita.js');
const data = await import('../api/ucitel-data.js');
const nahlad = await import('../api/ucitel-nahlad.js');
const akcia = await import('../api/ucitel-akcia.js');
const zaloha = await import('../api/ucitel-zaloha.js');

const HRA = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head><body><h1>Moja hra</h1></body></html>';
const formular = (pole, subor = HRA) => {
  const f = new FormData();
  for (const [kl, v] of Object.entries(pole)) f.set(kl, v);
  if (subor !== null) f.set('subor', new File([subor], 'index.html', { type: 'text/html' }));
  return f;
};
const posli = (pole, subor) => odovzdat.POST(new Request('https://x.sk/api/advent-odovzdat/', { method: 'POST', body: formular(pole, subor) }));
const zakladne = { trieda: '1c', kod: 'Hviezda', autor: 'Veno' };
const ucitelCookie = async () => ({ cookie: 'advent_ucitel=' + (await vytvorCookie(KLUC)) });
const get = (cesta, hlavicky = {}) => new Request('https://x.sk' + cesta, { headers: hlavicky });

await test('zlý kód triedy sa odmietne a nič sa neuloží', async () => {
  const r = await posli({ ...zakladne, kod: 'zle' });
  assert.equal(r.status, 403);
  assert.equal(cakajuce.size, 0);
});
await test('trieda bez kódu, neplatný deň, chýbajúci súbor, veľký súbor, nie HTML', async () => {
  assert.equal((await posli({ ...zakladne, trieda: '1b' })).status, 400);
  assert.equal((await posli(zakladne, null)).status, 400);
  assert.equal((await posli(zakladne, 'x'.repeat(301 * 1024))).status, 413);
  assert.equal((await posli(zakladne, 'iba text bez html')).status, 400);
  assert.equal(cakajuce.size, 0);
});
let kontrolny;
await test('platné odovzdanie: čaká, vráti kontrolný kód, verejne sa nezobrazí', async () => {
  const r = await posli(zakladne);
  assert.equal(r.status, 200);
  const text = await r.text();
  kontrolny = [...cakajuce.values()][0].kod;
  assert.ok(![...cakajuce.values()][0].den); // deň určí až učiteľka
  assert.match(kontrolny, /^[A-HJKMNP-Z2-9]{4}$/);
  assert.ok(text.includes(kontrolny));
  // čakajúca aktivita nie je dostupná cez verejnú adresu ani v deň, keď je okienko odomknuté
  const v = await aktivita.GET(get('/api/advent-aktivita/?trieda=1c&den=7'));
  assert.ok(!(await v.text()).includes('Moja hra'));
  // ani keď je deň odomknutý (simulácia učiteľky): nezverejnená aktivita sa nevydá, ukáže sa placeholder
  const s = await aktivita.GET(get('/api/advent-aktivita/?trieda=1c&den=7&datum=2026-12-24', await ucitelCookie()));
  const st = await s.text();
  assert.ok(!st.includes('Moja hra') && st.includes('Prekvapenie pre tento deň'));
});
await test('autor sa očistí od HTML', async () => {
  await posli({ ...zakladne, autor: '<img src=x onerror=alert(1)>"&Veno' });
  const [kl, z] = [...cakajuce].find(([, v]) => v.autor !== 'Veno');
  assert.ok(!/[<>"&]/.test(z.autor));
  cakajuce.delete(kl);
});
await test('upozornenia sa uložia a zobrazia', async () => {
  await posli(zakladne, '<html><body><script>localStorage.a=1</script></body></html>');
  const [kl, z] = [...cakajuce].find(([, v]) => v.upozornenia.length);
  assert.ok(z.upozornenia.some((u) => u.includes('localStorage')));
  cakajuce.delete(kl);
});

await test('učiteľské API bez cookie vráti 401', async () => {
  assert.equal((await data.GET(get('/api/ucitel-data/'))).status, 401);
  assert.equal((await nahlad.GET(get('/api/ucitel-nahlad/?co=cakajuce&trieda=1c&kod=' + kontrolny))).status, 401);
  assert.equal((await zaloha.GET(get('/api/ucitel-zaloha/'))).status, 401);
  const f = new FormData(); f.set('akcia', 'schvalit'); f.set('trieda', '1c'); f.set('kod', kontrolny); f.set('den', '7');
  assert.equal((await akcia.POST(new Request('https://x.sk/api/ucitel-akcia/', { method: 'POST', body: f }))).status, 401);
  assert.equal(cakajuce.size, 1); // nič sa nezmenilo
});
await test('učiteľka vidí zoznam a náhľad čakajúcej aktivity (so sandbox hlavičkou)', async () => {
  const h = await ucitelCookie();
  const z = await (await data.GET(get('/api/ucitel-data/', h))).json();
  assert.equal(z.cakajuce.length, 1);
  assert.equal(z.cakajuce[0].kod, kontrolny);
  assert.ok(!('html' in z.cakajuce[0]));
  const n = await nahlad.GET(get('/api/ucitel-nahlad/?co=cakajuce&trieda=1c&kod=' + kontrolny, h));
  assert.equal(n.status, 200);
  assert.ok((await n.text()).includes('Moja hra'));
  assert.match(n.headers.get('content-security-policy'), /^sandbox allow-scripts allow-modals allow-pointer-lock;/);
  assert.ok(!/allow-same-origin/.test(n.headers.get('content-security-policy')));
});
await test('schválenie zverejní aktivitu; zamietnutie ju zmaže', async () => {
  const h = await ucitelCookie();
  const post = (a, t, d, kod = kontrolny) => { const f = new FormData(); f.set('akcia', a); f.set('trieda', t); if (d) f.set('den', d); if (kod) f.set('kod', kod); return akcia.POST(new Request('https://x.sk/api/ucitel-akcia/', { method: 'POST', body: f, headers: h })); };
  assert.equal((await post('schvalit', '1c', '')).status, 400); // bez dňa sa schváliť nedá
  assert.equal(cakajuce.size, 1);
  assert.equal((await post('schvalit', '1c', '7')).status, 303);
  assert.equal(cakajuce.size, 0);
  assert.ok(vydane.has('1c-7'));
  assert.equal((await post('schvalit', '1c', '7')).status, 404); // už nečaká
  await posli(zakladne);
  const druhy = [...cakajuce.values()][0].kod;
  assert.equal((await post('zamietnut', '1c', '', druhy)).status, 303);
  assert.equal(cakajuce.size, 0);
  assert.equal(vydane.has('1c-3'), false);
  assert.equal((await post('hocico', '1c', '3')).status, 400);
});
const dnesOdomknute = odomknutyDen();
await test('verejnosť: budúci deň sa nevydá (404), ani so ?datum bez cookie či s falošnou cookie', async () => {
  if (dnesOdomknute >= 7) return console.log('    (preskočené: deň 7 je už skutočne odomknutý)');
  for (const hl of [{}, { cookie: 'advent_ucitel_ok=1' }, { cookie: 'advent_ucitel=1999999999.abcd' }, { cookie: 'advent_ucitel=' + (await vytvorCookie('iny-kluc-iny-kluc-123456')) }]) {
    const r = await aktivita.GET(get('/api/advent-aktivita/?trieda=1c&den=7&datum=2026-12-24', hl));
    assert.equal(r.status, 404, JSON.stringify(hl));
    assert.ok(!(await r.text()).includes('Moja hra'));
  }
  assert.equal((await aktivita.GET(get('/api/advent-aktivita/?trieda=1c&den=7'))).status, 404);
});
await test('učiteľka so simulovaným dátumom vidí aktivitu v sandboxe; deň po simulovanom dátume nie', async () => {
  const h = await ucitelCookie();
  const r = await aktivita.GET(get('/api/advent-aktivita/?trieda=1c&den=7&datum=2026-12-07', h));
  assert.equal(r.status, 200);
  assert.ok((await r.text()).includes('Moja hra'));
  assert.match(r.headers.get('content-security-policy'), /sandbox/);
  assert.equal((await aktivita.GET(get('/api/advent-aktivita/?trieda=1c&den=7&datum=2026-12-06', h))).status, 404);
});
await test('odomknutý deň bez zverejnenej aktivity ukáže placeholder', async () => {
  const h = await ucitelCookie();
  const r = await aktivita.GET(get('/api/advent-aktivita/?trieda=1a&den=2&datum=2026-12-24', h));
  assert.equal(r.status, 200);
  assert.ok((await r.text()).includes('Prekvapenie pre tento deň ešte pripravujeme.'));
});
await test('podozrivé parametre -> 404', async () => {
  for (const q of ['trieda=1c&den=0', 'trieda=1c&den=25', 'trieda=../x&den=7', 'trieda=1c', 'den=7', 'trieda=1c&den=7x']) {
    assert.equal((await aktivita.GET(get('/api/advent-aktivita/?' + q))).status, 404, q);
  }
});
await test('záloha: ZIP obsahuje zverejnené aktivity', async () => {
  const h = await ucitelCookie();
  const r = await zaloha.GET(get('/api/ucitel-zaloha/', h));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/zip');
  assert.match(r.headers.get('content-disposition'), /attachment; filename="advent-2026-zaloha-\d{4}-\d{2}-\d{2}\.zip"/);
  const b = new Uint8Array(await r.arrayBuffer());
  assert.ok(new TextDecoder().decode(b).includes('1c/07.html'));
});
await test('zmazanie zverejnenej aktivity', async () => {
  const h = await ucitelCookie();
  const f = new FormData(); f.set('akcia', 'zmazat'); f.set('trieda', '1c'); f.set('den', '7');
  assert.equal((await akcia.POST(new Request('https://x.sk/api/ucitel-akcia/', { method: 'POST', body: f, headers: h }))).status, 303);
  assert.equal(vydane.size, 0);
});

console.log(`\nHotovo: ${ok} testov prešlo${process.exitCode ? ', niektoré zlyhali' : ''}.`);
