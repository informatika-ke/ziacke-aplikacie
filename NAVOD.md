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

Úvodná stránka má tlačidlo „🎄 Adventné kalendáre“, výber triedy je na `/advent/2026/`, kalendáre na
`/advent/2026/<trieda>/`. Okienko N sa odomkne N. decembra o polnoci (čas Europe/Bratislava), po 24. 12.
ostanú všetky otvorené. Zamknuté dni stráži server: otvoriť ich cez priamu adresu nejde, ani keď žiak zmení hodiny.

## Ako sa dostane aktivita do kalendára (bez Gitu)
1. **Žiak** otvorí `/advent/2026/odovzdat/`, vyberie triedu a deň, zadá **kód triedy**, meno a priezvisko a nahrá svoj `index.html`.
   Dostane **kontrolný kód** (napr. `K7M2`) a automatické upozornenia (`localStorage`, `fetch`, odkazy na súbory…).
2. **Žiak vás zavolá** a povie kontrolný kód. Aktivita je zatiaľ len „čakajúca“, verejne sa nikde nezobrazí.
3. **Vy** na vlastnom zariadení otvoríte `/advent/2026/ucitel/` (prihlásite sa heslom), v časti „Čakajúce na schválenie“
   nájdete kód, kliknete **Náhľad** (aktivita beží v izolovanom okne), a potom **Schváliť a zverejniť** alebo **Zamietnuť**.
4. Schválená aktivita sa zverejní hneď (bez deployu). Žiakom sa otvorí až v deň odomknutia okienka.
   Chybnú zverejnenú aktivitu môžete **Zmazať** a žiak nahrá novú.

**Heslo nezadávajte na počítači žiaka** (cookie sa ukladá na 30 dní).

Pravidlá pre žiakov (v prompte aj na odovzdávacej stránke): jeden HTML súbor do 300 kB, bez internetu, bez
`localStorage`/cookies, `fetch`, `<form>`, `<iframe>`, obrázky len ako emoji/CSS/SVG/`data:`, texty po slovensky, mobil aj počítač.

## Jednorazové nastavenie vo Verceli
1. **Úložisko:** Project → **Storage** → **Create Database/Store** → **Blob** → pripojte k projektu (ponechajte **Private**).
   Vercel sám pridá premennú `BLOB_READ_WRITE_TOKEN`.
2. **Environment Variables** (zaškrtnite Production aj Preview):
   - `ADVENT_UCITEL_HESLO` – vaše heslo,
   - `ADVENT_TAJNY_KLUC` – náhodný reťazec aspoň 16 znakov (podpisuje cookie, nikdy ho nezadávate),
   - `ADVENT_KODY` – kódy tried vo tvare `1a=slovo1,1b=slovo2,1c=slovo3,1d=slovo4,1g=slovo5,1r=slovo6`
     (kód povedzte žiakom v škole; veľkosť písmen sa neráta).
3. **Redeploy**, aby sa premenné dostali do nasadenia.

## Záloha
Na učiteľskej stránke tlačidlo **Stiahnuť zálohu všetkých aktivít (ZIP)** (súbory `<trieda>/<NN>.html`). Aktivity
nie sú v Gite, odporúčam zálohu stiahnuť po každom väčšom schvaľovaní a pred koncom projektu.

## Učiteľský testovací režim
Na `/advent/2026/ucitel/` vyberiete triedu a simulovaný dátum a otvorí sa kalendár s `?datum=RRRR-MM-DD`.
Simulácia funguje len s vašou prihlasovacou cookie; bez nej server `?datum` ignoruje.

## Nastavenia a vzhľad
`advent.json`: zoznam tried, farebné motívy, obrázky a polohy okienok. Po zmene spustite `node tools/build.mjs`.
Testy: `node tools/test-advent.mjs`.

## Obmedzenia
- Pre každú dvojicu trieda + deň je najviac jedna čakajúca a jedna zverejnená aktivita (nové nahratie čakajúcu prepíše).
- Kód triedy pozná celá trieda; kto ho má, môže nahrať súbor (nič sa ale nezverejní bez vášho schválenia).
- Odovzdať sa dá súbor do 300 kB (ak by to bolo málo, upraví sa `MAX_AKTIVITA_BAJTOV` v `lib/kontrola.js`).
