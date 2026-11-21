# Návod: galéria žiackych aplikácií

## Začiatok roka: placeholdery pre všetkých žiakov
1. Zoznam žiakov uložte ako `ziaci/ziaci.csv` (priečinok `ziaci/` je v `.gitignore`, na GitHub sa
   nedostane). Hlavička: `Trieda;Priezvisko;Meno;Pseudonym`. Excel: Uložiť ako → CSV (stačí aj
   „CSV UTF-8“). Ak máte zoznam v PDF, otvorte ho vo Worde alebo skopírujte tabuľku do Excelu.
2. Spustite `node tools/placeholdery.mjs`. Pre každého žiaka vznikne priečinok
   `2026-27/<trieda>/<pseudonym>/` s dočasnou stránkou „Pripravuje sa“ a záznam v `apps.json`.
   Výpis v konzole ukáže, kto má ktorý priečinok. **Do repozitára sa nezapisuje meno ani priezvisko, len pseudonym.**
3. Skript môžete spustiť opakovane (nový žiak v CSV). Existujúce súbory neprepíše.
4. `node tools/build.mjs`, `git add .`, `git commit`, `git push`. V galérii sú hneď karty všetkých žiakov
   so stálou adresou.

## Pridanie hotovej aplikácie (každý týždeň / po odovzdaní)
Súhlasy zákonných zástupcov si evidujete mimo repozitára (`SUHLAS-vzor.md`). Nezverejňujte bez súhlasu.
1. Do priečinka žiaka (`2026-27/2a/<pseudonym>/`) nakopírujte jeho `index.html` (prepíše placeholder)
   a všetky priečinky a súbory, na ktoré odkazuje (obrázky, zvuky, `.js`, `.css`), tak ako ich má žiak.
2. Spustite `node tools/build.mjs` a prečítajte si UPOZORNENIA:
   - odkaz na súbor, ktorý neexistuje (zabudnutý priečinok s obrázkami),
   - rozdiel vo veľkosti písmen (`Pes.png` v kóde, `pes.png` na disku): vo Windows funguje, na webe nie,
   - cesta na disk žiaka (`C:\Users\...`), `fetch()`, cudzie domény, veľké obrázky, e-mailové adresy.
3. Aplikáciu si otvorte v prehliadači a pozrite sa, či je obsah slušný a bez osobných údajov
   (celé mená, fotky žiakov, telefóny, e-maily).
4. Názov karty sa vezme z `<title>` v žiakovom `index.html`. Chcete ho zmeniť, alebo pridať typ,
   upravte `nazov` a `typ` v zázname v `apps.json`.
5. Odošlite zmeny: `git add .`, `git commit -m "Pridané aplikácie 2.A"`, `git push`.
   Vercel stránku sám nasadí do minúty.

### Ručné pridanie mimo zoznamu
Aplikáciu môžete dať aj do vlastného priečinka `ROK/TRIEDA/aplikacia/` a pridať záznam do `apps.json`:
```json
{ "rok": "2026-27", "trieda": "1.A", "priecinok": "2026-27/1a/pexeso-auta",
  "nazov": "Pexeso: autá", "autor": "M. K.", "typ": "pexeso" }
```
Povinné polia: `rok`, `trieda`, `priecinok`, `autor`.

## Nový školský rok
Pripravte nové `ziaci/ziaci.csv` a spustite `node tools/placeholdery.mjs --rok 2027-28`.
Staré roky ponechajte alebo (po uplynutí doby uvedenej v súhlase) zmažte priečinok aj záznam
a znova spustite build.

## Odstránenie aplikácie (žiadosť rodiča)
Zmažte záznam v `apps.json` aj priečinok aplikácie, spustite build, commit a push.
Pozor: v histórii Gitu ostane starý obsah. Pri verejnom repozitári preto nedávajte do
aplikácií nič, čo by sa nemalo ukázať (mená, fotky ľudí).

## Prvé nasadenie
1. Na GitHube v organizácii: **New repository** → názov `ziacke-aplikacie` → **Public** → bez README.
2. V priečinku projektu: `git remote add origin https://github.com/ORGANIZACIA/ziacke-aplikacie.git`
   a `git push -u origin main`.
3. Na vercel.com: **Add New → Project** → vyberte repozitár. Framework: *Other*, build command
   a output directory nechajte prázdne. **Deploy.**
   (Vercel Hobby plán je pre neziskové/osobné použitie; ak by sa používal v mene školy, overte podmienky.)
4. Po nasadení v DevTools (záložka Network) overte hlavičky `Content-Security-Policy` a `X-Robots-Tag`.

## Bezpečnostné pravidlá
- Hlavička CSP vo `vercel.json` blokuje, aby aplikácia čokoľvek odosielala von alebo načítavala
  cudzie skripty. Ak žiak potrebuje externú knižnicu, stiahnite ju do jeho priečinka.
- Obrázky: iba vlastné kresby/fotky bez ľudí alebo voľné licencie (CC0, Pixabay, Unsplash, Wikimedia).
- Stránky majú `noindex` (nie sú vo vyhľadávačoch); odkaz sa šíri len medzi rodinami.

---

# Adventné kalendáre 2026 (1.A, 1.B, 1.C, 1.D, 1.G, 1.R)

Kalendáre sú na adrese `/advent/2026/<trieda>/` (napr. `/advent/2026/1a/`), odkazy sú na úvodnej stránke.
Okienko N sa odomkne N. decembra o polnoci (čas Europe/Bratislava), po 24. 12. ostanú všetky otvorené.
Zamknuté dni stráži server: otvoriť ich cez priamu adresu nejde, ani keď žiak zmení hodiny v počítači.

## Pridanie hotovej aktivity (bez programovania)
1. Žiakov súbor musí byť **jeden HTML súbor** (HTML + CSS + JavaScript v ňom; obrázky vložené ako `data:`).
2. Premenujte ho na **číslo dňa s nulou**: `07.html` (nie `7.html`, nie `moja-hra.html`).
3. Vložte ho do `advent/2026/aktivity/<trieda>/`, napr. `advent/2026/aktivity/1c/07.html`.
4. `node tools/build.mjs` a prečítajte si UPOZORNENIA (zlý názov, odkazy na ďalšie súbory, `localStorage`,
   `fetch`, cudzie domény, e-maily, veľkosť nad 3 MB). Upozornenie na `localStorage` je dôležité:
   aktivita beží v izolovanom okne a tam ukladanie do prehliadača nefunguje.
5. `git add .`, `git commit`, `git push`. Vercel nasadí do minúty.

Okienko bez súboru ukazuje spoločné „Prekvapenie pre tento deň ešte pripravujeme.“ (text sa mení v `advent.json`, pole `placeholder`).
Výmena aktivity = prepísanie súboru. Odstránenie = zmazanie súboru a build.
Pozor: repozitár je verejný, súbor je teda vidieť na GitHube aj pred odomknutím. Hotové aktivity preto
radšej pushnite až krátko pred dňom odomknutia.

## Učiteľský testovací režim
Adresa: `/advent/2026/ucitel/`. Heslo a tajný kľúč sa nastavia raz vo Verceli
(Project → Settings → Environment Variables), v repozitári nie sú:
- `ADVENT_UCITEL_HESLO` – vaše heslo,
- `ADVENT_TAJNY_KLUC` – náhodný reťazec aspoň 16 znakov (podpisuje prihlasovaciu cookie).

Po zmene premenných treba vo Verceli spraviť nové nasadenie (Redeploy).
Po prihlásení vyberiete triedu a simulovaný dátum a otvorí sa kalendár s `?datum=RRRR-MM-DD`.
Simulácia funguje len s vašou prihlasovacou cookie (30 dní); bez nej server `?datum` ignoruje.

## Nastavenia a vzhľad
`advent.json`: zoznam tried, farebné motívy, text placeholderu, `"zobrazit": false` skryje sekciu z úvodnej stránky.
Po každej zmene spustite `node tools/build.mjs`. Test odomykania a servera: `node tools/test-advent.mjs`.

## Prvé nasadenie adventu
Pred prvým pushom raz spustite `npm install` (stiahne `@vercel/functions` pre `middleware.js`) a súbor
`package-lock.json` commitnite. Najprv skontrolujte Preview nasadenie (vetva/PR), až potom produkciu.
