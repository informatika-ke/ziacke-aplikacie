// Vydáva zverejnenú aktivitu adventného okienka. Kontrola času je TU, na serveri:
// budúci deň nikdy nevydá (ani pri priamej adrese), bez ohľadu na hodiny v prehliadači.
import { uloziste } from '../lib/uloziste.js';
import { platnyDen, odomknuteDni, strana, esc, HLAVICKY_AKTIVITY, PLACEHOLDER_TEXT } from '../lib/pristup.js';

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const id = platnyDen(q.get('trieda'), q.get('den'));
  if (!id) return strana('Tu nič nie je. 🎄', 404);

  const odomknute = await odomknuteDni(request);
  if (id.den > odomknute) return strana(`Toto okienko sa otvorí ${id.den}. decembra o polnoci. 🔒`, 404);

  let html = null;
  try {
    html = await uloziste.nacitajVydane(id.trieda, id.den);
  } catch (e) {
    return strana('Aktivitu sa teraz nepodarilo načítať. Skús to o chvíľu.', 503);
  }
  if (!html) {
    return new Response(
      `<!doctype html><html lang="sk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>Okienko</title><body style="font-family:system-ui,sans-serif;background:#0b1d3a;color:#fff;margin:0;display:grid;` +
        `place-items:center;min-height:100vh;text-align:center;padding:24px"><p style="font-size:1.2rem"><span style="font-size:3rem;display:block">❄️</span>${esc(PLACEHOLDER_TEXT)}</p></body></html>`,
      { headers: { ...HLAVICKY_AKTIVITY } }
    );
  }
  return new Response(html, { headers: HLAVICKY_AKTIVITY });
}
