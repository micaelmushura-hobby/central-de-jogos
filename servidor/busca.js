// Busca os jogos de um dia (horário de Brasília) e junta as fontes:
// - Olhar Digital (guia diário): jogos com transmissão no Brasil e canais
// - Lance! (guia diário): segunda fonte para o horário
// - ESPN (dados estruturados): horário em UTC, escudos, cores, estádio
// - CBF (tabela oficial, Séries A e B): horário e estádio oficiais
const fs = require('fs');
const path = require('path');
const U = require('./util');
const canais = require('./canais');
const render = require('./render');

const RAIZ = path.join(__dirname, '..');

// Campeonatos acompanhados pela ESPN: [slug, nome, prioridade (1 = mais importante)]
const LIGAS = [
  ['bra.1', 'Brasileirão Série A', 1], ['bra.copa_do_brazil', 'Copa do Brasil', 1],
  ['conmebol.libertadores', 'Libertadores', 1], ['fifa.world', 'Copa do Mundo', 1], ['fifa.cwc', 'Mundial de Clubes', 1],
  ['bra.2', 'Brasileirão Série B', 2], ['conmebol.sudamericana', 'Sul-Americana', 2], ['uefa.champions', 'Champions League', 2],
  ['bra.camp.paulista', 'Paulistão', 2], ['bra.camp.carioca', 'Carioca', 2],
  ['bra.3', 'Brasileirão Série C', 3], ['bra.camp.mineiro', 'Mineiro', 3], ['bra.camp.gaucho', 'Gauchão', 3],
  ['uefa.europa', 'Europa League', 3], ['eng.1', 'Premier League', 3], ['esp.1', 'La Liga', 3],
  ['ita.1', 'Campeonato Italiano', 3], ['ger.1', 'Bundesliga', 3], ['fra.1', 'Ligue 1', 4], ['por.1', 'Campeonato Português', 4]
];

function prioridadePorNome(nome) {
  const n = U.semAcento(nome).toLowerCase();
  if (/serie a|^brasileirao$|copa do brasil|(^|\s)libertadores$|copa do mundo$|mundial de clubes/.test(n) && !/feminin|sub-|italian|tim/.test(n)) return 1;
  if (/serie b|sul-?americana|sudamericana|champions|paulista|carioca/.test(n) && !/feminin/.test(n)) return 2;
  if (/serie c|feminin|sub-\d|premier|la ?liga|italiano|bundesliga|europa league|mineiro|gaucho/.test(n)) return 3;
  return 4;
}
const limparCampeonato = s => U.textoDeHtml(s).replace(/\s+\d{4}([/-]\d{2,4})?$/, '').replace(/^CONMEBOL\s+/i, '').replace(/^LALIGA$/i, 'La Liga').trim();

// ---------------- Guias ----------------
function urlOlhar(iso) {
  const [a, m, d] = iso.split('-');
  return `https://olhardigital.com.br/${a}/${m}/${d}/internet-e-redes-sociais/jogos-de-hoje-${d}-${m}-${a.slice(2)}-onde-assistir-futebol-ao-vivo-e-horarios-das-partidas/`;
}
const DIAS_LANCE = ['domingo', 'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado'];
function urlLance(iso) {
  const [a, m, d] = iso.split('-');
  const dia = DIAS_LANCE[new Date(Date.UTC(+a, m - 1, +d, 12)).getUTCDay()];
  return `https://www.lance.com.br/onde-assistir/jogos-de-hoje-quem-joga-no-futebol-e-onde-assistir-ao-vivo-${dia}-${d}-${m}-${a}.html`;
}
const horaGuia = (h, m) => `${String(h).padStart(2, '0')}:${m || '00'}`;

async function lerOlhar(iso) {
  const url = urlOlhar(iso);
  const r = await U.buscarTexto(url);
  if (!r.ok) return { url, ok: false, jogos: [], obs: r.status === 404 ? 'guia do dia ainda não publicado' : `falha ao abrir (HTTP ${r.status || r.erro})` };
  const jogos = [];
  const regioes = {};
  const vistos = new Set();
  let secao = '', modoGlobo = false;
  const re = /<h[23][^>]*>([\s\S]*?)<\/h[23]>|<li>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = re.exec(r.texto))) {
    if (m[1] !== undefined) {
      const t = U.textoDeHtml(m[1]);
      modoGlobo = /passar na globo/i.test(t);
      if (!modoGlobo) secao = limparCampeonato(t);
      continue;
    }
    const linha = U.textoDeHtml(m[2]);
    const g = linha.match(/^(.+?)\s+x\s+(.+?)\s+[—–-]\s+(\d{1,2})h(\d{2})?\s+[—–-]\s+(.+)$/i);
    if (!g) continue;
    const chave = U.slug(`${g[1]} ${g[2]} ${g[3]}`);
    if (modoGlobo) { regioes[chave] = g[5].replace(/^TV Globo para\s+/i, ''); continue; }
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    jogos.push({ campeonato: secao, a: g[1].trim(), b: g[2].trim(), hora: horaGuia(g[3], g[4]), canaisTexto: g[5].trim(), chave });
  }
  jogos.forEach(j => { if (regioes[j.chave]) j.globoRegioes = regioes[j.chave]; });
  return { url, ok: true, jogos, obs: `${jogos.length} jogos no guia` };
}

async function lerLance(iso) {
  const url = urlLance(iso);
  const r = await U.buscarTexto(url);
  if (!r.ok) return { url, ok: false, jogos: [], obs: r.status === 404 ? 'guia do dia ainda não publicado' : `falha ao abrir (HTTP ${r.status || r.erro})` };
  const jogos = [];
  let secao = '';
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>|<p class="paragraph-html[^"]*">([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(r.texto))) {
    if (m[1] !== undefined) { secao = limparCampeonato(m[1]); continue; }
    const g = U.textoDeHtml(m[2]).match(/^(\d{1,2})h(\d{2})?\s+[–-]\s+(.+?)\s+x\s+(.+?)(?:\s+[–-]\s+(.+))?$/i);
    if (g) jogos.push({ campeonato: secao, a: g[3].trim(), b: g[4].trim(), hora: horaGuia(g[1], g[2]) });
  }
  return { url, ok: true, jogos, obs: `${jogos.length} jogos no guia` };
}

// ---------------- ESPN ----------------
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
function normalizarEvento(e, liga) {
  const c = e.competitions?.[0];
  if (!c) return null;
  const time = lado => {
    const comp = c.competitors.find(x => x.homeAway === lado) || {};
    const t = comp.team || {};
    return { gols: comp.score ?? null, espnId: t.id, nome: t.displayName || t.name, curto: t.shortDisplayName || t.displayName, sigla: t.abbreviation,
      logoRemoto: t.logo || null, cor: t.color ? '#' + t.color : null, cor2: t.alternateColor ? '#' + t.alternateColor : null };
  };
  const br = U.utcParaBrasilia(e.date);
  return {
    espnId: e.id, ligaId: (e.uid || '').match(/~l:(\d+)/)?.[1], liga, utc: e.date, data: br.data, hora: br.hora,
    mandante: time('home'), visitante: time('away'),
    estadio: c.venue?.fullName || e.venue?.fullName || null, cidade: c.venue?.address?.city || null,
    estado: e.status?.type?.state, situacao: e.status?.type?.shortDetail || null, link: e.links?.[0]?.href || null
  };
}

async function lerESPN(iso) {
  const datas = [U.somarDias(iso, -1), iso, U.somarDias(iso, 1)].map(d => d.replace(/-/g, ''));
  const todos = new Map();
  const ligas = {};
  // Todos os jogos de futebol (para achar escudos dos jogos do guia)
  await Promise.all(datas.map(async d => {
    const j = await U.buscarJSON(`${ESPN}/all/scoreboard?dates=${d}&limit=1000&lang=pt&region=br`);
    (j?.events || []).forEach(e => { const n = normalizarEvento(e, null); if (n && n.data === iso) todos.set(n.espnId, n); });
  }));
  // Campeonatos acompanhados (nome e logo do campeonato; jogos fora do guia)
  const tarefas = [];
  for (const [slugLiga, nome, prioridade] of LIGAS) for (const d of datas) tarefas.push({ slugLiga, nome, prioridade, d });
  for (let i = 0; i < tarefas.length; i += 12) {
    await Promise.all(tarefas.slice(i, i + 12).map(async t => {
      const j = await U.buscarJSON(`${ESPN}/${t.slugLiga}/scoreboard?dates=${t.d}&lang=pt&region=br`, { timeout: 15000 });
      if (!j) return;
      const lg = j.leagues?.[0];
      const info = { slug: t.slugLiga, nome: t.nome, prioridade: t.prioridade, logoRemoto: lg?.logos?.[0]?.href || null, id: lg?.id };
      (j.events || []).forEach(e => {
        const n = normalizarEvento(e, info);
        if (!n || n.data !== iso) return;
        if (info.id) ligas[info.id] = info;
        todos.set(n.espnId, { ...(todos.get(n.espnId) || {}), ...n });
      });
    }));
  }
  for (const ev of todos.values()) if (!ev.liga && ev.ligaId && ligas[ev.ligaId]) ev.liga = ligas[ev.ligaId];
  return { ok: todos.size > 0, eventos: [...todos.values()], obs: `${todos.size} jogos na data` };
}

// ---------------- CBF (oficial) ----------------
async function lerCBF(iso, serie) {
  const ano = iso.slice(0, 4);
  const url = `https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-${serie}/${ano}`;
  try {
    const texto = (await render.textoRenderizado(url, 7000)).replace(/\s+/g, ' ');
    const alvo = U.isoParaBR(iso);
    const jogos = [];
    const re = /([A-Za-zÀ-ú]{3}) (?:\d+ )?X (?:\d+ )?([A-Za-zÀ-ú]{3}) Jogo (\d+) (?:(\d+) Altera\S* )?(\d{2}\/\d{2}\/\d{4}) - (\d{2}:\d{2}) (.+?) Documentos do jogo/gi;
    let m;
    while ((m = re.exec(texto))) {
      if (m[5] !== alvo) continue;
      const loc = m[7].trim().match(/^(.+? - [A-Z]{2}) (.+)$/);
      jogos.push({ m3: U.semAcento(m[1]).toLowerCase(), v3: U.semAcento(m[2]).toLowerCase(), numero: m[3], alteracoes: +(m[4] || 0), hora: m[6], local: loc ? `${loc[2]} (${loc[1]})` : null });
    }
    return { url, ok: true, jogos, obs: `${jogos.length} jogos da Série ${serie.toUpperCase()} na data` };
  } catch (e) {
    return { url, ok: false, jogos: [], obs: 'não foi possível abrir: ' + e.message };
  }
}

// ---------------- Casamento de nomes ----------------
const IGNORAR = new Set(['fc', 'ec', 'sc', 'cf', 'ac', 'afc', 'sv', 'fk', 'cd', 'ca', 'club', 'clube', 'de', 'da', 'do', 'del', 'la', 'esporte', 'futebol', 'futbol', 'calcio', 'ssc', 'as', 'rc', 'us', 'sad', 'cr']);
const tokens = s => U.semAcento(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(t => t && !IGNORAR.has(t));
function similaridade(a, nomes) {
  const ta = tokens(a);
  if (!ta.length) return 0;
  let melhor = 0;
  for (const n of nomes.filter(Boolean)) {
    const tb = tokens(n);
    if (!tb.length) continue;
    const casa = x => tb.some(y => x === y || (Math.min(x.length, y.length) >= 2 && (x.startsWith(y) || y.startsWith(x))));
    const casaB = y => ta.some(x => x === y || (Math.min(x.length, y.length) >= 2 && (x.startsWith(y) || y.startsWith(x))));
    const s = Math.max(ta.filter(casa).length / ta.length, tb.filter(casaB).length / tb.length);
    melhor = Math.max(melhor, s);
  }
  return melhor;
}
const nomesTime = t => [t.nome, t.curto, t.sigla];

function acharEvento(jogoGuia, eventos, usados, janela = 150) {
  let melhor = null;
  for (const ev of eventos) {
    if (usados.has(ev.espnId)) continue;
    const dt = Math.abs(U.minutos(ev.hora) - U.minutos(jogoGuia.hora));
    if (dt > janela) continue;
    const direto = [similaridade(jogoGuia.a, nomesTime(ev.mandante)), similaridade(jogoGuia.b, nomesTime(ev.visitante))];
    const invertido = [similaridade(jogoGuia.a, nomesTime(ev.visitante)), similaridade(jogoGuia.b, nomesTime(ev.mandante))];
    for (const [s1, s2] of [direto, invertido]) {
      const ok = (s1 >= 0.5 && s2 >= 0.5) || (dt <= 15 && s1 + s2 >= 1);
      if (!ok) continue;
      const nota = s1 + s2 - dt / 600;
      if (!melhor || nota > melhor.nota) melhor = { ev, nota };
    }
  }
  return melhor?.ev || null;
}
function acharGuia(lista, a, b) {
  return lista.find(g => similaridade(g.a, [a]) >= 0.5 && similaridade(g.b, [b]) >= 0.5)
    || lista.find(g => similaridade(g.a, [b]) >= 0.5 && similaridade(g.b, [a]) >= 0.5);
}

// ---------------- Escudos locais ----------------
async function baixarLogo(remoto, subpasta, nomeArquivo, descricao) {
  if (!remoto) return null;
  const pasta = path.join(RAIZ, 'assets', 'logos', subpasta);
  const destino = path.join(pasta, nomeArquivo);
  const url = `/assets/logos/${subpasta}/${nomeArquivo}`;
  if (fs.existsSync(destino)) return url;
  try {
    const r = await fetch(remoto.replace('/500/', '/500/'));
    if (!r.ok) return null;
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
    const reg = path.join(pasta, 'fontes.json');
    let j = {}; try { j = JSON.parse(fs.readFileSync(reg, 'utf8')); } catch {}
    j[nomeArquivo] = { descricao, origem: remoto, baixado_em: U.hojeISO(), observacao: 'Marca do respectivo clube/entidade; imagem obtida da ESPN; uso pessoal e informativo em arte não oficial.' };
    fs.writeFileSync(reg, JSON.stringify(j, null, 2));
    return url;
  } catch { return null; }
}

// Procura um escudo já baixado cujo nome seja o mesmo do time (ex.: Palmeiras do futebol feminino).
function escudoEmCache(nome) {
  const pasta = path.join(RAIZ, 'assets', 'logos', 'times');
  let reg = {}; try { reg = JSON.parse(fs.readFileSync(path.join(pasta, 'fontes.json'), 'utf8')); } catch { return null; }
  const alvo = U.slug(nome);
  const achado = Object.entries(reg).find(([, v]) => U.slug(v.descricao) === alvo);
  return achado ? `/assets/logos/times/${achado[0]}` : null;
}

// ---------------- Montagem ----------------
async function buscarJogos(iso, progresso = () => {}) {
  const consultadoEm = `${U.isoParaBR(U.hojeISO())} ${U.agoraHHMM()}`;
  progresso('Lendo guias de transmissão e dados da ESPN…');
  const [olhar, lance, espn] = await Promise.all([lerOlhar(iso), lerLance(iso), lerESPN(iso)]);

  const usados = new Set();
  const jogos = [];
  for (const g of olhar.jogos) {
    const ev = acharEvento(g, espn.eventos, usados);
    if (ev) usados.add(ev.espnId);
    jogos.push({ guia: g, ev });
  }
  // Jogos dos campeonatos acompanhados que não estão no guia
  for (const ev of espn.eventos) {
    if (usados.has(ev.espnId) || !ev.liga) continue;
    jogos.push({ guia: null, ev });
  }

  // CBF só quando há jogos das Séries A ou B na data
  const temSerie = s => jogos.some(j => (j.ev?.liga?.slug === `bra.${s === 'a' ? 1 : 2}`) || new RegExp(`s[ée]rie ${s}\\b|^brasileir[ãa]o$`, 'i').test(j.guia?.campeonato || ''));
  const cbf = {};
  const series = ['a', 'b'].filter(temSerie);
  if (series.length) progresso('Conferindo a tabela oficial da CBF…');
  await Promise.all(series.map(async s => { cbf[s] = await lerCBF(iso, s); }));
  const jogosCBF = Object.entries(cbf).flatMap(([s, r]) => r.jogos.map(j => ({ ...j, serie: s, url: r.url })));

  progresso('Organizando jogos, escudos e canais…');
  const saida = [];
  for (const { guia, ev } of jogos) {
    const campeonato = ev?.liga?.nome || guia?.campeonato || 'Futebol';
    const prioridade = ev?.liga?.prioridade || prioridadePorNome(guia?.campeonato || campeonato);
    const time = (lado, nomeGuia) => {
      const t = ev?.[lado];
      const exibido = nomeGuia ? nomeGuia.replace(/\s*\/\s*/g, '-') : t?.curto;
      return { nome: exibido, nomeCompleto: t?.nome || nomeGuia, sigla: (t?.sigla || U.semAcento(nomeGuia || '').slice(0, 3)).toUpperCase(),
        cor: t?.cor || null, cor2: t?.cor2 || null, logoRemoto: t?.logoRemoto || null, espnId: t?.espnId || null, gols: t?.gols ?? null };
    };
    // Mantém a ordem do guia (mandante primeiro) quando a ESPN inverteu os lados
    let mandante = time('mandante', guia?.a), visitante = time('visitante', guia?.b);
    if (guia && ev && similaridade(guia.a, nomesTime(ev.visitante)) > similaridade(guia.a, nomesTime(ev.mandante))) [mandante, visitante] = [time('visitante', guia.a), time('mandante', guia.b)];

    const horarios = [];
    if (guia) horarios.push({ fonte: 'Olhar Digital', hora: guia.hora, url: olhar.url });
    const gl = lance.jogos.length ? acharGuia(lance.jogos, guia?.a || mandante.nome, guia?.b || visitante.nome) : null;
    if (gl) horarios.push({ fonte: 'Lance!', hora: gl.hora, url: lance.url });
    if (ev) horarios.push({ fonte: 'ESPN', hora: ev.hora, url: ev.link || 'https://www.espn.com.br/futebol/calendario' });
    const c3 = s => U.semAcento(s || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);
    const oficial = jogosCBF.find(j => j.m3 === c3(mandante.nomeCompleto) && (j.v3 === c3(visitante.nomeCompleto) || horarios.some(h => h.hora === j.hora)))
      || jogosCBF.find(j => j.m3 === c3(mandante.nome) && j.v3 === c3(visitante.nome));
    if (oficial) horarios.unshift({ fonte: 'CBF (oficial)', hora: oficial.hora, url: oficial.url });

    const hora = horarios[0]?.hora;
    if (!hora) continue;
    const divergencias = [];
    const outros = horarios.filter(h => h.hora !== hora);
    if (outros.length) divergencias.push(`Horário: ${horarios.map(h => `${h.fonte} ${h.hora.replace(':', 'h')}`).join(' · ')}`);
    const confirmacoes = [];
    if (oficial) confirmacoes.push(`Horário e local oficiais da CBF (jogo ${oficial.numero})${oficial.alteracoes ? ` · a CBF registra ${oficial.alteracoes} alteração(ões)` : ''}`);
    const concordam = horarios.filter(h => h.hora === hora).map(h => h.fonte);
    if (!oficial && concordam.length >= 2) confirmacoes.push(`Horário confirmado por ${concordam.join(' e ')}`);

    const listaCanais = guia ? canais.separar(guia.canaisTexto) : [];
    saida.push({
      campeonato, prioridade, data: iso, hora,
      mandante, visitante,
      estadio: oficial?.local || ev?.estadio || null,
      estadioBusca: ev?.estadio || null,
      cidade: ev?.cidade || null,
      canais: listaCanais,
      transmissao: listaCanais.length ? 'guia' : 'nao-confirmada',
      globoRegioes: guia?.globoRegioes || null,
      ligaLogoRemoto: ev?.liga?.logoRemoto || null,
      ligaId: ev?.liga?.id || null,
      confirmacoes, divergencias,
      fontes: horarios.map(h => ({ nome: h.fonte, url: h.url })),
      estado: ev?.estado || null,
      situacao: ev?.situacao || null,
      espnId: ev?.espnId || null
    });
  }

  saida.sort((x, y) => x.prioridade - y.prioridade || x.campeonato.localeCompare(y.campeonato) || x.hora.localeCompare(y.hora));

  progresso('Baixando escudos…');
  await Promise.all(saida.map(async j => {
    for (const lado of ['mandante', 'visitante']) {
      const t = j[lado];
      t.logo = t.espnId ? await baixarLogo(t.logoRemoto, 'times', `espn-${t.espnId}.png`, t.nomeCompleto) : null;
    }
    j.ligaLogo = j.ligaId ? await baixarLogo(j.ligaLogoRemoto, 'ligas', `espn-${j.ligaId}.png`, j.campeonato) : null;
  }));
  for (const j of saida) for (const lado of ['mandante', 'visitante']) if (!j[lado].logo) j[lado].logo = escudoEmCache(j[lado].nome);
  saida.forEach((j, i) => { j.id = String(i + 1); });

  const fontes = [
    { nome: 'Olhar Digital — guia de jogos do dia', url: olhar.url, ok: olhar.ok, obs: olhar.obs },
    { nome: 'Lance! — jogos de hoje', url: lance.url, ok: lance.ok, obs: lance.obs },
    { nome: 'ESPN — calendário de futebol (dados estruturados)', url: 'https://www.espn.com.br/futebol/calendario', ok: espn.ok, obs: espn.obs },
    ...Object.entries(cbf).map(([s, r]) => ({ nome: `CBF — tabela oficial da Série ${s.toUpperCase()}`, url: r.url, ok: r.ok, obs: r.obs }))
  ];
  const avisos = [];
  if (!olhar.ok) avisos.push(`O guia de transmissões do Olhar Digital para ${U.isoParaBR(iso)} não está disponível (${olhar.obs}). Sem ele, os canais aparecem como "transmissão não confirmada".`);
  return { data: iso, consultadoEm, jogos: saida, fontes, avisos };
}

module.exports = { buscarJogos, similaridade };
