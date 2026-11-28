// Úložisko žiackych aktivít (Vercel Blob, SÚKROMNÉ súbory: nedajú sa otvoriť priamym odkazom,
// vydáva ich len náš server po kontrole dátumu). Token BLOB_READ_WRITE_TOKEN pridá Vercel sám.
//   advent/cakajuce/<trieda>-<KOD>.json  čaká na schválenie (deň určí až učiteľka): { trieda, autor, kod, cas, velkost, upozornenia, html }
//   advent/vydane/<trieda>-<NN>.html     schválená aktivita
//   advent/vydane/<trieda>-<NN>.json     jej údaje: { autor, cas }
// Čakajúca aktivita sa identifikuje kontrolným kódom, zverejnená dvojicou trieda+deň (najviac jedna).
import { put, get, del, list } from '@vercel/blob';

const nn = (d) => String(d).padStart(2, '0');
const kluc = (t, d) => `${t}-${nn(d)}`;
const CAKAJUCE = 'advent/cakajuce/';
const VYDANE = 'advent/vydane/';

async function citaj(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return new Response(r.stream).text();
}
const pis = (pathname, text, contentType) =>
  put(pathname, text, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType });
const zmaz = async (pathname) => { try { await del(pathname); } catch { /* neexistuje */ } };
const parsuj = (id) => { const m = /(?:^|\/)([a-z0-9]{2,10})-(\d{2})\.(?:json|html)$/.exec(id); return m ? { trieda: m[1], den: Number(m[2]) } : null; };

async function vsetky(prefix, koncovka) {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix, limit: 1000, cursor });
    out.push(...r.blobs.filter((b) => b.pathname.endsWith(koncovka)));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

// Staršie odovzdania (pred zmenou: deň určoval žiak) sú uložené ako <trieda>-<NN>.json; nájde ich podľa kódu.
async function stareCakajuce(trieda, kod) {
  for (const b of await vsetky(`${CAKAJUCE}${trieda}-`, '.json')) {
    if (!/-\d\d\.json$/.test(b.pathname)) continue;
    try {
      const data = JSON.parse((await citaj(b.pathname)) || 'null');
      if (data && String(data.kod).toUpperCase() === kod) return { pathname: b.pathname, data };
    } catch { /* poškodený súbor */ }
  }
  return null;
}

// Objekt (nie samostatné exporty), aby sa dal v testoch nahradiť pamäťovou verziou.
export const uloziste = {
  async ulozCakajuce(z) {
    await pis(`${CAKAJUCE}${z.trieda}-${z.kod}.json`, JSON.stringify(z), 'application/json');
  },
  async nacitajCakajuce(trieda, kod) {
    const s = await citaj(`${CAKAJUCE}${trieda}-${kod}.json`);
    if (s) return JSON.parse(s);
    return (await stareCakajuce(trieda, kod))?.data ?? null;
  },
  async zoznamCakajucich() {
    const polozky = await vsetky(CAKAJUCE, '.json');
    const data = await Promise.all(polozky.map((b) => citaj(b.pathname).then((s) => (s ? JSON.parse(s) : null)).catch(() => null)));
    return data.filter(Boolean).map(({ html, ...meta }) => meta);
  },
  async zmazCakajuce(trieda, kod) {
    await zmaz(`${CAKAJUCE}${trieda}-${kod}.json`);
    const stare = await stareCakajuce(trieda, kod);
    if (stare) await zmaz(stare.pathname);
  },
  async vydaj(trieda, den, html, meta) {
    await pis(`${VYDANE}${kluc(trieda, den)}.html`, html, 'text/html');
    await pis(`${VYDANE}${kluc(trieda, den)}.json`, JSON.stringify(meta), 'application/json');
  },
  async nacitajVydane(trieda, den) {
    return citaj(`${VYDANE}${kluc(trieda, den)}.html`);
  },
  async zoznamVydanych() {
    const polozky = await vsetky(VYDANE, '.html');
    const out = [];
    for (const b of polozky) {
      const id = parsuj(b.pathname);
      if (!id) continue;
      let meta = {};
      try { meta = JSON.parse((await citaj(b.pathname.replace(/\.html$/, '.json'))) || '{}'); } catch { /* bez údajov */ }
      out.push({ ...id, autor: meta.autor || '', cas: meta.cas || b.uploadedAt?.toISOString?.() || '', velkost: b.size });
    }
    return out;
  },
  async zmazVydane(trieda, den) {
    await zmaz(`${VYDANE}${kluc(trieda, den)}.html`);
    await zmaz(`${VYDANE}${kluc(trieda, den)}.json`);
  },
  async vsetkoVydane() {
    const polozky = await vsetky(VYDANE, '.html');
    const out = [];
    for (const b of polozky) {
      const id = parsuj(b.pathname);
      const html = id && (await citaj(b.pathname));
      if (id && html) out.push({ ...id, html });
    }
    return out;
  },
};
