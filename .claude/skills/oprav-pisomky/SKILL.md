---
name: oprav-pisomky
description: Opraví a obodnotí písomky z matematiky zo súborov PDF v priečinku pisomky/ (jeden PDF = jeden žiak), vrátane čiastkových bodov za postup, a výsledky zapíše do tabuľky (vysledky.md a vysledky.csv).
---

# Oprava písomiek z matematiky

Opravuješ písomky žiakov pre učiteľku. Pracuj po slovensky. Údaje žiakov sú súkromné: ostanú len v priečinku `pisomky/` (je v .gitignore), nikam ich neposielaj a nič z nich nepíš mimo tohto priečinka.

## 1. Nájdenie súborov
- Vezmi všetky `pisomky/**/*.pdf`. Ostatné súbory (jpg, jfif a pod.) ignoruj.
- Jeden PDF = jeden žiak. Meno (alebo značku) žiaka vezmi z názvu súboru.
- Ak argument obsahuje cestu k podpriečinku, spracuj len ten. Spracuj každý priečinok samostatne, výsledky patria do jeho priečinka.
- Ak nenájdeš žiadny PDF, napíš to a skonči.

## 2. Kľúč (`kluc.md`)
- Ak v priečinku existuje `kluc.md`, použi ho.
- Inak prečítaj zadania z PDF každej skupiny (A/B, býva v hlavičke strany), každú úlohu vyrieš sám a **over dosadením do pôvodnej rovnice** (pri absolútnej hodnote vždy do pôvodnej, nie do rozpísanej). Ulož `kluc.md`:
  - znenie úloh a body za každú úlohu (uvedené v zadaní, napr. „Úloha 3 (5 b)“),
  - správne výsledky vrátane množiny K,
  - rozpis čiastkových bodov za každú úlohu,
  - voliteľný riadok `Škála: 90/75/50/30`.
- **Pred opravou ukáž kľúč učiteľke a počkaj na potvrdenie.** Ak ho upraví, ulož zmeny.

## 3. Čiastkové body
Body úlohy rozdeľ na tieto časti podľa toho, čo úloha vyžaduje:
- správny postup (rozpísanie na prípady alebo intervaly, nulové body, tabuľka znamienok),
- podmienka (napr. pravá strana ≥ 0) a overenie, či koreň patrí do intervalu alebo spĺňa podmienku,
- správny výpočet každého koreňa,
- skúška do **pôvodnej** rovnice,
- zápis množiny K.

Pravidlá:
- Pri správnom postupe a numerickej chybe strhni len príslušnú časť.
- Ďalší postup po chybnom medzivýsledku hodnoť **nadväzne** (správny postup z chybnej hodnoty sa uznáva).
- Nepravdivé „sedí“ v skúške, skúška bez absolútnej hodnoty a chýbajúce K stoja čiastku bodu.
- Prečiarknuté pokusy nehodnoť, ak je vedľa nich platné riešenie.
- Bod uber len za to, čo sa dá z písomky preukázať. Pri pochybnostiach v prospech žiaka a označ ⚠.

## 4. Oprava
- PDF čítaj po stranách (najviac 20 strán naraz). Pri každej úlohe zapíš body, čo bolo správne a kde je chyba.
- Nečitateľné alebo neisto prečítané miesta označ ⚠ a uveď ich v stĺpci „Na kontrolu“.
- Skupinu žiaka urč podľa hlavičky strany.

## 5. Výstup
Do `pisomky/<priečinok>/` ulož:
- **`vysledky.md`**
  - súhrnná tabuľka: `Žiak | Skupina | Ú1 | Ú2 | Ú3 | Ú4 | Spolu | % | Známka | Na kontrolu` (stĺpce úloh podľa kľúča),
  - pod ňou rozpis po žiakoch (body za čiastky + krátke zdôvodnenie),
  - časté chyby v triede.
- **`vysledky.csv`**: rovnaká súhrnná tabuľka, UTF-8 s BOM, oddeľovač `;`, aby sa dala otvoriť v Exceli.

Známky: predvolená škála 90/75/50/30 % pre 1/2/3/4 (pod 30 % = 5). Ak je v `kluc.md` riadok `Škála:`, použi ten.

Na konci stručne zhrň výsledok v chate (priemer, kto je na hrane známky, čo treba overiť na origináli) a pripomeň, že body sú návrh, ktorý má učiteľka skontrolovať.
