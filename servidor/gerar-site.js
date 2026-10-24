// Gera a versão online da Central de Jogos na pasta _site/ (publicada pelo GitHub Pages).
// Roda sozinho no GitHub Actions a cada 30 minutos. Para testar no computador: node servidor/gerar-site.js
const fs = require('fs');
const path = require('path');
const U = require('./util');
const { buscarJogos } = require('./busca');
const render = require('./render');

const RAIZ = path.join(__dirname, '..');
const SITE = path.join(RAIZ, '_site');

// Os escudos e logos de campeonato baixados ficam no computador que gerou os dados;
// no site, apontam direto para a ESPN (que permite esse uso no navegador).
function logoPublico(url) {
  if (!url) return null;
  const time = url.match(/\/assets\/logos\/times\/espn-(\d+)\.png$/);
  if (time) return `https://a.espncdn.com/i/teamlogos/soccer/500/${time[1]}.png`;
  return url.replace(/^\//, ''); // logos dos canais: arquivos publicados junto com o site
}

function copiarPasta(origem, destino) {
  fs.mkdirSync(destino, { recursive: true });
  for (const item of fs.readdirSync(origem, { withFileTypes: true })) {
    const o = path.join(origem, item.name), d = path.join(destino, item.name);
    if (item.isDirectory()) copiarPasta(o, d); else fs.copyFileSync(o, d);
  }
}

(async () => {
  fs.rmSync(SITE, { recursive: true, force: true });
  fs.mkdirSync(path.join(SITE, 'dados'), { recursive: true });
  fs.copyFileSync(path.join(RAIZ, 'index.html'), path.join(SITE, 'index.html'));
  copiarPasta(path.join(RAIZ, 'assets', 'logos', 'canais'), path.join(SITE, 'assets', 'logos', 'canais'));
  copiarPasta(path.join(RAIZ, 'assets', 'fontes'), path.join(SITE, 'assets', 'fontes'));
  fs.writeFileSync(path.join(SITE, '.nojekyll'), '');

  const hoje = U.hojeISO();
  const datas = [hoje, U.somarDias(hoje, 1)];
  const geradas = [];
  for (const iso of datas) {
    try {
      const dados = await buscarJogos(iso, msg => console.log(`[${iso}] ${msg}`));
      for (const j of dados.jogos) {
        j.mandante.logo = j.mandante.logo && j.mandante.logoRemoto ? j.mandante.logoRemoto : logoPublico(j.mandante.logo);
        j.visitante.logo = j.visitante.logo && j.visitante.logoRemoto ? j.visitante.logoRemoto : logoPublico(j.visitante.logo);
        j.ligaLogo = j.ligaLogoRemoto || null;
        j.canais.forEach(c => { c.logo = logoPublico(c.logo); });
        delete j.mandante.logoRemoto; delete j.visitante.logoRemoto; delete j.ligaLogoRemoto; delete j.estadioBusca;
      }
      fs.writeFileSync(path.join(SITE, 'dados', `${iso}.json`), JSON.stringify(dados));
      geradas.push(iso);
      console.log(`[${iso}] ${dados.jogos.length} jogos · fontes: ${dados.fontes.map(f => `${f.nome.split(' — ')[0]} ${f.ok ? 'ok' : 'FALHOU'}`).join(', ')}`);
    } catch (e) {
      console.error(`[${iso}] erro: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(SITE, 'dados', 'indice.json'), JSON.stringify({
    geradoEm: `${U.isoParaBR(U.hojeISO())} ${U.agoraHHMM()}`, datas: geradas
  }));
  render.encerrar();
  if (!geradas.length) { console.error('Nenhuma data gerada.'); process.exit(1); }
  console.log(`Site gerado em ${SITE}`);
  process.exit(0);
})();
