// Správanie adventného kalendára. Zamykanie tu je len vzhľad – skutočnú ochranu robí middleware.js na serveri.
import { odomknutyDen, odomknuteProCislo, cisloDna, cisloZTextu, faza, okamihOdomknutia, formatOstava, ROK } from './advent-cas.js';

const main = document.querySelector('[data-kalendar]');
const trieda = main.dataset.trieda;
const nazov = main.dataset.nazov;
const dniSoSuborom = new Set(main.dataset.dni.split(',').filter(Boolean).map(Number));
const tlacidla = [...main.querySelectorAll('.dv')];
const odpocet = document.getElementById('odpocet');
const hlaska = document.getElementById('hlaska');
const okno = document.getElementById('okno');
let iframe = document.getElementById('okno-iframe');

// Simulovaný dátum berieme do úvahy len pri učiteľskej značke (server ho aj tak overuje podpísanou cookie).
const jeUcitel = /(?:^|;\s*)advent_ucitel_ok=1(?:;|$)/.test(document.cookie);
const simText = jeUcitel ? new URLSearchParams(location.search).get('datum') : null;
const simCislo = cisloZTextu(simText);

const kluc = `advent-${ROK}-${trieda}`;
let otvorene = new Set();
try { otvorene = new Set(JSON.parse(localStorage.getItem(kluc) || '[]')); } catch {}
const uloz = () => { try { localStorage.setItem(kluc, JSON.stringify([...otvorene])); } catch {} };

const dnes = () => (simCislo !== null ? simCislo : cisloDna(new Date()));
const dd = (n) => String(n).padStart(2, '0');

function vykresli() {
  const c = dnes();
  const odomknute = odomknuteProCislo(c);
  const f = faza(c);
  for (const b of tlacidla) {
    const den = Number(b.dataset.den);
    let stav = 'zamknute';
    if (den <= odomknute) stav = otvorene.has(den) ? 'otvorene' : den === odomknute && f === 'advent' ? 'dnes' : 'odomknute';
    b.dataset.stav = stav;
    b.setAttribute('aria-disabled', stav === 'zamknute' ? 'true' : 'false');
    b.setAttribute('aria-label', `Okienko ${den}, ${stav === 'zamknute' ? `zamknuté, otvorí sa ${den}. decembra` : stav === 'otvorene' ? 'už otvorené' : 'odomknuté'}`);
  }
  return odomknute;
}

let posledne = -1;
function tik() {
  if (simCislo !== null) {
    const o = vykresli();
    odpocet.textContent = `Simulovaný dátum: ${simCislo % 100}. ${Math.floor(simCislo / 100) % 100}. ${Math.floor(simCislo / 10000)} · odomknutých okienok: ${o}`;
    return;
  }
  const teraz = new Date();
  const o = odomknutyDen(teraz);
  if (o !== posledne) { vykresli(); posledne = o; }
  const f = faza(cisloDna(teraz));
  if (f === 'po') odpocet.textContent = 'Všetky okienka sú otvorené. Veselé Vianoce! 🎄';
  else {
    const dalsie = o + 1;
    const ms = okamihOdomknutia(dalsie) - teraz;
    odpocet.textContent = f === 'pred'
      ? `Kalendár sa otvorí 1. decembra · o ${formatOstava(ms)}`
      : `Dnes je odomknuté okienko ${o} · ${dalsie <= 24 ? `ďalšie o ${formatOstava(ms)}` : 'to je posledné!'}`;
  }
}

function otvor(den) {
  const odomknute = odomknuteProCislo(dnes());
  if (den > odomknute) {
    hlaska.textContent = `Okienko ${den} sa otvorí ${den}. decembra o polnoci. Ešte chvíľku strpenia! ⏳`;
    const b = tlacidla[den - 1];
    b.classList.remove('zaklepat'); void b.offsetWidth; b.classList.add('zaklepat');
    return;
  }
  hlaska.textContent = '';
  const query = simCislo !== null ? `?datum=${simText}` : '';
  const src = dniSoSuborom.has(den)
    ? new URL(`../aktivity/${trieda}/${dd(den)}/${query}`, location.href)
    : new URL('../zatial-nic/', location.href);
  document.getElementById('okno-nadpis').textContent = `${nazov} · okienko ${den}`;
  iframe.src = src.href;
  okno.showModal();
  otvorene.add(den); uloz(); vykresli();
}

for (const b of tlacidla) b.addEventListener('click', () => otvor(Number(b.dataset.den)));

const zavri = () => okno.close();
document.getElementById('okno-zavriet').addEventListener('click', zavri);
document.getElementById('okno-cela').addEventListener('click', () => iframe.requestFullscreen?.().catch(() => {}));
okno.addEventListener('click', (e) => { if (e.target === okno) zavri(); });
okno.addEventListener('close', () => { const n = iframe.cloneNode(false); n.removeAttribute('src'); iframe.replaceWith(n); iframe = n; }); // zahodí bežiacu aktivitu

if (jeUcitel) {
  const pas = document.getElementById('ucitel-pas');
  pas.hidden = false;
  pas.innerHTML = '🧑‍🏫 Testovací režim · ' + (simCislo !== null ? 'dátum je simulovaný' : 'skutočný čas') + ' · <a href="../ucitel/">zmeniť triedu alebo dátum</a>';
}

tik();
setInterval(tik, 1000);
