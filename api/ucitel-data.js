// Zoznam čakajúcich a zverejnených aktivít pre učiteľskú stránku (len s učiteľskou cookie).
import { uloziste } from '../lib/uloziste.js';
import { jeUcitel, json } from '../lib/pristup.js';

export async function GET(request) {
  if (!(await jeUcitel(request))) return json({ chyba: 'Nie ste prihlásená.' }, 401);
  try {
    const [cakajuce, vydane] = await Promise.all([uloziste.zoznamCakajucich(), uloziste.zoznamVydanych()]);
    cakajuce.sort((a, b) => String(b.cas).localeCompare(String(a.cas)));
    vydane.sort((a, b) => a.trieda.localeCompare(b.trieda) || a.den - b.den);
    return json({ cakajuce, vydane });
  } catch {
    return json({ chyba: 'Úložisko sa nepodarilo načítať (je vytvorené a pripojené k projektu?).' }, 503);
  }
}
