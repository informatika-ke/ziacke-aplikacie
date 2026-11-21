// Spoločné kontroly obsahu žiackych súborov (galéria aj adventné kalendáre).
export const ALLOWED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.w3.org'];

export const RISKY = [
  [/<form[\s>]/i, 'formulár <form>'],
  [/\bfetch\s*\(/, 'volanie fetch()'],
  [/XMLHttpRequest/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/<iframe[\s>]/i, '<iframe>'],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/, 'e-mailová adresa'],
];

export const DISK_PATH = /\b[A-Za-z]:[\\/](?:Users|Documents|Desktop|Downloads)\b|file:\/\/\//i;

// Vráti zoznam domén (okrem povolených), na ktoré text odkazuje.
export function cudzieDomeny(text) {
  const out = new Set();
  for (const m of text.matchAll(/https?:\/\/([^\/\s"'<>)]+)/gi)) {
    const host = m[1].toLowerCase();
    if (!ALLOWED_HOSTS.includes(host)) out.add(host);
  }
  return [...out];
}
