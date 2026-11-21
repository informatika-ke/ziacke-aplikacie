// Podpísaná učiteľská cookie (HMAC-SHA256). Beží v Node aj v Edge (Web Crypto).
const enc = new TextEncoder();
export const MENO_COOKIE = 'advent_ucitel';
export const MENO_COOKIE_ZNACKA = 'advent_ucitel_ok'; // nie je tajná, iba zapína zobrazenie v prehliadači
export const TRVANIE_S = 30 * 24 * 3600;

async function hmacHex(kluc, text) {
  const k = await crypto.subtle.importKey('raw', enc.encode(kluc), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Porovnanie bez úniku informácie o čase.
export function rovnake(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function hesloSedi(zadane, ocakavane, kluc) {
  if (!ocakavane || !kluc) return false;
  return rovnake(await hmacHex(kluc, 'heslo:' + String(zadane)), await hmacHex(kluc, 'heslo:' + ocakavane));
}

export async function vytvorCookie(kluc, teraz = Date.now()) {
  const exp = Math.floor(teraz / 1000) + TRVANIE_S;
  return `${exp}.${await hmacHex(kluc, 'ucitel:' + exp)}`;
}

export async function overCookie(hodnota, kluc, teraz = Date.now()) {
  if (!hodnota || !kluc || kluc.length < 16) return false;
  const casti = String(hodnota).split('.');
  if (casti.length !== 2 || !/^\d{1,12}$/.test(casti[0]) || !casti[1]) return false;
  if (Number(casti[0]) < teraz / 1000) return false;
  return rovnake(casti[1], await hmacHex(kluc, 'ucitel:' + casti[0]));
}

export function citajCookie(hlavicka, meno) {
  for (const kus of String(hlavicka || '').split(';')) {
    const i = kus.indexOf('=');
    if (i > 0 && kus.slice(0, i).trim() === meno) return kus.slice(i + 1).trim();
  }
  return '';
}
