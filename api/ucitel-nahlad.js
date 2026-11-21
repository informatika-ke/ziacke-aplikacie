// Náhľad čakajúcej alebo zverejnenej aktivity v izolovanom okne (len s učiteľskou cookie, bez kontroly dátumu).
import { uloziste } from '../lib/uloziste.js';
import { jeUcitel, platnyDen, strana, HLAVICKY_AKTIVITY } from '../lib/pristup.js';

export async function GET(request) {
  if (!(await jeUcitel(request))) return strana('Nie ste prihlásená.', 401);
  const q = new URL(request.url).searchParams;
  const id = platnyDen(q.get('trieda'), q.get('den'));
  if (!id) return strana('Neplatná adresa.', 404);
  let html = null;
  try {
    html = q.get('co') === 'vydane'
      ? await uloziste.nacitajVydane(id.trieda, id.den)
      : (await uloziste.nacitajCakajuce(id.trieda, id.den))?.html ?? null;
  } catch {
    return strana('Úložisko sa nepodarilo načítať.', 503);
  }
  if (!html) return strana('Aktivita neexistuje.', 404);
  return new Response(html, { headers: HLAVICKY_AKTIVITY });
}
