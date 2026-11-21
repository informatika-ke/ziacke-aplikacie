// Prihlásenie učiteľky do testovacieho režimu. Heslo a kľúč sú len vo Vercel Environment Variables.
import { hesloSedi, vytvorCookie, MENO_COOKIE, MENO_COOKIE_ZNACKA, TRVANIE_S } from '../lib/ucitel.js';

const SPAT = '/advent/2026/ucitel/';

function presmeruj(kam, cookies = []) {
  const h = new Headers({ location: kam, 'cache-control': 'no-store' });
  cookies.forEach((c) => h.append('set-cookie', c));
  return new Response(null, { status: 303, headers: h });
}

export async function POST(request) {
  const heslo = process.env.ADVENT_UCITEL_HESLO;
  const kluc = process.env.ADVENT_TAJNY_KLUC;
  if (!heslo || !kluc || kluc.length < 16) {
    return new Response('Učiteľský režim nie je nastavený (chýbajú premenné ADVENT_UCITEL_HESLO a ADVENT_TAJNY_KLUC, kľúč min. 16 znakov).', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  let zadane = '';
  try {
    zadane = String((await request.formData()).get('heslo') ?? '');
  } catch {}
  if (!(await hesloSedi(zadane, heslo, kluc))) {
    await new Promise((r) => setTimeout(r, 1000)); // spomalenie hádania hesla
    return presmeruj(SPAT + '?chyba=1');
  }
  const bezpecne = 'Path=/; Secure; SameSite=Strict; Max-Age=' + TRVANIE_S;
  return presmeruj(SPAT, [
    `${MENO_COOKIE}=${await vytvorCookie(kluc)}; HttpOnly; ${bezpecne}`,
    `${MENO_COOKIE_ZNACKA}=1; ${bezpecne}`,
  ]);
}
