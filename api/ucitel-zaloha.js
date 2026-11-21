// Záloha: ZIP so všetkými zverejnenými aktivitami v tvare <trieda>/<NN>.html.
import { uloziste } from '../lib/uloziste.js';
import { zip } from '../lib/zip.js';
import { jeUcitel, strana } from '../lib/pristup.js';

export async function GET(request) {
  if (!(await jeUcitel(request))) return strana('Nie ste prihlásená.', 401);
  let vsetko;
  try { vsetko = await uloziste.vsetkoVydane(); } catch { return strana('Úložisko sa nepodarilo načítať.', 503); }
  const enc = new TextEncoder();
  const subory = vsetko
    .sort((a, b) => a.trieda.localeCompare(b.trieda) || a.den - b.den)
    .map((s) => ({ name: `${s.trieda}/${String(s.den).padStart(2, '0')}.html`, data: enc.encode(s.html) }));
  const dnes = new Date().toISOString().slice(0, 10);
  return new Response(zip(subory), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="advent-2026-zaloha-${dnes}.zip"`,
      'cache-control': 'no-store',
    },
  });
}
