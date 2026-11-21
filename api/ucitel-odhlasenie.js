import { MENO_COOKIE, MENO_COOKIE_ZNACKA } from '../lib/ucitel.js';

export async function POST() {
  const h = new Headers({ location: '/advent/2026/ucitel/', 'cache-control': 'no-store' });
  for (const [meno, httpOnly] of [[MENO_COOKIE, true], [MENO_COOKIE_ZNACKA, false]])
    h.append('set-cookie', `${meno}=; ${httpOnly ? 'HttpOnly; ' : ''}Path=/; Secure; SameSite=Strict; Max-Age=0`);
  return new Response(null, { status: 303, headers: h });
}
