// Baixa os logos dos canais do Wikimedia Commons e registra origem e licença.
// Uso (uma vez, ou para atualizar): node servidor/baixar-logos-canais.js
const fs = require('fs');
const path = require('path');

const DESTINO = path.join(__dirname, '..', 'assets', 'logos', 'canais');
const REGISTRO = path.join(DESTINO, 'fontes.json');

// slug do canal -> arquivo no Wikimedia Commons
const ARQUIVOS = {
  globo: 'TV Globo 2025.svg',
  premiere: 'Premiere FC logo.png',
  sportv: 'Logotipo do SporTV (2021).svg',
  record: 'Logomarca da Record (2023).webp',
  cazetv: 'CazéTV wordmark.svg',
  primevideo: 'Prime Video logo (2024).svg',
  disneyplus: 'Disney+ logo.svg',
  espn: 'ESPN wordmark.svg',
  redetv: 'RedeTV-Logotipo.svg',
  band: 'Rede Bandeirantes logo 2018.svg',
  paramountplus: 'Paramount+ logo.svg',
  hbomax: 'HBO Max 2025.svg',
  globoplay: 'Globoplay logo 2020.svg',
  plutotv: 'Pluto TV logo 2024.svg',
  xsports: 'Logo-xsports-ago-2025.png',
  getv: 'Logo GE TV.svg'
};

const semTags = s => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

(async () => {
  fs.mkdirSync(DESTINO, { recursive: true });
  const titulos = Object.values(ARQUIVOS).map(a => 'File:' + a).join('|');
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&titles=' + encodeURIComponent(titulos);
  const resp = await fetch(api, { headers: { 'User-Agent': 'CentralDeJogos/1.0 (uso pessoal)' } });
  const dados = await resp.json();
  const porTitulo = {};
  for (const p of Object.values(dados.query.pages)) porTitulo[p.title.replace(/^File:/, '')] = p;
  const norm = dados.query.normalized || [];
  const nomeFinal = a => (norm.find(n => n.from === 'File:' + a)?.to || 'File:' + a).replace(/^File:/, '');

  const registro = fs.existsSync(REGISTRO) ? JSON.parse(fs.readFileSync(REGISTRO, "utf8")) : {};
  for (const [slug, arquivo] of Object.entries(ARQUIVOS)) {
    const p = porTitulo[nomeFinal(arquivo)];
    if (!p || !p.imageinfo) { console.log(`FALHOU ${slug}: ${arquivo} não encontrado`); continue; }
    const info = p.imageinfo[0];
    const url = info.url.split("?")[0];
    const ext = path.extname(url).toLowerCase();
    const local = slug + ext;
    if (registro[slug] && fs.existsSync(path.join(DESTINO, registro[slug].arquivo))) { console.log(`já existe ${slug}`); continue; }
    let img;
    for (let tentativa = 1; tentativa <= 5; tentativa++) {
      img = await fetch(url, { headers: { 'User-Agent': 'CentralDeJogos/1.0 (uso pessoal)' } });
      if (img.status !== 429) break;
      await new Promise(r => setTimeout(r, 4000 * tentativa));
    }
    if (!img.ok) { console.log(`FALHOU ${slug}: HTTP ${img.status}`); continue; }
    fs.writeFileSync(path.join(DESTINO, local), Buffer.from(await img.arrayBuffer()));
    registro[slug] = {
      arquivo: local,
      origem: info.descriptionurl,
      licenca: semTags(info.extmetadata.LicenseShortName?.value) || 'não informada',
      autor: semTags(info.extmetadata.Artist?.value) || 'não informado',
      baixado_em: new Date().toISOString().slice(0, 10)
    };
    console.log(`ok ${slug}: ${local} (${registro[slug].licenca})`);
    await new Promise(r => setTimeout(r, 2500));
  }
  fs.writeFileSync(REGISTRO, JSON.stringify(registro, null, 2));
  console.log(`Registro salvo em ${REGISTRO}`);
})();
