// Akcie učiteľky: schváliť (zverejniť), zamietnuť (zmazať čakajúcu) a zmazať zverejnenú aktivitu.
import { uloziste } from '../lib/uloziste.js';
import { jeUcitel, platnyDen, strana } from '../lib/pristup.js';

const SPAT = '/advent/2026/ucitel/';
const presmeruj = () => new Response(null, { status: 303, headers: { location: SPAT, 'cache-control': 'no-store' } });

export async function POST(request) {
  if (!(await jeUcitel(request))) return strana('Nie ste prihlásená.', 401);
  let f;
  try { f = await request.formData(); } catch { return strana('Neplatný formulár.', 400); }
  const id = platnyDen(f.get('trieda'), f.get('den'));
  const akcia = String(f.get('akcia') ?? '');
  if (!id) return strana('Neplatná trieda alebo deň.', 400);
  try {
    if (akcia === 'schvalit') {
      const c = await uloziste.nacitajCakajuce(id.trieda, id.den);
      if (!c) return strana('Čakajúca aktivita už neexistuje (možno ju niekto medzitým schválil alebo zamietol).', 404);
      await uloziste.vydaj(id.trieda, id.den, c.html, { autor: c.autor, cas: new Date().toISOString() });
      await uloziste.zmazCakajuce(id.trieda, id.den);
    } else if (akcia === 'zamietnut') {
      await uloziste.zmazCakajuce(id.trieda, id.den);
    } else if (akcia === 'zmazat') {
      await uloziste.zmazVydane(id.trieda, id.den);
    } else {
      return strana('Neznáma akcia.', 400);
    }
  } catch {
    return strana('Akciu sa nepodarilo vykonať (úložisko neodpovedá). Skúste znova.', 503);
  }
  return presmeruj();
}
