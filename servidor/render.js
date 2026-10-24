// Controla um Chrome (ou Edge) sem janela para tirar PNGs dos banners e ler páginas que usam JavaScript.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CANDIDATOS = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];
const navegadorPath = () => CANDIDATOS.find(p => p && fs.existsSync(p));

const esperar = ms => new Promise(r => setTimeout(r, ms));
const PERFIL = path.join(os.tmpdir(), `central-jogos-chrome-${process.pid}`);
let estado = null; // { proc, ws, pend, id }

// Pedidos simultâneos compartilham a mesma inicialização (um só Chrome).
let iniciando = null;
function iniciar() {
  if (estado && estado.ws.readyState === 1) return Promise.resolve(estado);
  if (!iniciando) iniciando = abrirNavegador().finally(() => { iniciando = null; });
  return iniciando;
}

async function abrirNavegador() {
  const exe = navegadorPath();
  if (!exe) throw new Error('Chrome ou Edge não encontrado neste computador.');
  const perfil = PERFIL; // um perfil por programa: o servidor e o gerador do site podem rodar juntos
  // Apaga perfis temporários de execuções anteriores (os que estão em uso continuam travados e ficam).
  for (const nome of fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('central-jogos-chrome'))) {
    const p = path.join(os.tmpdir(), nome);
    if (p !== PERFIL) try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
  }
  fs.rmSync(path.join(perfil, 'DevToolsActivePort'), { force: true });
  const proc = spawn(exe, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${perfil}`,
    ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []), 'about:blank'], { stdio: 'ignore' });
  let porta;
  for (let i = 0; i < 80 && !porta; i++) {
    await esperar(150);
    try { porta = fs.readFileSync(path.join(perfil, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch {}
  }
  if (!porta) { proc.kill(); throw new Error('Não consegui iniciar o Chrome em segundo plano.'); }
  const versao = await (await fetch(`http://127.0.0.1:${porta}/json/version`)).json();
  const ws = new WebSocket(versao.webSocketDebuggerUrl);
  await new Promise((ok, falha) => { ws.onopen = ok; ws.onerror = falha; });
  const pend = {};
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend[m.id]) { m.error ? pend[m.id].falha(new Error(m.error.message)) : pend[m.id].ok(m.result); delete pend[m.id]; }
  };
  estado = { proc, ws, pend, id: 0 };
  return estado;
}

function cmd(method, params = {}, sessionId) {
  const e = estado;
  return new Promise((ok, falha) => {
    const i = ++e.id;
    e.pend[i] = { ok, falha };
    e.ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });
}

// Abre uma aba, executa fn(sessao) e fecha a aba.
async function comAba(largura, altura, fn) {
  await iniciar();
  const { targetId } = await cmd('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cmd('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => cmd(m, p, sessionId);
  try {
    await s('Page.enable');
    await s('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: false });
    const avaliar = async expr => (await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
    return await fn({ s, avaliar });
  } finally {
    await cmd('Target.closeTarget', { targetId }).catch(() => {});
  }
}

async function navegar(sessao, url, esperaExtra = 0) {
  await sessao.s('Page.navigate', { url });
  for (let i = 0; i < 100; i++) {
    await esperar(100);
    if (await sessao.avaliar('document.readyState') === 'complete') break;
  }
  if (esperaExtra) await esperar(esperaExtra);
}

// Tira o PNG de uma página no tamanho exato (ex.: 1080x1920).
async function capturarPNG(url, largura, altura, destino) {
  return comAba(largura, altura, async sessao => {
    await navegar(sessao, url);
    await sessao.avaliar(`(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
      for (let i = 0; i < 60 && document.querySelector('.fit') && document.body.dataset.pronto !== '1'; i++) await new Promise(r => setTimeout(r, 50));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return true;
    })()`);
    const r = await sessao.s('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: largura, height: altura, scale: 1 } });
    fs.writeFileSync(destino, Buffer.from(r.data, 'base64'));
    return destino;
  });
}

// Texto visível de uma página que monta o conteúdo com JavaScript (ex.: tabela da CBF).
// Com "contem", espera até esse texto aparecer (ou até esperaMs), em vez de um tempo fixo.
async function textoRenderizado(url, esperaMs = 6000, contem = null) {
  return comAba(1280, 900, async sessao => {
    await navegar(sessao, url, contem ? 0 : esperaMs);
    const ler = () => sessao.avaliar('document.body ? document.body.innerText : ""');
    let texto = await ler();
    for (const fim = Date.now() + esperaMs; contem && !texto.includes(contem) && Date.now() < fim;) {
      await esperar(500);
      texto = await ler();
    }
    if (contem) await esperar(800); // deixa terminar de montar a lista daquela data
    return contem ? await ler() : texto;
  });
}

function encerrar() {
  if (estado) { try { estado.proc.kill(); } catch {} estado = null; }
  setTimeout(() => { try { fs.rmSync(PERFIL, { recursive: true, force: true }); } catch {} }, 0).unref?.();
}
process.on('exit', encerrar);

module.exports = { capturarPNG, textoRenderizado, encerrar, navegadorPath };
