// Testy bez závislostí: node tools/test-advent.mjs
// Overujú odomykanie podľa času Bratislavy, podpísanú učiteľskú cookie a server (middleware.js).
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { odomknutyDen, odomknutyDenPreDatum, cisloZTextu, okamihOdomknutia, formatOstava } from '../assets/advent-cas.js';
import { vytvorCookie, overCookie, hesloSedi, citajCookie } from '../lib/ucitel.js';

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
  const stara = await vytvorCookie(KLUC, Date.now() - 31 * 86400 * 1000);
  assert.equal(await overCookie(stara, KLUC), false);
});
await test('heslo a čítanie cookie', async () => {
  assert.equal(await hesloSedi('tajne', 'tajne', KLUC), true);
  assert.equal(await hesloSedi('zle', 'tajne', KLUC), false);
  assert.equal(await hesloSedi('', '', KLUC), false);
  assert.equal(citajCookie('a=1; advent_ucitel=xyz; b=2', 'advent_ucitel'), 'xyz');
});

console.log('Server (middleware.js)');
let balikJe = true;
try { import.meta.resolve('@vercel/functions'); } catch { balikJe = false; }
if (!balikJe) {
  console.log('  (balík @vercel/functions nie je nainštalovaný – použijem náhradu len pre test; spustite npm install)');
  register('data:text/javascript,' + encodeURIComponent(`
    export async function resolve(s, c, n) { return s === '@vercel/functions' ? { url: 'data:text/javascript,export const next=()=>new Response(null,{headers:{"x-middleware-next":"1"}})', shortCircuit: true } : n(s, c); }`));
}
process.env.ADVENT_TAJNY_KLUC = KLUC;
const { default: mw } = await import('../middleware.js');
const volaj = (cesta, hlavicky = {}) => mw(new Request('https://x.sk' + cesta, { headers: hlavicky }));
const prejde = (r) => r.headers.get('x-middleware-next') === '1';
// „dnes“ v teste = skutočný čas; kým nie je advent 2026, sú všetky dni zamknuté
const dnesOdomknute = odomknutyDen();
await test('budúci deň -> 404 (aj .html, aj s lomkou)', async () => {
  const buduci = String(Math.min(24, dnesOdomknute + 1)).padStart(2, '0');
  if (dnesOdomknute >= 24) return console.log('    (preskočené: advent už skončil)');
  for (const c of [`/advent/2026/aktivity/1a/${buduci}`, `/advent/2026/aktivity/1a/${buduci}.html`, `/advent/2026/aktivity/1a/${buduci}/`]) {
    const r = await volaj(c);
    assert.equal(r.status, 404, c);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
});
await test('?datum bez cookie sa ignoruje', async () => {
  if (dnesOdomknute >= 24) return;
  assert.equal((await volaj('/advent/2026/aktivity/1a/24?datum=2026-12-24')).status, 404);
  assert.equal((await volaj('/advent/2026/aktivity/1a/24?datum=2026-12-24', { cookie: 'advent_ucitel_ok=1' })).status, 404);
  assert.equal((await volaj('/advent/2026/aktivity/1a/24?datum=2026-12-24', { cookie: 'advent_ucitel=1999999999.abcd' })).status, 404);
});
await test('?datum s platnou učiteľskou cookie funguje', async () => {
  const cookie = 'advent_ucitel=' + (await vytvorCookie(KLUC));
  assert.equal(prejde(await volaj('/advent/2026/aktivity/1a/07?datum=2026-12-07', { cookie })), true);
  assert.equal((await volaj('/advent/2026/aktivity/1a/08?datum=2026-12-07', { cookie })).status, 404);
  if (dnesOdomknute < 24) assert.equal((await volaj('/advent/2026/aktivity/1a/24', { cookie })).status, 404); // bez ?datum platí skutočný čas
});
await test('podvrhnutá cookie s iným kľúčom neprejde', async () => {
  const cookie = 'advent_ucitel=' + (await vytvorCookie('iny-kluc-iny-kluc-123456'));
  assert.equal((await volaj('/advent/2026/aktivity/1a/07?datum=2026-12-07', { cookie })).status, dnesOdomknute >= 7 ? 200 : 404);
});
await test('podozrivé tvary URL -> 404', async () => {
  for (const c of ['/advent/2026/aktivity/', '/advent/2026/aktivity/1a/', '/advent/2026/aktivity/1a/00', '/advent/2026/aktivity/1a/25',
    '/advent/2026/aktivity/1a/7', '/advent/2026/aktivity/1a/../../1a/24', '/advent/2026/aktivity/1a/%2e%2e/24', '/advent/2026/aktivity/1A/01',
    '/advent/2026/aktivity/1a/01.html/', '/advent/2026/aktivity/1a/.gitkeep', '/advent/2026/aktivity/1a/01.htm', '/advent/2026/aktivity/1a/01.html.bak'])
    assert.equal((await volaj(c)).status, 404, c);
});
await test('deň 1 po polnoci 1. 12. prejde (cez ?datum s cookie)', async () => {
  const cookie = 'advent_ucitel=' + (await vytvorCookie(KLUC));
  assert.equal(prejde(await volaj('/advent/2026/aktivity/1c/01?datum=2026-12-01', { cookie })), true);
  assert.equal((await volaj('/advent/2026/aktivity/1c/01?datum=2026-11-30', { cookie })).status, 404);
});

console.log(`\nHotovo: ${ok} testov prešlo${process.exitCode ? ', niektoré zlyhali' : ''}.`);
