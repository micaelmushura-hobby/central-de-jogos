// Fotos de fundo dos banners.
// 1) Foto sua em assets/fundos/<time>.jpg (ex.: vasco.jpg) — tem prioridade.
// 2) Foto do estádio na Wikipédia, só se o arquivo no Wikimedia Commons tiver licença livre (CC ou domínio público).
const fs = require('fs');
const path = require('path');
const { slug, textoDeHtml, semAcento } = require('./util');

const RAIZ = path.join(__dirname, '..');
const PASTA_FOTOS = path.join(RAIZ, 'assets', 'fotos');
const PASTA_FUNDOS = path.join(RAIZ, 'assets', 'fundos');
const REGISTRO = path.join(PASTA_FOTOS, 'fontes.json');
const UA_WIKI = { 'User-Agent': 'CentralDeJogos/1.0 (uso pessoal; projeto local)' };
const SEM_FOTO_DIAS = 7;

// O Wikimedia limita consultas seguidas: espaça os pedidos e tenta de novo quando recusar (HTTP 429).
let ultimoPedido = 0;
class ErroTemporario extends Error {}
async function pedirWiki(url, comoJSON = true) {
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    const espera = ultimoPedido + 1100 - Date.now();
    if (espera > 0) await new Promise(r => setTimeout(r, espera));
    ultimoPedido = Date.now();
    let resp;
    try { resp = await fetch(url, { headers: UA_WIKI }); } catch { resp = null; }
    if (resp && resp.ok) return comoJSON ? resp.json() : Buffer.from(await resp.arrayBuffer());
    if (resp && resp.status !== 429 && resp.status < 500) return null;
    await new Promise(r => setTimeout(r, 3000 * tentativa));
  }
  throw new ErroTemporario('Wikimedia indisponível no momento');
}

const lerRegistro = () => { try { return JSON.parse(fs.readFileSync(REGISTRO, 'utf8')); } catch { return {}; } };
const PALAVRAS_GENERICAS = new Set(['estadio', 'estadio', 'arena', 'stadium', 'municipal', 'de', 'do', 'da', 'dos', 'das', 'el', 'la', 'the', 'park', 'stade', 'stadion', 'campo']);

function fundoDoUsuario(nomesTimes) {
  if (!fs.existsSync(PASTA_FUNDOS)) return null;
  const arquivos = fs.readdirSync(PASTA_FUNDOS).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  for (const nome of nomesTimes) {
    const s = slug(nome);
    const achado = arquivos.find(f => slug(path.parse(f).name) === s);
    if (achado) return { url: `/assets/fundos/${encodeURIComponent(achado)}`, credito: 'Foto: arquivo pessoal' };
  }
  return null;
}

// O título da página encontrada precisa ter uma palavra própria do nome do estádio.
function pareceOMesmoLugar(estadio, titulo) {
  const pal = s => semAcento(s).toLowerCase().split(/[^a-z0-9]+/).filter(p => p.length > 2 && !PALAVRAS_GENERICAS.has(p));
  const a = new Set(pal(estadio));
  return pal(titulo).some(p => a.has(p));
}

async function fotoDoEstadio(estadio) {
  if (!estadio) return null;
  const chave = slug(estadio);
  const registro = lerRegistro();
  const r0 = registro[chave];
  if (r0 && r0.arquivo && fs.existsSync(path.join(PASTA_FOTOS, r0.arquivo))) return { url: `/assets/fotos/${r0.arquivo}`, credito: r0.credito };
  if (r0 && r0.semFoto && (Date.now() - Date.parse(r0.semFoto)) < SEM_FOTO_DIAS * 864e5) return null;
  let resultado = null;
  try {
    for (const wiki of ['pt', 'en']) {
      const busca = await pedirWiki(`https://${wiki}.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=1&prop=pageimages&piprop=name&gsrsearch=${encodeURIComponent(estadio)}`);
      const pagina = busca && Object.values(busca.query?.pages || {})[0];
      if (!pagina?.pageimage || !pareceOMesmoLugar(estadio, pagina.title)) continue;
      const info = await pedirWiki(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600&titles=${encodeURIComponent('File:' + pagina.pageimage)}`);
      const img = info && Object.values(info.query?.pages || {})[0]?.imageinfo?.[0];
      if (!img) continue; // não está no Commons (pode ser uso restrito da Wikipédia)
      const licenca = textoDeHtml(img.extmetadata?.LicenseShortName?.value);
      if (!/^(cc|public domain|domínio público|pd)/i.test(licenca) || /fair use|non-free/i.test(licenca)) continue;
      const bytes = await pedirWiki(img.thumburl || img.url, false);
      if (!bytes) continue;
      fs.mkdirSync(PASTA_FOTOS, { recursive: true });
      const arquivo = `${chave}.jpg`;
      fs.writeFileSync(path.join(PASTA_FOTOS, arquivo), bytes);
      const autor = textoDeHtml(img.extmetadata?.Artist?.value).slice(0, 60) || 'autor não informado';
      resultado = { arquivo, credito: `Foto: ${autor} · ${licenca} · Wikimedia Commons`, origem: img.descriptionurl, pagina: pagina.title };
      break;
    }
  } catch (e) {
    if (e instanceof ErroTemporario) return null; // não grava: tenta de novo no próximo banner
    resultado = null;
  }
  registro[chave] = resultado || { semFoto: new Date().toISOString() };
  fs.mkdirSync(PASTA_FOTOS, { recursive: true });
  fs.writeFileSync(REGISTRO, JSON.stringify(registro, null, 2));
  return resultado ? { url: `/assets/fotos/${resultado.arquivo}`, credito: resultado.credito } : null;
}

async function fundoDoJogo(jogo) {
  return fundoDoUsuario([jogo.mandante.nome, jogo.visitante.nome]) || await fotoDoEstadio(jogo.estadio);
}

module.exports = { fundoDoJogo };
