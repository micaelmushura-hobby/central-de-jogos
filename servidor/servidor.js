// Central de Jogos: servidor local (só no seu computador) que busca os jogos e gera os banners em PNG.
// Uso: node servidor/servidor.js   (ou dois cliques em "Abrir Central de Jogos.bat")
const http = require('http');
const fs = require('fs');
const path = require('path');
const U = require('./util');
const { buscarJogos, similaridade } = require('./busca');
const banner = require('./banner');
const { fundoDoJogo } = require('./fotos');
const render = require('./render');
const canais = require('./canais');

const PORTA = 8765;
const RAIZ = path.join(__dirname, '..');
const SAIDAS = path.join(RAIZ, 'saidas');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

let progresso = { msg: '', ativo: false };
const avisar = msg => { progresso = { msg, ativo: true }; console.log(`[${U.agoraHHMM()}] ${msg}`); };

// ---------------- Pastas de resultado ----------------
function novaPasta(iso, rotulo) {
  const base = `${iso}_${rotulo}_${U.agoraHHMM().replace(':', 'h')}`;
  let nome = base;
  for (let n = 2; fs.existsSync(path.join(SAIDAS, nome)); n++) nome = `${base}_${n}`;
  fs.mkdirSync(path.join(SAIDAS, nome), { recursive: true });
  return nome;
}
const pastaSegura = nome => /^[\w.-]+$/.test(nome || '') && fs.existsSync(path.join(SAIDAS, nome)) ? path.join(SAIDAS, nome) : null;
const lerDados = pasta => JSON.parse(fs.readFileSync(path.join(pasta, 'dados.json'), 'utf8'));

// ---------------- Filtros ----------------
const norm = s => U.semAcento(s).toLowerCase().trim();
function filtrarTimeOuCampeonato(jogos, termo) {
  const t = norm(termo);
  return jogos.filter(j => norm(j.campeonato).includes(t)
    || [j.mandante, j.visitante].some(x => similaridade(termo, [x.nome, x.nomeCompleto]) >= 0.99 || norm(x.nome).includes(t)));
}
function separarPartida(texto) {
  const p = texto.split(/\s+(?:x|vs\.?|versus|contra)\s+/i);
  return p.length === 2 ? p.map(s => s.trim()) : null;
}
const casaPartida = (j, a, b) => {
  const s = (x, n) => similaridade(n, [x.nome, x.nomeCompleto]);
  return (s(j.mandante, a) >= 0.99 && s(j.visitante, b) >= 0.99) || (s(j.mandante, b) >= 0.99 && s(j.visitante, a) >= 0.99);
};
// Procura, nos próximos dias, a data de um confronto (dados da ESPN, rápido).
async function dataDoConfronto(a, b, inicio, dias = 21) {
  for (let i = 0; i < dias; i++) {
    const iso = U.somarDias(inicio, i);
    avisar(`Procurando ${a} x ${b} em ${U.isoParaBR(iso)}…`);
    const lista = [];
    for (const d of [iso, U.somarDias(iso, 1)]) {
      const j = await U.buscarJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${d.replace(/-/g, '')}&limit=1000&lang=pt&region=br`);
      (j?.events || []).forEach(e => lista.push(e));
    }
    const achou = lista.some(e => {
      if (U.utcParaBrasilia(e.date).data !== iso) return false;
      const ts = e.competitions?.[0]?.competitors?.map(c => [c.team?.displayName, c.team?.shortDisplayName]) || [];
      if (ts.length !== 2) return false;
      const ok = (n, t) => similaridade(n, t) >= 0.99;
      return (ok(a, ts[0]) && ok(b, ts[1])) || (ok(a, ts[1]) && ok(b, ts[0]));
    });
    if (achou) return iso;
  }
  return null;
}

// ---------------- Página de resultado (abre direto do disco) ----------------
function paginaResultado(pasta) {
  const d = lerDados(pasta);
  const pngs = fs.readdirSync(pasta).filter(f => f.endsWith('.png')).sort();
  const rel = u => u ? u.replace(/^\/assets\//, '../../assets/') : u;
  const status = j => j.transmissao === 'guia' ? '<span class="tag ok">Canais segundo o guia Olhar Digital</span>' : '<span class="tag nc">Transmissão não confirmada</span>';
  const credCanais = canais.creditos();
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${d.titulo} · ${U.isoParaBR(d.data)}</title><style>
:root{--bg:#0c1018;--card:#151b26;--line:#263043;--text:#e9eef5;--muted:#9aa6b6;--ok:#22c55e;--warn:#f59e0b;--link:#7cc4ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 "Segoe UI",system-ui,Arial,sans-serif}
.wrap{max-width:980px;margin:0 auto;padding:24px 16px 48px}h1{margin:0;font-size:clamp(1.5rem,5vw,2.2rem)}
.sub{color:var(--muted);margin:4px 0 0}.consulta{display:inline-block;margin-top:10px;padding:6px 12px;border-radius:999px;background:#12301e;color:#b7f5cc;font-size:.9rem}
.aviso{margin:14px 0 0;padding:10px 14px;border-left:4px solid var(--warn);background:#2a2110;border-radius:8px}
h2{font-size:1.05rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:28px 0 12px}
.galeria{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.galeria a{display:block;color:var(--muted);font-size:.8rem;text-decoration:none;overflow-wrap:anywhere}
.galeria img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:10px;border:1px solid var(--line);display:block;margin-bottom:4px}
.jogo{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:10px}
.lin{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.hora{font-size:1.4rem;font-weight:800;color:var(--ok);min-width:72px}
.tms{font-weight:700;font-size:1.1rem;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.tms img{width:28px;height:28px;object-fit:contain}
.camp{color:var(--muted);font-size:.85rem}.tag{font-size:.8rem;padding:3px 8px;border-radius:6px;border:1px solid var(--line)}
.tag.ok{background:#10291a;border-color:#1f6f3f}.tag.nc{background:#2a2110;border-color:#7a5a12;color:#fcd58a}
.det{font-size:.88rem;color:var(--muted);margin:6px 0 0}.div{color:#fca5a5}a{color:var(--link);overflow-wrap:anywhere}li{margin-bottom:6px}
</style></head><body><div class="wrap">
<h1>${U.escHtml(d.titulo)}</h1><p class="sub">${U.escHtml(banner.dataExtensa(d.data))} · horários de Brasília (America/Sao_Paulo)</p>
<span class="consulta">Consulta feita em ${U.escHtml(d.consultadoEm)} (Brasília)</span>
${d.avisos.map(a => `<p class="aviso">${U.escHtml(a)}</p>`).join('')}
${pngs.length ? `<h2>Banners (PNG 1080×1920)</h2><div class="galeria">${pngs.map(p => `<a href="${p}" target="_blank"><img src="${p}" loading="lazy" alt="">${p}</a>`).join('')}</div>` : ''}
<h2>Jogos (${d.jogos.length})</h2>
${d.jogos.map(j => `<div class="jogo"><div class="camp">${U.escHtml(j.campeonato)}${j.estadio ? ' · ' + U.escHtml(j.estadio) : ''}</div>
<div class="lin"><span class="hora">${banner.horaBR(j.hora)}</span><span class="tms">${j.mandante.logo ? `<img src="${rel(j.mandante.logo)}" alt="">` : ''}${U.escHtml(j.mandante.nome)} x ${j.visitante.logo ? `<img src="${rel(j.visitante.logo)}" alt="">` : ''}${U.escHtml(j.visitante.nome)}</span></div>
<div class="lin" style="margin-top:6px">${status(j)} ${j.canais.map(c => `<span class="tag">${U.escHtml(c.nome)}</span>`).join(' ')}</div>
${j.globoRegioes ? `<p class="det">Globo: ${U.escHtml(j.globoRegioes)}</p>` : ''}
${j.confirmacoes.map(c => `<p class="det">✓ ${U.escHtml(c)}</p>`).join('')}
${j.divergencias.map(c => `<p class="det div">⚠ Divergência — ${U.escHtml(c)}</p>`).join('')}
<p class="det">Fontes: ${j.fontes.map(f => `<a href="${U.escHtml(f.url)}" target="_blank" rel="noopener">${U.escHtml(f.nome)}</a>`).join(' · ')}</p></div>`).join('')}
<h2>Fontes consultadas</h2><ol>${d.fontes.map(f => `<li><a href="${U.escHtml(f.url)}" target="_blank" rel="noopener">${U.escHtml(f.nome)}</a> — ${f.ok ? '' : '<strong>falhou:</strong> '}${U.escHtml(f.obs)}</li>`).join('')}</ol>
<h2>Imagens</h2><p class="det">Escudos e logos de campeonatos: ESPN (marcas dos respectivos clubes e entidades). Logos de canais: Wikimedia Commons
(${Object.entries(credCanais).map(([k, v]) => `${k}: ${U.escHtml(v.licenca)}`).join('; ')}). Fotos de estádio: Wikimedia Commons, com autor e licença no próprio banner.
As artes são não oficiais, para uso pessoal.</p>
</div></body></html>`;
  fs.writeFileSync(path.join(pasta, 'lista.html'), html);
}

// ---------------- Rotas ----------------
async function apiJogos(q) {
  const modo = q.get('modo') || 'dia';
  const filtro = (q.get('filtro') || '').trim();
  let iso = /^\d{4}-\d{2}-\d{2}$/.test(q.get('data') || '') ? q.get('data') : U.hojeISO();
  let titulo = iso === U.hojeISO() ? 'Jogos de hoje' : 'Jogos do dia';
  let rotulo = 'jogos-do-dia';
  let par = null;
  if (modo === 'partida') {
    par = separarPartida(filtro);
    if (!par) return { erro: 'Escreva a partida no formato "Time A x Time B".' };
    const achada = await dataDoConfronto(par[0], par[1], iso);
    if (!achada) return { erro: `Não encontrei ${par[0]} x ${par[1]} nos próximos 21 dias a partir de ${U.isoParaBR(iso)}.` };
    iso = achada;
    titulo = `${par[0]} x ${par[1]}`;
    rotulo = 'banner_' + U.slug(filtro);
  } else if (modo === 'time') {
    if (!filtro) return { erro: 'Informe um time ou campeonato.' };
    titulo = `Jogos: ${filtro}`;
    rotulo = 'jogos_' + U.slug(filtro);
  }
  const dados = await buscarJogos(iso, avisar);
  if (modo === 'time') dados.jogos = filtrarTimeOuCampeonato(dados.jogos, filtro);
  if (par) dados.jogos = dados.jogos.filter(j => casaPartida(j, par[0], par[1]));
  dados.titulo = titulo;
  dados.modo = modo;
  // Por padrão só mostra na tela. Arquivos em saidas/ apenas com salvar=1 (ex.: pedido pelo chat do Claude Code).
  if (q.get('salvar') !== '1') return { pasta: null, ...dados };
  const pasta = novaPasta(iso, rotulo);
  fs.writeFileSync(path.join(SAIDAS, pasta, 'dados.json'), JSON.stringify(dados, null, 2));
  paginaResultado(path.join(SAIDAS, pasta));
  return { pasta, ...dados, paginasAgenda: modo === 'partida' ? 0 : banner.totalPaginas(dados.jogos.length) };
}

async function apiBanner(q) {
  const pasta = pastaSegura(q.get('pasta'));
  if (!pasta) return { erro: 'Pasta de resultado inválida.' };
  const d = lerDados(pasta);
  const tipo = q.get('tipo');
  let arquivo, url;
  const base = `http://127.0.0.1:${PORTA}`;
  if (tipo === 'agenda') {
    const p = Math.max(1, +q.get('pagina') || 1);
    arquivo = `agenda-${String(p).padStart(2, '0')}.png`;
    url = `${base}/banner/agenda?pasta=${encodeURIComponent(path.basename(pasta))}&pagina=${p}`;
  } else {
    const j = d.jogos.find(x => x.id === q.get('id'));
    if (!j) return { erro: 'Jogo não encontrado.' };
    arquivo = `jogo-${j.id.padStart(2, '0')}_${U.slug(j.mandante.nome)}-x-${U.slug(j.visitante.nome)}.png`;
    url = `${base}/banner/jogo?pasta=${encodeURIComponent(path.basename(pasta))}&id=${j.id}`;
  }
  await render.capturarPNG(url, 1080, 1920, path.join(pasta, arquivo));
  paginaResultado(pasta);
  return { png: `/saidas/${path.basename(pasta)}/${arquivo}`, arquivo };
}

async function paginaBanner(rota, q) {
  const pasta = pastaSegura(q.get('pasta'));
  if (!pasta) return null;
  const d = lerDados(pasta);
  if (rota === '/banner/agenda') return banner.bannerAgenda(d.jogos, Math.max(1, +q.get('pagina') || 1), d);
  const j = d.jogos.find(x => x.id === q.get('id'));
  if (!j) return null;
  const fundo = await fundoDoJogo({ ...j, estadio: j.estadioBusca || j.estadio });
  return banner.bannerJogo(j, d, fundo);
}

function arquivoEstatico(rota) {
  const rel = decodeURIComponent(rota === '/' ? '/index.html' : rota);
  if (!(rel === '/index.html' || rel.startsWith('/assets/') || rel.startsWith('/saidas/'))) return null;
  const alvo = path.normalize(path.join(RAIZ, rel));
  if (!alvo.startsWith(RAIZ + path.sep) || !fs.existsSync(alvo) || !fs.statSync(alvo).isFile()) return null;
  return alvo;
}

const responderJSON = (res, obj, status = 200) => { res.writeHead(status, { 'Content-Type': TIPOS['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
let fila = Promise.resolve();
const emFila = fn => (fila = fila.then(fn, fn));

const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORTA}`);
  try {
    // Liberado para o index.html aberto do disco descobrir que o servidor está ligado.
    if (u.pathname === '/api/status') res.setHeader('Access-Control-Allow-Origin', '*');
    if (u.pathname === '/api/status') return responderJSON(res, { ok: true, hoje: U.hojeISO(), agora: U.agoraHHMM(), navegador: !!render.navegadorPath() });
    if (u.pathname === '/api/progresso') return responderJSON(res, progresso);
    if (u.pathname === '/api/jogos') {
      const r = await emFila(async () => { try { return await apiJogos(u.searchParams); } finally { progresso = { msg: '', ativo: false }; } });
      return responderJSON(res, r, r.erro ? 400 : 200);
    }
    if (u.pathname === '/api/banner' && req.method === 'POST') {
      const r = await emFila(() => apiBanner(u.searchParams));
      return responderJSON(res, r, r.erro ? 400 : 200);
    }
    if (u.pathname === '/banner/jogo' || u.pathname === '/banner/agenda') {
      const html = await paginaBanner(u.pathname, u.searchParams);
      if (!html) { res.writeHead(404); return res.end('não encontrado'); }
      res.writeHead(200, { 'Content-Type': TIPOS['.html'] });
      return res.end(html);
    }
    const arq = arquivoEstatico(u.pathname);
    if (!arq) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(arq).pipe(res);
  } catch (e) {
    console.error(e);
    responderJSON(res, { erro: 'Erro interno: ' + e.message }, 500);
  }
});

servidor.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.log(`A Central de Jogos já está aberta em http://127.0.0.1:${PORTA}/`); process.exit(0); }
  throw e;
});
servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`Central de Jogos rodando em http://127.0.0.1:${PORTA}/`);
  console.log('Deixe esta janela aberta enquanto usa a página. Feche-a para desligar.');
});
process.on('SIGINT', () => { render.encerrar(); process.exit(0); });
