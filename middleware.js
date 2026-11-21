// Vercel Routing Middleware: stráži žiacke aktivity adventných kalendárov na serveri.
// Rozhoduje čas servera (Europe/Bratislava), nie hodiny ani URL v prehliadači žiaka.
import { next } from '@vercel/functions';
import { odomknutyDen, odomknutyDenPreDatum } from './assets/advent-cas.js';
import { overCookie, citajCookie, MENO_COOKIE } from './lib/ucitel.js';

export const config = { matcher: '/advent/2026/aktivity/:path*' };

// Povolený je iba tvar /advent/2026/aktivity/<trieda>/<01-24>[.html|/]; všetko ostatné je 404.
const POVOLENE = /^\/advent\/2026\/aktivity\/([a-z0-9]{1,8})\/(0[1-9]|1\d|2[0-4])(?:\.html|\/)?$/;

function nenajdene(text) {
  return new Response(
    `<!doctype html><html lang="sk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Okienko je zatvorené</title><body style="font-family:system-ui,sans-serif;background:#0b1d3a;color:#fff;` +
      `display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:16px"><p style="font-size:1.2rem">${text}</p></body></html>`,
    {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
        'x-robots-tag': 'noindex, nofollow',
      },
    }
  );
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const m = POVOLENE.exec(url.pathname);
  if (!m) return nenajdene('Tu nič nie je. 🎄');
  const den = Number(m[2]);

  let odomknute = odomknutyDen(new Date());

  // Simulovaný dátum platí LEN s platnou podpísanou učiteľskou cookie.
  const datum = url.searchParams.get('datum');
  if (datum) {
    const cookie = citajCookie(request.headers.get('cookie'), MENO_COOKIE);
    const sim = odomknutyDenPreDatum(datum);
    if (sim !== null && (await overCookie(cookie, process.env.ADVENT_TAJNY_KLUC))) odomknute = sim;
  }

  if (den > odomknute) return nenajdene(`Toto okienko sa otvorí ${den}. decembra o polnoci. 🔒`);
  return next();
}
