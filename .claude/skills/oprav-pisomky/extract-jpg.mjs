// Vytiahne JPEG (DCTDecode) obrázky zo skenovaných PDF. Použitie: node extract-jpg.mjs <vstupny_priecinok> <vystupny_priecinok>
import fs from 'node:fs';
import path from 'node:path';

const [, , inDir, outDir] = process.argv;
fs.mkdirSync(outDir, { recursive: true });

for (const f of fs.readdirSync(inDir).filter(n => n.toLowerCase().endsWith('.pdf')).sort()) {
  const buf = fs.readFileSync(path.join(inDir, f));
  const txt = buf.toString('latin1');
  const re = /<<([^>]*?\/DCTDecode[^>]*?)>>\s*stream\r?\n/g;
  let m, i = 0;
  while ((m = re.exec(txt))) {
    const start = m.index + m[0].length;
    const lenM = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(m[1]);
    let end = lenM ? start + parseInt(lenM[1], 10) : txt.indexOf('endstream', start);
    if (!lenM || buf.readUInt16BE(start) !== 0xffd8 || txt.slice(end, end + 12).indexOf('endstream') < 0 && !/^\s*endstream/.test(txt.slice(end, end + 12))) {
      end = txt.indexOf('endstream', start);
    }
    const data = buf.subarray(start, end);
    if (data[0] !== 0xff || data[1] !== 0xd8) { console.log(`${f}: stream ${i} nie je JPEG`); continue; }
    i++;
    const out = path.join(outDir, `${path.basename(f, '.pdf')}_s${i}.jpg`);
    fs.writeFileSync(out, data);
  }
  console.log(`${f}: ${i} obrázkov`);
}
