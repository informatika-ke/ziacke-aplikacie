// Učiteľská stránka: zobrazí prihlásenie alebo nástroje podľa učiteľskej značky; skutočné overenie robí server.
const prihlasena = /(?:^|;\s*)advent_ucitel_ok=1(?:;|$)/.test(document.cookie);
document.getElementById(prihlasena ? 'uc-nastroje' : 'uc-prihlasenie').hidden = false;
if (new URLSearchParams(location.search).has('chyba')) document.getElementById('uc-chyba').hidden = false;

document.getElementById('uc-vyber').addEventListener('submit', (e) => {
  e.preventDefault();
  const trieda = document.getElementById('uc-trieda').value;
  const datum = document.getElementById('uc-datum').value;
  location.href = `../${trieda}/` + (datum ? `?datum=${datum}` : '');
});
