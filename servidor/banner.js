// Monta o HTML dos banners 9:16 (1080x1920). O servidor abre essas páginas no Chrome e salva o PNG.
const { escHtml: e, diaSemana, isoParaBR, hojeISO } = require('./util');

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataExtensa = iso => { const [a, m, d] = iso.split('-'); return `${diaSemana(iso)} · ${+d} de ${MESES[m - 1]}`; };
const horaBR = h => h.replace(':', 'h').replace(/h00$/, 'h');

const BASE_CSS = `
  @import url("/assets/fontes/fontes.css");
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1080px; height: 1920px; overflow: hidden; background: #05080f; }
  body { font-family: "Inter", "Segoe UI", Arial, sans-serif; color: #fff; -webkit-font-smoothing: antialiased; }
  .oswald { font-family: "Oswald", "Arial Narrow", sans-serif; }
  .palco { position: relative; width: 1080px; height: 1920px; overflow: hidden; isolation: isolate; }
  .pill { background: #fff; border-radius: 22px; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;
    box-shadow: 0 10px 30px rgba(0,0,0,.35); }
  .pill img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
  .pill .num { position: absolute; right: 6px; top: 6px; background: #0b1220; color: #fff; border: 2px solid #fff;
    border-radius: 999px; font: 700 24px/1 "Oswald", sans-serif; padding: 5px 10px; }
  .pill.texto { color: #0b1220; font-family: "Oswald", sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; }
  .escudo-txt { display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,.1);
    border: 6px solid rgba(255,255,255,.75); font-family: "Oswald", sans-serif; font-weight: 700; }
`;

// Reduz o tamanho da fonte dos elementos .fit até caberem na largura.
const SCRIPT_AJUSTE = `<script>
  document.fonts.ready.then(() => {
    document.querySelectorAll('.fit').forEach(el => {
      let t = parseFloat(getComputedStyle(el).fontSize);
      const min = +(el.dataset.min || 24);
      while (el.scrollWidth > el.clientWidth + 1 && t > min) { t -= 2; el.style.fontSize = t + 'px'; }
    });
    document.body.dataset.pronto = '1';
  });
</script>`;

const ZOOM = { record: 1.45, getv: 1.15, plutotv: 1.2 };
function canalPill(c, alt, largura) {
  const num = (c.nome.match(/(\d)\s*$/) || [])[1];
  if (c.logo) {
    const pad = Math.round(alt * 0.2);
    const z = ZOOM[c.chave] || 1;
    return `<div class="pill" style="height:${alt}px;width:${largura}px;padding:${pad}px ${pad + 6}px"><img src="${e(c.logo)}" alt="${e(c.nome)}"${z !== 1 ? ` style="transform:scale(${z})"` : ''}>${num ? `<span class="num">${num}</span>` : ''}</div>`;
  }
  return `<div class="pill texto" style="height:${alt}px;padding:0 ${Math.round(alt * .35)}px;font-size:${Math.round(alt * .4)}px">${e(c.nome)}</div>`;
}

function escudo(t, tam) {
  if (t.logo) return `<img class="escudo" src="${e(t.logo)}" alt="${e(t.nome)}" style="width:${tam}px;height:${tam}px">`;
  return `<div class="escudo-txt" style="width:${tam}px;height:${tam}px;font-size:${Math.round(tam * .3)}px">${e(t.sigla)}</div>`;
}

// ---------------- Banner de uma partida ----------------
function bannerJogo(j, meta, fundo) {
  const corA = j.mandante.cor && j.mandante.cor !== '#000000' ? j.mandante.cor : '#1e3a8a';
  const corB = j.visitante.cor && j.visitante.cor !== '#000000' ? j.visitante.cor : '#7f1d1d';
  const ehHoje = j.data === hojeISO();
  const canais = j.canais.slice(0, 6);
  const muitos = canais.length > 3;
  const largPill = muitos ? 290 : 290;
  const altPill = muitos ? 84 : 104;
  const fontes = [...new Set(j.fontes.map(f => f.nome.replace(' (oficial)', '')))].join(', ');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${BASE_CSS}
  .fundo { position: absolute; inset: 0; z-index: -3; background:
      radial-gradient(70% 45% at 0% 38%, ${corA}cc, transparent 70%),
      radial-gradient(70% 45% at 100% 38%, ${corB}cc, transparent 70%),
      linear-gradient(180deg, #0a1020, #05080f); }
  .foto { position: absolute; inset: 0; width: 100%; height: 62%; object-fit: cover; z-index: -2; filter: saturate(1.1) brightness(.62); }
  .veu { position: absolute; inset: 0; z-index: -1; background:
      linear-gradient(180deg, rgba(5,8,15,.82) 0%, rgba(5,8,15,.25) 20%, rgba(5,8,15,.35) 42%, rgba(5,8,15,.94) 60%, #05080f 72%),
      radial-gradient(60% 30% at 0% 45%, ${corA}66, transparent 70%),
      radial-gradient(60% 30% at 100% 45%, ${corB}66, transparent 70%); }
  .faixa { position: absolute; left: 0; right: 0; top: 0; height: 14px; background: linear-gradient(90deg, ${corA}, ${corB}); }
  .topo { position: absolute; top: 84px; left: 72px; right: 72px; display: flex; align-items: center; gap: 26px; }
  .liga-logo { width: 116px; height: 116px; border-radius: 28px; background: #fff; display: grid; place-items: center; padding: 14px; flex: none;
    box-shadow: 0 10px 30px rgba(0,0,0,.4); }
  .liga-logo img { max-width: 100%; max-height: 100%; }
  .liga-nome { font-size: 50px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; line-height: 1.05; white-space: nowrap; overflow: hidden; }
  .liga-sub { font-size: 30px; font-weight: 600; opacity: .85; text-transform: uppercase; letter-spacing: .14em; margin-top: 6px; }
  .chamada { position: absolute; top: 300px; left: 0; right: 0; text-align: center; }
  .chamada .k { font-size: 34px; font-weight: 600; letter-spacing: .32em; text-transform: uppercase; opacity: .9; }
  .chamada .t { font-size: 150px; font-weight: 700; line-height: 1; text-transform: uppercase; letter-spacing: .01em;
    text-shadow: 0 8px 40px rgba(0,0,0,.55); margin-top: 10px; }
  .confronto { position: absolute; top: 640px; left: 40px; right: 40px; display: grid; grid-template-columns: 1fr 120px 1fr; align-items: start; }
  .time { display: flex; flex-direction: column; align-items: center; gap: 34px; min-width: 0; }
  .escudo-wrap { width: 380px; height: 380px; display: grid; place-items: center; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,.16), rgba(255,255,255,0) 68%); }
  .escudo { object-fit: contain; filter: drop-shadow(0 22px 34px rgba(0,0,0,.6)); }
  .nome { width: 100%; text-align: center; font-size: 66px; font-weight: 700; text-transform: uppercase; line-height: 1.05;
    white-space: nowrap; overflow: hidden; text-shadow: 0 4px 20px rgba(0,0,0,.6); }
  .x { font-size: 120px; font-weight: 700; text-align: center; margin-top: 120px; opacity: .95; }
  .quando { position: absolute; top: ${muitos ? 1170 : 1210}px; left: 0; right: 0; text-align: center; }
  .hora { font-size: ${muitos ? 210 : 250}px; font-weight: 700; line-height: .9; letter-spacing: -.01em;
    background: linear-gradient(180deg, #fff 30%, #d7e3f4); -webkit-background-clip: text; color: transparent; }
  .fuso { font-size: 32px; font-weight: 600; letter-spacing: .34em; text-transform: uppercase; margin-top: 18px; opacity: .9; }
  .local { margin-top: 26px; font-size: 32px; font-weight: 600; opacity: .85; display: flex; justify-content: center; align-items: center; gap: 12px; padding: 0 60px; }
  .local svg { flex: none; }
  .onde { position: absolute; bottom: 130px; left: 50px; right: 50px; text-align: center; }
  .onde .rot { font-size: 30px; font-weight: 700; letter-spacing: .34em; text-transform: uppercase; color: #9fe3b4; margin-bottom: ${muitos ? 18 : 24}px; }
  .canais { display: flex; flex-wrap: wrap; justify-content: center; gap: ${muitos ? 16 : 22}px; }
  .nc { display: inline-block; font-size: 40px; font-weight: 700; text-transform: uppercase; padding: 20px 36px;
    border: 4px dashed rgba(255,255,255,.65); border-radius: 22px; }
  .rodape { position: absolute; bottom: 34px; left: 60px; right: 60px; text-align: center; font-size: 20px; line-height: 1.45; opacity: .62; }
  </style></head><body><div class="palco">
    <div class="fundo"></div>
    ${fundo ? `<img class="foto" src="${e(fundo.url)}" alt="">` : ''}
    <div class="veu"></div><div class="faixa"></div>
    <div class="topo">
      ${j.ligaLogo ? `<div class="liga-logo"><img src="${e(j.ligaLogo)}" alt=""></div>` : ''}
      <div style="min-width:0;flex:1"><div class="liga-nome oswald fit" data-min="30">${e(j.campeonato)}</div>
      <div class="liga-sub">${e(dataExtensa(j.data))}</div></div>
    </div>
    <div class="chamada"><div class="k">${ehHoje ? 'É hoje' : isoParaBR(j.data)}</div><div class="t oswald">Dia de jogo</div></div>
    <div class="confronto">
      <div class="time"><div class="escudo-wrap">${escudo(j.mandante, 320)}</div><div class="nome oswald fit" data-min="34">${e(j.mandante.nome)}</div></div>
      <div class="x oswald">×</div>
      <div class="time"><div class="escudo-wrap">${escudo(j.visitante, 320)}</div><div class="nome oswald fit" data-min="34">${e(j.visitante.nome)}</div></div>
    </div>
    <div class="quando">
      <div class="hora oswald">${e(horaBR(j.hora))}</div>
      <div class="fuso">Horário de Brasília</div>
      ${j.estadio ? `<div class="local"><svg width="30" height="38" viewBox="0 0 24 30" fill="#fff"><path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 30 12 30s12-9.6 12-18.3C24 5.2 18.6 0 12 0zm0 16.5a4.8 4.8 0 1 1 0-9.6 4.8 4.8 0 0 1 0 9.6z"/></svg><span class="fit" data-min="22" style="white-space:nowrap;overflow:hidden">${e(j.estadio)}</span></div>` : ''}
    </div>
    <div class="onde">
      <div class="rot">Onde assistir</div>
      ${canais.length ? `<div class="canais">${canais.map(c => canalPill(c, altPill, largPill)).join('')}</div>` : '<div class="nc oswald">Transmissão não confirmada</div>'}
    </div>
    <div class="rodape">Arte não oficial · Fontes: ${e(fontes || '—')} · consulta ${e(meta.consultadoEm)} (Brasília)${fundo ? `<br>${e(fundo.credito)}` : ''}</div>
  </div>${SCRIPT_AJUSTE}</body></html>`;
}

// ---------------- Agenda do dia (vários jogos) ----------------
const POR_PAGINA = 7;
const totalPaginas = n => Math.max(1, Math.ceil(n / POR_PAGINA));

function bannerAgenda(jogos, pagina, meta) {
  const total = totalPaginas(jogos.length);
  const lista = jogos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const ehHoje = meta.data === hojeISO();
  const linha = j => {
    const cs = j.canais.slice(0, 3);
    const extra = j.canais.length - cs.length;
    return `<div class="linha">
      <div class="h oswald">${e(horaBR(j.hora))}</div>
      <div class="meio">
        <div class="camp fit" data-min="16">${e(j.campeonato)}</div>
        <div class="tm">${escudo(j.mandante, 54)}<span class="fit" data-min="20">${e(j.mandante.nome)}</span></div>
        <div class="tm">${escudo(j.visitante, 54)}<span class="fit" data-min="20">${e(j.visitante.nome)}</span></div>
      </div>
      <div class="cs">${cs.length ? cs.map(c => canalPill(c, 50, 130)).join('') + (extra > 0 ? `<div class="mais">+${extra}</div>` : '') : '<div class="ncp">Transmissão<br>não confirmada</div>'}</div>
    </div>`;
  };
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${BASE_CSS}
  .palco { background:
      radial-gradient(60% 30% at 100% 0%, rgba(34,197,94,.35), transparent 70%),
      radial-gradient(70% 35% at 0% 100%, rgba(59,130,246,.30), transparent 70%),
      linear-gradient(180deg, #0b1324, #05080f); }
  .palco::before { content: ""; position: absolute; inset: 0; z-index: -1; opacity: .06;
    background: repeating-linear-gradient(120deg, #fff 0 2px, transparent 2px 46px); }
  .faixa { position: absolute; left: 0; right: 0; top: 0; height: 14px; background: linear-gradient(90deg, #22c55e, #3b82f6); }
  header { position: absolute; top: 90px; left: 70px; right: 70px; }
  .k { font-size: 32px; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; color: #9fe3b4; }
  h1 { font-size: 150px; line-height: 1; font-weight: 700; text-transform: uppercase; margin-top: 12px; }
  .sub { display: flex; justify-content: space-between; margin-top: 18px; font-size: 30px; font-weight: 600; opacity: .85; }
  .lista { position: absolute; top: 470px; left: 50px; right: 50px; display: flex; flex-direction: column; gap: 18px; }
  .linha { display: grid; grid-template-columns: 170px 1fr 300px; align-items: center; gap: 18px; height: 176px; padding: 0 26px;
    background: rgba(255,255,255,.07); border: 2px solid rgba(255,255,255,.12); border-radius: 28px; }
  .h { font-size: 64px; font-weight: 700; }
  .meio { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .camp { font-size: 22px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #9fe3b4; white-space: nowrap; overflow: hidden; }
  .tms { display: grid; grid-template-columns: 1fr 34px 1fr; align-items: center; gap: 8px; min-width: 0; }
  .tm { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .tm span { font-size: 34px; font-weight: 700; white-space: nowrap; overflow: hidden; min-width: 0; flex: 1; }
  .tm .escudo { object-fit: contain; flex: none; filter: drop-shadow(0 6px 10px rgba(0,0,0,.5)); }
  .tm .escudo-txt { flex: none; border-width: 3px; }
  .vs { font-family: "Oswald", sans-serif; font-size: 36px; font-weight: 700; text-align: center; opacity: .8; }
  .cs { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; align-content: center; }
  .cs .pill { border-radius: 12px; box-shadow: none; width: 140px !important; }
  .cs .pill .num { font-size: 15px; padding: 2px 6px; border-width: 1px; right: 3px; top: 3px; }
  .mais { font: 700 28px "Oswald", sans-serif; align-self: center; opacity: .85; }
  .ncp { font-size: 20px; font-weight: 600; text-align: right; opacity: .7; line-height: 1.3; }
  .rodape { position: absolute; bottom: 40px; left: 60px; right: 60px; text-align: center; font-size: 21px; opacity: .6; line-height: 1.45; }
  </style></head><body><div class="palco"><div class="faixa"></div>
    <header>
      <div class="k">${e(dataExtensa(meta.data))}</div>
      <h1 class="oswald">${ehHoje ? 'Jogos de hoje' : 'Jogos do dia'}</h1>
      <div class="sub"><span>Horários de Brasília</span><span>${total > 1 ? `${pagina}/${total}` : ''}</span></div>
    </header>
    <div class="lista">${lista.map(linha).join('')}</div>
    <div class="rodape">Arte não oficial · Fontes: CBF, ESPN, Olhar Digital, Lance! · consulta ${e(meta.consultadoEm)} (Brasília)</div>
  </div>${SCRIPT_AJUSTE}</body></html>`;
}

module.exports = { bannerJogo, bannerAgenda, totalPaginas, horaBR, dataExtensa };
