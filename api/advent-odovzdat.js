// Odovzdanie žiackej aktivity. Súbor sa uloží ako ČAKAJÚCI (verejne sa nezobrazí),
// kým ho učiteľka neschváli. Odovzdať sa dá len so správnym kódom triedy.
import { uloziste } from '../lib/uloziste.js';
import { hesloSedi } from '../lib/ucitel.js';
import { parsujKody, strana, esc } from '../lib/pristup.js';
import { skontrolujAktivitu, MAX_AKTIVITA_BAJTOV } from '../lib/kontrola.js';

const ABECEDA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bez I, L, O, 0, 1 (aby sa nepletli)
const SPAT = '<p><a href="/advent/2026/odovzdat/" style="color:#ffd782">← Späť na odovzdanie</a></p>';

export const kontrolnyKod = () => {
  const b = crypto.getRandomValues(new Uint8Array(4));
  return [...b].map((x) => ABECEDA[x % ABECEDA.length]).join('');
};

const cistiAutora = (s) => String(s ?? '').replace(/[\u0000-\u001f<>"&]/g, '').trim().slice(0, 50);

export async function POST(request) {
  const kluc = process.env.ADVENT_TAJNY_KLUC;
  const kody = parsujKody(process.env.ADVENT_KODY);
  if (!kluc || kluc.length < 16 || !Object.keys(kody).length)
    return strana('Odovzdávanie ešte nie je nastavené. Povedz to učiteľke. 🛠️', 503);

  let f;
  try { f = await request.formData(); } catch { return strana(`Formulár sa nepodarilo prečítať. Skús to znova.${SPAT}`, 400); }

  const trieda = String(f.get('trieda') ?? '').toLowerCase();
  const kod = String(f.get('kod') ?? '').trim().toLowerCase();
  if (!/^[a-z0-9]{2}$/.test(trieda) || !kody[trieda]) return strana(`Vyber triedu.${SPAT}`, 400);
  if (!(await hesloSedi(kod, kody[trieda], kluc))) {
    await new Promise((r) => setTimeout(r, 1000)); // spomalenie hádania kódu
    return strana(`Kód triedy nesedí. Opýtaj sa učiteľky.${SPAT}`, 403);
  }

  const subor = f.get('subor');
  if (!subor || typeof subor !== 'object' || typeof subor.arrayBuffer !== 'function' || !subor.size)
    return strana(`Vyber súbor index.html.${SPAT}`, 400);
  if (subor.size > MAX_AKTIVITA_BAJTOV)
    return strana(`Súbor má ${Math.round(subor.size / 1024)} kB, najviac môže mať ${MAX_AKTIVITA_BAJTOV / 1024} kB. Zmenši ho (napr. menej a menšie obrázky).${SPAT}`, 413);
  let html;
  try {
    html = new TextDecoder('utf-8', { fatal: true }).decode(await subor.arrayBuffer()).replace(/^﻿/, '');
  } catch {
    return strana(`Súbor nie je uložený v kódovaní UTF-8. Ulož ho znova ako UTF-8.${SPAT}`, 400);
  }
  if (!/<!doctype html|<html/i.test(html)) return strana(`Súbor nevyzerá ako HTML stránka (chýba &lt;!DOCTYPE html&gt;).${SPAT}`, 400);

  const upozornenia = skontrolujAktivitu(html);
  const kontrolny = kontrolnyKod();
  try {
    await uloziste.ulozCakajuce({
      trieda,
      autor: cistiAutora(f.get('autor')),
      kod: kontrolny,
      cas: new Date().toISOString(),
      velkost: new TextEncoder().encode(html).length,
      upozornenia,
      html,
    });
  } catch {
    return strana('Súbor sa nepodarilo uložiť. Skús to o chvíľu alebo zavolaj učiteľku.', 503);
  }

  const zoznam = upozornenia.length
    ? `<p style="text-align:left">Našli sa tieto možné problémy (vyrieš ich, kým príde učiteľka, alebo nahraj súbor znova):</p><ul style="text-align:left">${upozornenia.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>`
    : '<p>Automatická kontrola nenašla žiadny problém. ✅</p>';
  return strana(
    `<h1>Nahrané ✔</h1><p>Trieda <b>${esc(trieda.toUpperCase())}</b>.</p>` +
      `<p>Tvoj kontrolný kód:</p><p style="font-size:3rem;letter-spacing:.2em;margin:.2em 0;color:#ffd782"><b>${kontrolny}</b></p>` +
      `<p>Zavolaj učiteľku a povedz jej tento kód. Aktivitu skontroluje, určí jej deň v kalendári a zverejní ju.</p>${zoznam}${SPAT}`,
    200,
    'Odovzdané'
  );
}
