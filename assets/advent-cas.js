// Jediné miesto, kde sa rozhoduje, ktoré okienko je odomknuté.
// Používa ho prehliadač (vzhľad), server (middleware.js) aj testy. Žiadne závislosti.
export const ROK = 2026;
export const CASOVA_ZONA = 'Europe/Bratislava';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CASOVA_ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Dátum v Bratislave ako číslo RRRRMMDD (napr. 20261207).
export function cisloDna(teraz = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(teraz).map((x) => [x.type, x.value]));
  return Number(p.year) * 10000 + Number(p.month) * 100 + Number(p.day);
}

// „2026-12-07“ -> 20261207; neplatný vstup (alebo neexistujúci deň) -> null.
export function cisloZTextu(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text ?? ''));
  if (!m) return null;
  const [r, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(r, mes - 1, d));
  if (dt.getUTCFullYear() !== r || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== d) return null;
  return r * 10000 + mes * 100 + d;
}

// Koľko okienok je odomknutých (0 = ešte žiadne, 24 = všetky) pre číslo dňa RRRRMMDD.
export function odomknuteProCislo(cislo, rok = ROK) {
  if (cislo < rok * 10000 + 1201) return 0;
  if (cislo >= rok * 10000 + 1224) return 24;
  return cislo - (rok * 10000 + 1200);
}

export const odomknutyDen = (teraz = new Date(), rok = ROK) => odomknuteProCislo(cisloDna(teraz), rok);

export function odomknutyDenPreDatum(text, rok = ROK) {
  const c = cisloZTextu(text);
  return c === null ? null : odomknuteProCislo(c, rok);
}

// 'pred' | 'advent' | 'po' – pre texty a zvýraznenie dnešného okienka.
export function faza(cislo, rok = ROK) {
  if (cislo < rok * 10000 + 1201) return 'pred';
  if (cislo > rok * 10000 + 1224) return 'po';
  return 'advent';
}

// Okamih, keď sa odomkne okienko `den` (polnoc v Bratislave; v decembri UTC+1).
export const okamihOdomknutia = (den, rok = ROK) => new Date(Date.UTC(rok, 11, den, -1, 0, 0));

export function formatOstava(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((x) => String(x).padStart(2, '0'))
    .join(':');
  return d > 0 ? `${d} d ${hms}` : hms;
}
