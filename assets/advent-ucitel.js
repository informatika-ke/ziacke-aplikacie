// Učiteľská stránka: prihlásenie alebo nástroje (podľa učiteľskej značky; skutočné overenie robí server),
// výber triedy a simulovaného dátumu, schvaľovanie odovzdaných aktivít a zoznam zverejnených.
const prihlasena = /(?:^|;\s*)advent_ucitel_ok=1(?:;|$)/.test(document.cookie);
document.getElementById(prihlasena ? 'uc-nastroje' : 'uc-prihlasenie').hidden = false;
if (new URLSearchParams(location.search).has('chyba')) document.getElementById('uc-chyba').hidden = false;

document.getElementById('uc-vyber').addEventListener('submit', (e) => {
  e.preventDefault();
  const trieda = document.getElementById('uc-trieda').value;
  const datum = document.getElementById('uc-datum').value;
  location.href = `../${trieda}/` + (datum ? `?datum=${datum}` : '');
});

if (prihlasena) nacitaj();

const nazvyTried = Object.fromEntries(
  (document.getElementById('uc-matica').dataset.triedy || '').split(',').map((x) => x.split(':'))
);
const nazovTriedy = (k) => nazvyTried[k] || k.toUpperCase();

// ----- pomocné: všetok text od žiakov sa vkladá cez textContent (nikdy ako HTML) -----
function el(tag, text, attrs = {}) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
const cas = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' }); };
const kb = (b) => `${Math.max(1, Math.round(b / 1024))} kB`;

function akcia(nazov, popis, trieda, den, nebezpecna = false) {
  const f = el('form', undefined, { method: 'post', action: '/api/ucitel-akcia/', class: 'riadkova' });
  for (const [k, v] of [['akcia', nazov], ['trieda', trieda], ['den', String(den)]]) f.append(el('input', undefined, { type: 'hidden', name: k, value: v }));
  const b = el('button', popis, { type: 'submit' });
  if (nebezpecna) b.addEventListener('click', (e) => { if (!confirm('Naozaj? Túto akciu nemožno vrátiť.')) e.preventDefault(); });
  f.append(b);
  return f;
}

function nahladTlacidlo(co, trieda, den, nadpis) {
  const b = el('button', 'Náhľad', { type: 'button' });
  b.addEventListener('click', () => {
    const dlg = document.getElementById('uc-nahlad');
    document.getElementById('uc-nahlad-nadpis').textContent = nadpis;
    const q = new URLSearchParams({ co, trieda, den: String(den) });
    document.getElementById('uc-nahlad-iframe').src = `/api/ucitel-nahlad/?${q}`;
    dlg.showModal();
  });
  return b;
}

document.getElementById('uc-nahlad-zavriet').addEventListener('click', () => document.getElementById('uc-nahlad').close());
document.getElementById('uc-nahlad').addEventListener('close', () => {
  const stary = document.getElementById('uc-nahlad-iframe');
  const novy = stary.cloneNode(false);
  novy.removeAttribute('src');
  stary.replaceWith(novy);
});

function tabulka(hlavicka, riadky) {
  const t = el('table');
  const hr = el('tr');
  hlavicka.forEach((h) => hr.append(el('th', h)));
  const th = el('thead');
  th.append(hr);
  const tb = el('tbody');
  riadky.forEach((r) => tb.append(r));
  t.append(th, tb);
  return t;
}
const bunka = (x) => (x instanceof Node ? (() => { const td = el('td'); td.append(x); return td; })() : el('td', x));
const riadok = (...bunky) => { const tr = el('tr'); bunky.forEach((b) => tr.append(bunka(b))); return tr; };
const akcie = (...x) => { const d = el('div', undefined, { class: 'akcie' }); d.append(...x); return d; };

async function nacitaj() {
  const kc = document.getElementById('uc-cakajuce');
  let data;
  try {
    const r = await fetch('/api/ucitel-data/', { credentials: 'same-origin' });
    data = await r.json();
    if (!r.ok) throw new Error(data.chyba || 'Chyba');
  } catch (e) {
    kc.textContent = `Zoznam sa nepodarilo načítať: ${e.message}`;
    return;
  }

  // čakajúce
  document.getElementById('uc-pocet').textContent = data.cakajuce.length ? `(${data.cakajuce.length})` : '';
  kc.replaceChildren();
  if (!data.cakajuce.length) kc.textContent = 'Nič nečaká na schválenie.';
  else {
    kc.append(tabulka(['Kód', 'Trieda', 'Deň', 'Meno a Priezvisko', 'Odovzdané', 'Veľkosť', 'Kontrola', ''],
      data.cakajuce.map((c) => riadok(
        el('strong', c.kod),
        nazovTriedy(c.trieda), String(c.den), c.autor || '–', cas(c.cas), kb(c.velkost),
        c.upozornenia?.length ? (() => { const d = el('details'); d.append(el('summary', `⚠ ${c.upozornenia.length}`)); const ul = el('ul'); c.upozornenia.forEach((u) => ul.append(el('li', u))); d.append(ul); return d; })() : '✅',
        akcie(nahladTlacidlo('cakajuce', c.trieda, c.den, `${nazovTriedy(c.trieda)} · deň ${c.den} · kód ${c.kod}`), akcia('schvalit', '✔ Schváliť a zverejniť', c.trieda, c.den), akcia('zamietnut', '✖ Zamietnuť', c.trieda, c.den, true))
      ))));
  }

  // zverejnené: matica + zoznam
  const maticaTabulka = document.getElementById('uc-matica');
  const mapa = new Map(data.vydane.map((v) => [`${v.trieda}-${v.den}`, v]));
  maticaTabulka.replaceChildren();
  const hr = el('tr'); hr.append(el('th', ''));
  for (let d = 1; d <= 24; d++) hr.append(el('th', String(d), { scope: 'col' }));
  const mh = el('thead');
  mh.append(hr);
  maticaTabulka.append(mh);
  const tb = el('tbody');
  for (const k of Object.keys(nazvyTried)) {
    const tr = el('tr'); tr.append(el('th', nazovTriedy(k), { scope: 'row' }));
    for (let d = 1; d <= 24; d++) {
      const v = mapa.get(`${k}-${d}`);
      tr.append(v ? el('td', '✓', { class: 'ano', title: v.autor || 'zverejnené' }) : el('td', '·'));
    }
    tb.append(tr);
  }
  maticaTabulka.append(tb);

  const kv = document.getElementById('uc-vydane');
  kv.replaceChildren();
  if (data.vydane.length)
    kv.append(tabulka(['Trieda', 'Deň', 'Meno a Priezvisko', 'Zverejnené', 'Veľkosť', ''],
      data.vydane.map((v) => riadok(nazovTriedy(v.trieda), String(v.den), v.autor || '–', cas(v.cas), kb(v.velkost),
        akcie(nahladTlacidlo('vydane', v.trieda, v.den, `${nazovTriedy(v.trieda)} · deň ${v.den}`), akcia('zmazat', '🗑 Zmazať', v.trieda, v.den, true))))));
}
