// Náhľad čakajúcej alebo zverejnenej aktivity v izolovanom okne (len s učiteľskou cookie, bez kontroly dátumu).
import { uloziste } from '../lib/uloziste.js';
import { jeUcitel, platnyDen, strana, HLAVICKY_AKTIVITY } from '../lib/pristup.js';

export async function GET(request) {
  if (!(await jeUcitel(request))) return strana('Nie ste prihlásená.', 401);
  const q = new URL(request.url).searchParams;
  const cakajuca = q.get('co') !== 'vydane';
  const kod = String(q.get('kod') ?? '').toUpperCase();
  const id = platnyDen(q.get('trieda'), cakajuca ? 1 : q.get('den'));
  if (!id || (cakajuca && !/^[A-Z0-9]{4}$/.test(kod))) return strana('Neplatná adresa.', 404);
  let html = null;
  try {
    html = cakajuca
      ? (await uloziste.nacitajCakajuce(id.trieda, kod))?.html ?? null
      : await uloziste.nacitajVydane(id.trieda, id.den);
  } catch {
    return strana('Úložisko sa nepodarilo načítať.', 503);
  }
  if (!html) return strana('Aktivita neexistuje.', 404);
  return new Response(html, { headers: HLAVICKY_AKTIVITY });
}
