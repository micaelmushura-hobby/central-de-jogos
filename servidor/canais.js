// Reconhece nomes de canais escritos pelos guias e liga cada um ao seu logo local.
const fs = require('fs');
const path = require('path');
const { semAcento } = require('./util');

const PASTA = path.join(__dirname, '..', 'assets', 'logos', 'canais');

// [padrão, slug do logo, nome exibido]. A ordem importa: o primeiro que casar vence.
const CANAIS = [
  [/^(tv )?globo( \(.*\))?$|^rede globo/, 'globo', 'Globo'],
  [/^globoplay/, 'globoplay', 'Globoplay'],
  [/^premiere/, 'premiere', 'Premiere'],
  [/^sportv ?(\d)?$/, 'sportv', null],
  [/^ge ?tv/, 'getv', 'ge tv'],
  [/^record( ?tv)?$/, 'record', 'Record'],
  [/^recordplus|^r7/, null, null],
  [/^caze ?tv/, 'cazetv', 'CazéTV'],
  [/^(amazon )?prime( video)?/, 'primevideo', 'Prime Video'],
  [/^disney ?(\+|plus)/, 'disneyplus', 'Disney+'],
  [/^espn ?(\d)?( brasil)?$/, 'espn', null],
  [/^rede ?tv/, 'redetv', 'RedeTV!'],
  [/^band( sports)?$|^bandeirantes/, 'band', null],
  [/^paramount/, 'paramountplus', 'Paramount+'],
  [/^(hbo )?max$|^hbo max/, 'hbomax', 'HBO Max'],
  [/^pluto/, 'plutotv', 'Pluto TV'],
  [/^xsports?/, 'xsports', 'Xsports']
];

function extensao(slugLogo) {
  for (const ext of ['.svg', '.png', '.webp', '.jpg']) if (fs.existsSync(path.join(PASTA, slugLogo + ext))) return ext;
  return null;
}

// Recebe "ESPN 4", "TV Globo", "CazéTV (YouTube)"... e devolve { nome, logo } ou null (para ignorar).
function identificar(bruto) {
  const limpo = bruto.replace(/\s*\((youtube|tv e youtube|regional)\)\s*/gi, ' ').trim();
  const chave = semAcento(limpo).toLowerCase().replace(/\s+/g, ' ');
  for (const [re, logo, nome] of CANAIS) {
    if (!re.test(chave)) continue;
    if (!logo) return null; // canal duplicado de outro (ex.: R7.com junto com Record)
    const ext = extensao(logo);
    return { nome: nome || limpo, logo: ext ? `/assets/logos/canais/${logo}${ext}` : null, chave: logo };
  }
  return { nome: limpo, logo: null, chave: chave };
}

// "Record, R7.com, RecordPlus, CazéTV e Premiere" -> lista de canais sem repetição.
function separar(texto) {
  const partes = texto.split(/,|\s+e\s+/).map(s => s.trim()).filter(Boolean);
  const vistos = new Set();
  const lista = [];
  for (const p of partes) {
    const c = identificar(p);
    if (!c) continue;
    const k = c.nome.toLowerCase();
    if (vistos.has(k)) continue;
    vistos.add(k);
    lista.push(c);
  }
  return lista;
}

function creditos() {
  try { return JSON.parse(fs.readFileSync(path.join(PASTA, 'fontes.json'), 'utf8')); } catch { return {}; }
}

module.exports = { identificar, separar, creditos };
