// Minimálny ZIP (bez kompresie) na zálohu aktivít. Bez závislostí.
const TABULKA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABULKA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// subory: [{ name: 'trieda/07.html', data: Uint8Array }]
export function zip(subory, teraz = new Date()) {
  const enc = new TextEncoder();
  const cas = (teraz.getHours() << 11) | (teraz.getMinutes() << 5) | (teraz.getSeconds() >> 1);
  const datum = ((teraz.getFullYear() - 1980) << 9) | ((teraz.getMonth() + 1) << 5) | teraz.getDate();
  const casti = [];
  const centralne = [];
  let posun = 0;
  for (const s of subory) {
    const meno = enc.encode(s.name);
    const crc = crc32(s.data);
    const hlava = new DataView(new ArrayBuffer(30));
    hlava.setUint32(0, 0x04034b50, true);
    hlava.setUint16(4, 20, true);
    hlava.setUint16(6, 0x0800, true); // názvy v UTF-8
    hlava.setUint16(8, 0, true); // bez kompresie
    hlava.setUint16(10, cas, true);
    hlava.setUint16(12, datum, true);
    hlava.setUint32(14, crc, true);
    hlava.setUint32(18, s.data.length, true);
    hlava.setUint32(22, s.data.length, true);
    hlava.setUint16(26, meno.length, true);
    hlava.setUint16(28, 0, true);
    casti.push(new Uint8Array(hlava.buffer), meno, s.data);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, cas, true);
    c.setUint16(14, datum, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, s.data.length, true);
    c.setUint32(24, s.data.length, true);
    c.setUint16(28, meno.length, true);
    c.setUint32(42, posun, true);
    centralne.push(new Uint8Array(c.buffer), meno);
    posun += 30 + meno.length + s.data.length;
  }
  const velkostCentralnych = centralne.reduce((a, x) => a + x.length, 0);
  const koniec = new DataView(new ArrayBuffer(22));
  koniec.setUint32(0, 0x06054b50, true);
  koniec.setUint16(8, subory.length, true);
  koniec.setUint16(10, subory.length, true);
  koniec.setUint32(12, velkostCentralnych, true);
  koniec.setUint32(16, posun, true);
  const vsetko = [...casti, ...centralne, new Uint8Array(koniec.buffer)];
  const out = new Uint8Array(vsetko.reduce((a, x) => a + x.length, 0));
  let p = 0;
  for (const x of vsetko) { out.set(x, p); p += x.length; }
  return out;
}
