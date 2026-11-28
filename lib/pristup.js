// Spoločná logika serverových funkcií adventných kalendárov: kto smie vidieť ktorý deň.
import { odomknutyDen, odomknutyDenPreDatum } from '../assets/advent-cas.js';
import { overCookie, citajCookie, MENO_COOKIE } from './ucitel.js';

export const PLACEHOLDER_TEXT = 'Prekvapenie pre tento deň ešte pripravujeme.';

// „1c“ + „7“ -> { trieda: '1c', den: 7 }; neplatný vstup -> null.
export function platnyDen(trieda, den) {
  const t = String(trieda ?? '').toLowerCase();
  const d = typeof den === 'number' ? den : /^\d{1,2}$/.test(String(den ?? '').trim()) ? Number(den) : NaN;
  if (!/^[a-z0-9]{2,10}$/.test(t) || !Number.isInteger(d) || d < 1 || d > 24) return null;
  return { trieda: t, den: d };
}

export async function jeUcitel(request) {
  return overCookie(citajCookie(request.headers.get('cookie'), MENO_COOKIE), process.env.ADVENT_TAJNY_KLUC);
}

// Koľko okienok je pre túto požiadavku odomknutých. Simulovaný dátum (?datum=) platí LEN
// s platnou podpísanou učiteľskou cookie, inak sa ignoruje a rozhoduje čas servera.
export async function odomknuteDni(request, teraz = new Date()) {
  let odomknute = odomknutyDen(teraz);
  const datum = new URL(request.url).searchParams.get('datum');
  if (datum && (await jeUcitel(request))) {
    const sim = odomknutyDenPreDatum(datum);
    if (sim !== null) odomknute = sim;
  }
  return odomknute;
}

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Kódy tried z premennej ADVENT_KODY: „1a=slovo1, 1b=slovo2“ (oddeľovač čiarka, bodkočiarka alebo nový riadok).
export function parsujKody(text) {
  const out = {};
  for (const kus of String(text || '').split(/[,;\n]/)) {
    const i = kus.indexOf('=');
    if (i < 1) continue;
    const t = kus.slice(0, i).trim().toLowerCase();
    const k = kus.slice(i + 1).trim().toLowerCase();
    if (/^[a-z0-9]{2,10}$/.test(t) && k) out[t] = k;
  }
  return out;
}

// Hlavičky pre vydávanie žiackej aktivity: izolované okno (sandbox bez same-origin), nič von.
export const HLAVICKY_AKTIVITY = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy':
    "sandbox allow-scripts allow-modals allow-pointer-lock; default-src 'none'; script-src 'unsafe-inline'; " +
    "style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data: blob:; " +
    "media-src data: blob:; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'; frame-ancestors 'self'",
  'cache-control': 'private, no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
};

export function strana(text, status = 200, nadpis = 'Adventné kalendáre') {
  return new Response(
    `<!doctype html><html lang="sk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${esc(nadpis)}</title><body style="font-family:system-ui,sans-serif;background:#0b1d3a;color:#fff;margin:0;` +
      `display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px"><main style="max-width:640px">${text}</main></body></html>`,
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
        'x-robots-tag': 'noindex, nofollow',
      },
    }
  );
}

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
