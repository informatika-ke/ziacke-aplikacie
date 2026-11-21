// Kontroly žiackych súborov. Používa ich galéria (tools/build.mjs) aj odovzdávanie adventných
// aktivít (api/advent-odovzdat.js). Čistý JavaScript, bez prístupu k súborom.
export const ALLOWED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.w3.org'];
export const MAX_AKTIVITA_BAJTOV = 300 * 1024;

export const RISKY = [
  [/<form[\s>]/i, 'formulár <form>'],
  [/\bfetch\s*\(/, 'volanie fetch()'],
  [/XMLHttpRequest/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/<iframe[\s>]/i, '<iframe>'],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/, 'e-mailová adresa'],
];

export const DISK_PATH = /\b[A-Za-z]:[\\/](?:Users|Documents|Desktop|Downloads)\b|file:\/\/\//i;

// Domény (okrem povolených), na ktoré text odkazuje.
export function cudzieDomeny(text) {
  const out = new Set();
  for (const m of text.matchAll(/https?:\/\/([^\/\s"'<>)]+)/gi)) {
    const host = m[1].toLowerCase();
    if (!ALLOWED_HOSTS.includes(host)) out.add(host);
  }
  return [...out];
}

const MIESTNY_ODKAZ = /^(?:data:|#|[a-z][a-z0-9+.-]*:|\/\/)/i;

// Upozornenia pre jednu adventnú aktivitu (jeden HTML súbor). Vracia zoznam viet po slovensky.
export function skontrolujAktivitu(text) {
  const w = [];
  if (!/<!doctype|<html/i.test(text)) w.push('Nevyzerá ako HTML stránka (chýba <!DOCTYPE html>).');
  if (!/<meta[^>]+name=["']viewport["']/i.test(text)) w.push('Chýba <meta name="viewport" …> – na telefóne bude stránka drobná.');
  for (const [re, label] of RISKY) {
    if (!re.test(text)) continue;
    const blokovane = label === '<iframe>' || label === 'formulár <form>' || /fetch|XML|Web/.test(label);
    w.push(`Obsahuje ${label}${blokovane ? ' – v kalendári je to zablokované.' : '.'}`);
  }
  if (/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|document\.cookie/.test(text))
    w.push('Používa localStorage/cookies/IndexedDB – v izolovanom okne kalendára to NEFUNGUJE (ukladaj len do premenných v JavaScripte).');
  if (/\b(?:window\.)?top\.location|parent\.location|window\.open\s*\(/.test(text))
    w.push('Mení alebo otvára iné okno (top/parent/window.open) – v izolovanom okne to nefunguje.');
  if (DISK_PATH.test(text)) w.push('Obsahuje cestu na disk počítača (C:\\… alebo file:///).');
  for (const d of cudzieDomeny(text)) w.push(`Odkazuje na cudziu doménu ${d} – v kalendári sa nenačíta (aktivita musí byť samostatná).`);
  const hlasene = new Set();
  const refs = [
    ...[...text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]),
    ...[...text.matchAll(/url\(\s*["']?([^"')]+?)["']?\s*\)/gi)].map((m) => m[1]),
  ];
  for (const r of refs) {
    const ref = r.trim();
    if (!ref || MIESTNY_ODKAZ.test(ref) || hlasene.has(ref)) continue;
    hlasene.add(ref);
    w.push(`Odkazuje na samostatný súbor „${ref}“ – aktivita musí byť jeden HTML súbor (obrázky vlož ako data: URI, CSS a JS dovnútra súboru).`);
  }
  return w;
}
