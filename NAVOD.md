# Návod: galéria žiackych aplikácií

## Pridanie aplikácie (každý týždeň / po odovzdaní)
1. Skontrolujte, že máte **súhlas zákonného zástupcu** (`SUHLAS-vzor.md`). Bez súhlasu nezverejňujte.
2. Žiak odovzdá ZIP (EduPage/Classroom). Rozbaľte ho do `ROK/TRIEDA/nazov-aplikacie-iniciali/`,
   napr. `2026-27/1A/pexeso-auta-mk/`. V priečinku musí byť `index.html`.
   Názvy priečinkov: malé písmená, bez diakritiky a medzier.
3. Aplikáciu si otvorte v prehliadači a pozrite sa, či je obsah slušný a bez osobných údajov
   (celé mená, fotky žiakov, telefóny, e-maily).
4. Pridajte záznam do `apps.json`:
   ```json
   { "rok": "2026-27", "trieda": "1.A", "priecinok": "2026-27/1A/pexeso-auta-mk",
     "nazov": "Pexeso: autá", "autor": "M. K.", "typ": "pexeso" }
   ```
   `autor` = iba iniciály alebo prezývka (podľa súhlasu). `trieda` je text, ktorý sa zobrazí.
5. Spustite `node tools/build.mjs`. Opravte všetky CHYBY a prečítajte si UPOZORNENIA
   (napr. `fetch()`, cudzie domény, veľké obrázky).
6. Odošlite zmeny: `git add .`, `git commit -m "Pridané: pexeso autá"`, `git push`.
   Vercel stránku sám nasadí do minúty.

## Nový školský rok
Vytvorte priečinky `2027-28/...` a pridávajte záznamy s `"rok": "2027-28"`.
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
