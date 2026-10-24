// Funções comuns: datas no fuso de Brasília, normalização de texto e HTTP.
const FUSO = 'America/Sao_Paulo';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function partes(data) {
  const p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(data).forEach(x => { p[x.type] = x.value; });
  return p;
}
const hojeISO = () => { const p = partes(new Date()); return `${p.year}-${p.month}-${p.day}`; };
const agoraHHMM = () => { const p = partes(new Date()); return `${p.hour}:${p.minute}`; };
const isoParaBR = iso => iso.split('-').reverse().join('/');
// Data e hora de Brasília a partir de um instante UTC.
function utcParaBrasilia(utc) {
  const p = partes(new Date(utc));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}
function somarDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10);
}
function diaSemana(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(a, m - 1, d, 12)));
}
const minutos = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

const semAcento = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = s => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—' };
function textoDeHtml(html) {
  return (html || '').replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ').trim();
}
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function buscarTexto(url, { timeout = 25000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal, redirect: 'follow' });
    return { ok: r.ok, status: r.status, texto: r.ok ? await r.text() : '' };
  } catch (e) {
    return { ok: false, status: 0, texto: '', erro: e.message };
  } finally { clearTimeout(t); }
}
async function buscarJSON(url, opcoes) {
  const r = await buscarTexto(url, opcoes);
  if (!r.ok) return null;
  try { return JSON.parse(r.texto); } catch { return null; }
}

module.exports = { FUSO, UA, hojeISO, agoraHHMM, isoParaBR, utcParaBrasilia, somarDias, diaSemana, minutos,
  semAcento, slug, textoDeHtml, escHtml, buscarTexto, buscarJSON };
