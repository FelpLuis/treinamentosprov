// Treinamentos UPDOWN — manuais, treinamentos e passo a passo por setor.
//
// - Login único: a sessão é a do Portal (portal.updown.com.br). O servidor pergunta ao
//   portal quem é o usuário (GET /sso/quem) repassando o cookie updown_sso.
// - Setores: vêm do cadastro do usuário no portal (#/usuarios). Cada treinamento é
//   marcado com um ou mais setores (ou "todos").
// - Editores: administradores do portal ou quem tem o sistema "treinamentos-editor".
//
// Sem dependências: só Node.js (>= 18).
import http from "node:http";
import { promises as fs, existsSync, mkdirSync, createReadStream, createWriteStream, writeFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const SEED_DIR = path.join(ROOT, "conteudo");
const SEED_MIDIA = path.join(SEED_DIR, "midia");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const MIDIA_DIR = path.join(DATA_DIR, "midia");
const TREINOS_FILE = path.join(DATA_DIR, "treinamentos.json");
const PROGRESSO_FILE = path.join(DATA_DIR, "progresso.json");
const BUSCAS_FILE = path.join(DATA_DIR, "buscas.json");

const PORT = Number(process.env.PORT || 8791);
const HOST = process.env.HOST || "127.0.0.1";
const PORTAL_INTERNO = (process.env.PORTAL_INTERNO || "http://127.0.0.1:8790").replace(/\/+$/, "");
const PORTAL_URL = (process.env.PORTAL_URL || "https://portal.updown.com.br").replace(/\/+$/, "");
const PUBLIC_URL = (process.env.PUBLIC_URL || "https://treinamentos.updown.com.br").replace(/\/+$/, "");
const COOKIE = process.env.COOKIE_NAME || "updown_sso";
const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_MB || 1024) * 1024 * 1024;
// Só para desenvolvimento local: DEV_USUARIO=luis.felipe dispensa o portal (usuário administrador).
const DEV_USUARIO = process.env.DEV_USUARIO || "";
const SISTEMA = "treinamentos";
const SISTEMA_EDITOR = "treinamentos-editor";

const NIVEIS = ["basico", "intermediario", "avancado"];
const AVISOS = ["info", "dica", "atencao", "sucesso"];
const ID_RE = /^[a-z0-9][a-z0-9-]{1,80}$/;
const MIDIA_RE = /^\/midia\/[a-z0-9][a-z0-9._-]{2,120}$/i;

const DEV_SETORES = [
  { id: "atendimento", nome: "Atendimento / Suporte N1", cor: "#0BBBEF", descricao: "Help desk, chat e ligações com o cliente." },
  { id: "comercial", nome: "Comercial", cor: "#9B00FF", descricao: "Vendas, planos, SVAs, cadastro e contratos." },
  { id: "noc", nome: "NOC", cor: "#0B0FEE", descricao: "Rede, OLTs, BRAS, switches e monitoramento." },
  { id: "campo", nome: "Técnicos de campo", cor: "#12B76A", descricao: "Instalação, provisionamento, CTO e manutenção externa." },
  { id: "financeiro", nome: "Financeiro", cor: "#F79009", descricao: "Cobranças, vencimentos, liberações e suspensões." },
  { id: "administrativo", nome: "Administrativo", cor: "#140075", descricao: "Gestão, RH e processos internos." },
];

// ================================================================ dados
let treinos = [];
let progresso = {};
let buscas = {};

async function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 1) + "\n", { mode: 0o600 });
  await fs.rename(tmp, file);
}
let chain = Promise.resolve();
const serial = (fn) => (chain = chain.then(fn, fn));
const saveTreinos = () => { indice = null; return serial(() => writeJsonAtomic(TREINOS_FILE, { treinamentos: treinos })); };
let progTimer = null;
const saveProgresso = () => { clearTimeout(progTimer); progTimer = setTimeout(() => serial(() => writeJsonAtomic(PROGRESSO_FILE, progresso)), 1500); };
let buscaTimer = null;
const saveBuscas = () => { clearTimeout(buscaTimer); buscaTimer = setTimeout(() => serial(() => writeJsonAtomic(BUSCAS_FILE, buscas)), 3000); };

// Grava na hora o que estava esperando (desligamento do serviço)
function descarregar() {
  if (progTimer) { clearTimeout(progTimer); progTimer = null; try { writeFileSync(PROGRESSO_FILE, JSON.stringify(progresso, null, 1) + "\n", { mode: 0o600 }); } catch {} }
  if (buscaTimer) { clearTimeout(buscaTimer); buscaTimer = null; try { writeFileSync(BUSCAS_FILE, JSON.stringify(buscas, null, 1) + "\n", { mode: 0o600 }); } catch {} }
}

async function lerJson(file, padrao) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return padrao; }
}

async function loadAll() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  if (!existsSync(MIDIA_DIR)) mkdirSync(MIDIA_DIR, { recursive: true });
  if (!existsSync(TREINOS_FILE)) {
    // Primeira subida: traz o conteúdo importado da wiki (conteudo/treinamentos.json).
    const seed = await lerJson(path.join(SEED_DIR, "treinamentos.json"), { treinamentos: [] });
    treinos = seed.treinamentos || [];
    await saveTreinos();
    console.log(`[treinamentos] ${treinos.length} treinamento(s) carregados do conteúdo inicial`);
  } else {
    treinos = (await lerJson(TREINOS_FILE, { treinamentos: [] })).treinamentos || [];
  }
  progresso = await lerJson(PROGRESSO_FILE, {});
  buscas = await lerJson(BUSCAS_FILE, {});
  indice = null;
}

// ================================================================ login único (portal)
const quemCache = new Map();
setInterval(() => { const t = Date.now(); for (const [k, v] of quemCache) if (v.ate < t) quemCache.delete(k); }, 60_000).unref();

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch {} }
  }
  return out;
}

function clientIp(req) {
  const xr = String(req.headers["x-real-ip"] || "").trim();
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xr || xf || req.socket.remoteAddress || "";
}

function montarUsuario(d) {
  const u = d.user;
  const editor = !!u.admin || (d.sistemas || []).includes(SISTEMA_EDITOR);
  return { username: u.username, nome: u.name || u.username, perfil: u.role, admin: !!u.admin, editor, setores: u.setores || [], catalogo: d.setores || [] };
}

// { status: 200, user } | { status: 401 } | { status: 403 } | { status: 503 }
async function quem(req) {
  if (DEV_USUARIO) {
    return { status: 200, user: { username: DEV_USUARIO, nome: DEV_USUARIO, perfil: "administrador", admin: true, editor: true, setores: ["atendimento"], catalogo: DEV_SETORES } };
  }
  const token = parseCookies(req)[COOKIE];
  if (!token) return { status: 401 };
  const chave = crypto.createHash("sha256").update(token).digest("hex");
  const c = quemCache.get(chave);
  if (c && c.ate > Date.now()) return c.r;
  let r;
  try {
    const resp = await fetch(`${PORTAL_INTERNO}/sso/quem?sistema=${SISTEMA},${SISTEMA_EDITOR}`, {
      headers: { Cookie: `${COOKIE}=${encodeURIComponent(token)}`, "X-Real-IP": clientIp(req), "User-Agent": "treinamentos-updown" },
      signal: AbortSignal.timeout(4000),
    });
    if (resp.status === 200) r = { status: 200, user: montarUsuario(await resp.json()) };
    else if (resp.status === 401 || resp.status === 403) r = { status: resp.status };
    else r = { status: 503 };
  } catch { r = { status: 503 }; }
  if (r.status !== 503) quemCache.set(chave, { r, ate: Date.now() + 20_000 });
  return r;
}

const loginUrl = (req) => `${PORTAL_URL}/sso/entrar?sistema=${SISTEMA}&volta=${encodeURIComponent(PUBLIC_URL + (req.url || "/"))}`;

// ================================================================ http util
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
const CSP_APP =
  "default-src 'self'; img-src 'self' data: blob: https://i.ytimg.com; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; " +
  "font-src 'self'; script-src 'self'; connect-src 'self'; frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com; " +
  "frame-ancestors 'self'; base-uri 'none'; form-action 'self'; object-src 'none'";

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}
const json = (res, status, data, headers = {}) =>
  send(res, status, JSON.stringify(data), { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
const redirect = (res, location) => send(res, 302, "", { Location: location, "Cache-Control": "no-store" });
const httpError = (status, message) => Object.assign(new Error(message), { status });

async function readJson(req, limite = 8 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limite) throw httpError(413, "Conteúdo grande demais.");
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { throw httpError(400, "JSON inválido."); }
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".m4v": "video/mp4",
  ".pdf": "application/pdf", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".mp3": "audio/mpeg", ".txt": "text/plain; charset=utf-8",
  ".lottie": "application/zip",
};
const UPLOAD_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".mp4", ".webm", ".mov", ".m4v", ".pdf", ".pptx", ".docx", ".xlsx", ".mp3", ".html", ".json"]);

async function serveFile(res, rel, cache = "public, max-age=3600") {
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, "Não encontrado");
  try {
    const data = await fs.readFile(file);
    const ext = path.extname(file);
    send(res, 200, data, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : cache,
      ...(ext === ".html" ? { "Content-Security-Policy": CSP_APP, "X-Frame-Options": "SAMEORIGIN" } : {}),
    });
  } catch { send(res, 404, "Não encontrado"); }
}

// Mídia com suporte a Range (vídeos). Procura primeiro nos enviados, depois no conteúdo inicial.
async function serveMidia(req, res, nome) {
  if (!/^[a-z0-9][a-z0-9._-]{2,120}$/i.test(nome)) return send(res, 404, "Não encontrado");
  let file = path.join(MIDIA_DIR, nome);
  let st = await fs.stat(file).catch(() => null);
  if (!st) { file = path.join(SEED_MIDIA, nome); st = await fs.stat(file).catch(() => null); }
  if (!st || !st.isFile()) return send(res, 404, "Não encontrado");
  const ext = path.extname(nome).toLowerCase();
  const headers = {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": "private, max-age=86400",
    "Accept-Ranges": "bytes",
  };
  // HTML/SVG enviados (animações e treinamentos interativos) rodam isolados, sem acesso à sessão.
  if (ext === ".html" || ext === ".svg") {
    headers["Content-Security-Policy"] = "sandbox allow-scripts allow-popups allow-forms; default-src 'self' data: blob: 'unsafe-inline'; img-src * data: blob:; media-src * data: blob:; font-src * data:; style-src * 'unsafe-inline'; script-src 'unsafe-inline' 'self' data: blob:; connect-src 'none'; frame-ancestors 'self'";
  } else {
    headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'";
  }
  if (ext === ".pdf") headers["Content-Disposition"] = "inline";
  if ([".pptx", ".docx", ".xlsx"].includes(ext)) headers["Content-Disposition"] = `attachment; filename="${nome}"`;
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : st.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : st.size - 1;
    if (start < 0) start = 0;
    if (start >= st.size || end < start) { res.writeHead(416, { "Content-Range": `bytes */${st.size}` }); return res.end(); }
    end = Math.min(end, st.size - 1);
    res.writeHead(206, { ...SECURITY_HEADERS, ...headers, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1 });
    if (req.method === "HEAD") return res.end();
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...SECURITY_HEADERS, ...headers, "Content-Length": st.size });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
}

async function upload(req, res, user) {
  const nomeOriginal = decodeURIComponent(String(req.headers["x-nome"] || "arquivo")).slice(0, 160);
  const ext = path.extname(nomeOriginal).toLowerCase();
  if (!UPLOAD_EXT.has(ext)) throw httpError(415, `Tipo de arquivo não aceito (${ext || "sem extensão"}). Use imagem, vídeo, GIF, PDF ou HTML.`);
  const len = Number(req.headers["content-length"] || 0);
  if (len > MAX_UPLOAD) throw httpError(413, `Arquivo maior que ${Math.round(MAX_UPLOAD / 1048576)} MB.`);
  const base = nomeOriginal.slice(0, -ext.length || undefined).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "arquivo";
  const nome = `${base}-${crypto.randomBytes(5).toString("hex")}${ext}`;
  const destino = path.join(MIDIA_DIR, nome);
  let total = 0;
  const limitador = async function* (src) {
    for await (const chunk of src) {
      total += chunk.length;
      if (total > MAX_UPLOAD) throw httpError(413, "Arquivo grande demais.");
      yield chunk;
    }
  };
  try {
    await pipeline(req, limitador, createWriteStream(destino, { mode: 0o640 }));
  } catch (e) {
    await fs.rm(destino, { force: true });
    throw e.status ? e : httpError(400, "Falha no envio do arquivo.");
  }
  if (!total) { await fs.rm(destino, { force: true }); throw httpError(400, "Arquivo vazio."); }
  console.log(`[treinamentos] ${user.username} enviou ${nome} (${total} bytes)`);
  return json(res, 201, { url: `/midia/${nome}`, nome: nomeOriginal, bytes: total, tipo: MIME[ext] || "" });
}

// ================================================================ sanitização do HTML dos blocos de texto
const TAGS = {
  b: [], strong: [], i: [], em: [], u: [], s: [], br: [], p: [], ul: [], ol: [], li: [], a: ["href"], code: [], pre: [],
  h3: [], h4: [], blockquote: [], mark: [], table: [], thead: [], tbody: [], tr: [], th: ["colspan", "rowspan"],
  td: ["colspan", "rowspan"], hr: [], kbd: [], sub: [], sup: [], span: [], div: [], small: [],
};
const VAZIAS = new Set(["br", "hr"]);
const escTexto = (t) => t.replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function sanitizar(html) {
  let s = String(html || "").slice(0, 200_000);
  s = s.replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  const out = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|<|>/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    out.push(escTexto(s.slice(last, m.index)));
    last = re.lastIndex;
    if (!m[1]) { out.push(m[0] === "<" ? "&lt;" : "&gt;"); continue; }
    const tag = m[1].toLowerCase();
    if (!TAGS[tag]) continue;
    const fecha = m[0][1] === "/";
    if (fecha) { if (!VAZIAS.has(tag)) out.push(`</${tag}>`); continue; }
    const attrs = [];
    const ar = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let a;
    while ((a = ar.exec(m[2]))) {
      const nome = a[1].toLowerCase();
      if (!TAGS[tag].includes(nome)) continue;
      let v = (a[3] ?? a[4] ?? a[5] ?? "").replace(/&amp;/g, "&").trim();
      // "/caminho" sim; "//host" e "/\host" nao (o navegador trata "/\" como "//" e sai do site).
      // Caractere de controle no meio (ex.: "java\tscript:") tambem nao.
      if (nome === "href" && (!/^(https?:|mailto:|tel:|#|\/(?![\/\\]))/i.test(v) || /[\u0000-\u001F]/.test(v))) continue;
      if (nome !== "href" && !/^\d{1,2}$/.test(v)) continue;
      attrs.push(` ${nome}="${escAttr(v)}"`);
    }
    if (tag === "a" && attrs.some((x) => x.includes('href="http'))) attrs.push(' target="_blank" rel="noopener noreferrer"');
    out.push(`<${tag}${attrs.join("")}>`);
  }
  out.push(escTexto(s.slice(last)));
  return out.join("");
}

const textoSimples = (t, max = 2000) => String(t ?? "").replace(/[\u0000-\u0008\u000B-\u001F]/g, "").trim().slice(0, max);
const textoLongo = (t) => String(t ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, 100_000);

function validarSrc(src, { externo = false } = {}) {
  const v = String(src || "").trim();
  if (!v) return "";
  if (MIDIA_RE.test(v)) return v;
  if (externo && /^https:\/\/[^\s"'<>]+$/i.test(v)) return v;
  throw httpError(400, `Endereço de mídia inválido: ${v.slice(0, 60)}`);
}

const novoId = (p = "b") => `${p}${crypto.randomBytes(4).toString("hex")}`;

function validarBloco(b) {
  const tipo = String(b?.tipo || "");
  const id = /^[a-z0-9]{3,20}$/.test(b?.id || "") ? b.id : novoId();
  switch (tipo) {
    case "texto": return { id, tipo, html: sanitizar(b.html) };
    case "aviso": return { id, tipo, estilo: AVISOS.includes(b.estilo) ? b.estilo : "info", titulo: textoSimples(b.titulo, 120), html: sanitizar(b.html) };
    case "imagem": return {
      id, tipo, src: validarSrc(b.src), legenda: sanitizar(textoSimples(b.legenda, 600)), alt: textoSimples(b.alt, 200),
      w: Math.max(0, Math.min(20000, Number(b.w) || 0)), h: Math.max(0, Math.min(20000, Number(b.h) || 0)),
      largura: ["normal", "larga", "pequena"].includes(b.largura) ? b.largura : "normal",
      marcadores: (Array.isArray(b.marcadores) ? b.marcadores : []).slice(0, 20).map((m) => ({
        x: Math.max(0, Math.min(100, Number(m.x) || 0)), y: Math.max(0, Math.min(100, Number(m.y) || 0)), texto: textoSimples(m.texto, 200),
      })),
    };
    case "video": {
      const src = validarSrc(b.src, { externo: true });
      return { id, tipo, src, legenda: textoSimples(b.legenda, 300), titulo: textoSimples(b.titulo, 160), capa: b.capa ? validarSrc(b.capa) : "" };
    }
    case "animacao": {
      const modo = ["arquivo", "sequencia"].includes(b.modo) ? b.modo : "sequencia";
      return {
        id, tipo, modo, titulo: textoSimples(b.titulo, 160), src: modo === "arquivo" ? validarSrc(b.src) : "",
        intervalo: Math.max(1, Math.min(30, Number(b.intervalo) || 4)),
        transicao: ["deslizar", "esmaecer", "zoom"].includes(b.transicao) ? b.transicao : "deslizar",
        quadros: modo === "sequencia" ? (Array.isArray(b.quadros) ? b.quadros : []).slice(0, 40).map((q) => ({
          src: q.src ? validarSrc(q.src) : "", titulo: textoSimples(q.titulo, 120), texto: textoSimples(q.texto, 500),
        })) : [],
      };
    }
    case "passos": return { id, tipo, itens: (Array.isArray(b.itens) ? b.itens : []).slice(0, 60).map((x) => sanitizar(x)).filter(Boolean) };
    case "checklist": return { id, tipo, titulo: textoSimples(b.titulo, 160), itens: (Array.isArray(b.itens) ? b.itens : []).slice(0, 60).map((x) => textoSimples(x, 300)).filter(Boolean) };
    case "dialogo": return {
      id, tipo, falas: (Array.isArray(b.falas) ? b.falas : []).slice(0, 80).map((f) => ({
        quem: ["atendente", "cliente", "tecnico"].includes(f.quem) ? f.quem : "atendente", texto: textoSimples(f.texto, 3000),
      })).filter((f) => f.texto),
    };
    case "codigo": return { id, tipo, rotulo: textoSimples(b.rotulo, 120), texto: textoLongo(b.texto) };
    case "arquivo": return { id, tipo, src: validarSrc(b.src, { externo: true }), nome: textoSimples(b.nome, 200), descricao: textoSimples(b.descricao, 300) };
    case "links": return {
      id, tipo, itens: (Array.isArray(b.itens) ? b.itens : []).slice(0, 60).map((l) => ({
        titulo: textoSimples(l.titulo, 200), url: /^(https?:\/\/|\/)/i.test(String(l.url || "")) ? textoSimples(l.url, 1000) : "",
        descricao: textoSimples(l.descricao, 300),
      })).filter((l) => l.url),
    };
    case "interativo": return {
      id, tipo, src: validarSrc(b.src), titulo: textoSimples(b.titulo, 160), altura: Math.max(300, Math.min(4000, Number(b.altura) || 820)),
      texto: textoLongo(b.texto).slice(0, 60_000),
    };
    case "divisor": return { id, tipo };
    default: throw httpError(400, `Tipo de bloco desconhecido: ${tipo.slice(0, 30)}`);
  }
}

function slug(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "treinamento";
}

function validarTreino(body, atual, user, catalogo) {
  const titulo = textoSimples(body.titulo, 140);
  if (!titulo) throw httpError(400, "Dê um título ao treinamento.");
  const validos = new Set(catalogo.map((s) => s.id));
  const setores = (Array.isArray(body.setores) ? body.setores : []).map(String).filter((s) => validos.has(s) || (atual?.setores || []).includes(s));
  const etapas = (Array.isArray(body.etapas) ? body.etapas : []).slice(0, 80).map((e, i) => ({
    id: /^[a-z0-9]{3,20}$/.test(e?.id || "") ? e.id : novoId("e"),
    titulo: textoSimples(e?.titulo, 160) || `Etapa ${i + 1}`,
    blocos: (Array.isArray(e?.blocos) ? e.blocos : []).slice(0, 300).map(validarBloco),
  }));
  if (!etapas.length) throw httpError(400, "O treinamento precisa de pelo menos uma etapa.");
  const agora = new Date().toISOString();
  return {
    id: atual?.id || `${slug(titulo)}-${crypto.randomBytes(2).toString("hex")}`,
    titulo,
    resumo: textoSimples(body.resumo, 500),
    setores: [...new Set(setores)],
    categoria: textoSimples(body.categoria, 60),
    tags: [...new Set((Array.isArray(body.tags) ? body.tags : []).map((t) => textoSimples(t, 40).toLowerCase()).filter(Boolean))].slice(0, 30),
    capa: body.capa ? validarSrc(body.capa) : "",
    icone: textoSimples(body.icone, 20),
    nivel: NIVEIS.includes(body.nivel) ? body.nivel : "basico",
    duracao: Math.max(0, Math.min(600, Math.round(Number(body.duracao) || 0))),
    publicado: body.publicado !== false,
    destaque: !!body.destaque,
    etapas,
    origem: atual?.origem || textoSimples(body.origem, 300),
    autor: atual?.autor || user.nome,
    criado_em: atual?.criado_em || agora,
    atualizado_em: agora,
    atualizado_por: user.nome,
    visualizacoes: atual?.visualizacoes || 0,
  };
}

// ================================================================ visibilidade
const visivel = (t, u) => {
  if (u.editor) return true;
  if (!t.publicado) return false;
  return !t.setores.length || t.setores.some((s) => u.setores.includes(s));
};

function textoDoBloco(b) {
  const tira = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  switch (b.tipo) {
    case "texto": return tira(b.html);
    case "aviso": return `${b.titulo || ""} ${tira(b.html)}`;
    case "imagem": return `${tira(b.legenda)} ${b.alt || ""} ${(b.marcadores || []).map((m) => m.texto).join(" ")}`;
    case "video": return `${b.titulo || ""} ${b.legenda || ""}`;
    case "animacao": return `${b.titulo || ""} ${(b.quadros || []).map((q) => `${q.titulo} ${q.texto}`).join(" ")}`;
    case "passos": return b.itens.map(tira).join(" ");
    case "checklist": return `${b.titulo || ""} ${b.itens.join(" ")}`;
    case "dialogo": return b.falas.map((f) => f.texto).join(" ");
    case "codigo": return `${b.rotulo || ""} ${b.texto}`;
    case "arquivo": return `${b.nome || ""} ${b.descricao || ""}`;
    case "links": return b.itens.map((l) => `${l.titulo} ${l.descricao}`).join(" ");
    case "interativo": return `${b.titulo || ""} ${b.texto || ""}`;
    default: return "";
  }
}

function resumoTreino(t, u) {
  const p = progresso[u.username]?.[t.id];
  const tipos = new Set();
  for (const e of t.etapas) for (const b of e.blocos) tipos.add(b.tipo);
  return {
    id: t.id, titulo: t.titulo, resumo: t.resumo, setores: t.setores, categoria: t.categoria, tags: t.tags, capa: t.capa,
    icone: t.icone, nivel: t.nivel, duracao: t.duracao, publicado: t.publicado, destaque: t.destaque,
    etapas: t.etapas.length, atualizado_em: t.atualizado_em, autor: t.autor, visualizacoes: t.visualizacoes || 0,
    midias: { video: tipos.has("video"), animacao: tipos.has("animacao"), interativo: tipos.has("interativo"), imagem: tipos.has("imagem") },
    progresso: p ? { etapa: p.etapa || 0, concluido: !!p.concluido, em: p.em } : null,
  };
}

// ================================================================ busca
// Busca por dúvida ou palavra-chave: normaliza acentos, tira palavras vazias, reduz plurais,
// expande sinônimos do dia a dia do provedor e pontua por campo (título > etiquetas > resumo > conteúdo).
const VAZIAS_PT = new Set(("a o e é de da do das dos em no na nos nas um uma uns umas para pra pro por com que se como qual quais " +
  "quando onde porque porquê ao aos à às ou mais menos muito meu minha meus minhas seu sua seus suas ele ela eles elas eu voce você " +
  "nao não sim isso esse essa este esta foi ser ter tem estou esta está estão faco faço fazer fazer o que sobre ja já lhe me te nos " +
  "vou vai ir preciso precisa quero saber consigo consegue posso pode dá da").split(/\s+/).map((w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "")));

const SINONIMOS = [
  ["wifi", "wi-fi", "wireless", "ssid", "rede sem fio"],
  ["roteador", "onu", "ont", "modem", "equipamento", "aparelho", "f670l", "670l"],
  ["lento", "lenta", "lentidao", "devagar", "instabilidade", "instavel", "oscilacao", "oscilando", "travando", "trava", "navegacao"],
  ["semconexao", "queda", "offline", "desconectado", "desconecta", "los", "luzvermelha"],
  ["boleto", "fatura", "cobranca", "pagamento", "2via"],
  ["os", "ordem servico", "visita", "visita tecnica", "chamado"],
  ["atendimento", "protocolo", "chamado"],
  ["senha", "password"],
  ["sinal", "potencia", "dbm", "optico", "atenuacao"],
  ["cancelar", "cancelamento", "reversao", "retencao"],
  ["contrato", "assinatura", "assinar", "zapsign", "autentique"],
  ["plano", "pacote", "velocidade", "mega", "giga", "upgrade"],
  ["cto", "caixa", "porta", "splitter"],
  ["ping", "latencia", "lag", "jogo", "gamer", "nat"],
  ["tv", "iptv", "canal"],
  ["provisionar", "provisionamento", "ativacao", "ativar", "instalacao", "instalar"],
  ["endereco", "mudanca", "titularidade"],
  ["vencimento", "data vencimento"],
  ["liberacao", "liberar", "desbloquear", "bloqueado", "bloqueio"],
  ["comando", "cli", "huawei", "display"],
  ["ixc", "sistema", "cadastro"],
  ["smartolt", "smart olt", "olt"],
  ["fibra", "ftth", "gpon", "pon"],
];

// Expressões do dia a dia viram um termo só, para casar a dúvida com o conteúdo.
const EXPRESSOES = [
  [/\b(sem (internet|conexao|acesso|sinal de internet)|nao (conecta|navega|tem internet)|caiu a (internet|conexao)|internet (caiu|parou|nao funciona)|esta offline)\b/g, " semconexao "],
  [/\bluz(es)? vermelha(s)?\b|\bled vermelho\b/g, " luzvermelha "],
  [/\bordem de servico\b|\bordens de servico\b/g, " os "],
  [/\b(segunda|2a) via\b/g, " 2via "],
];
export function normalizar(t) {
  let s = String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ª/g, "a")
    .replace(/\b([a-z])\.([a-z])\.?/g, "$1$2").replace(/wi-fi/g, "wifi").replace(/smart\s*olt/g, "smartolt");
  for (const [re, v] of EXPRESSOES) s = s.replace(re, v);
  return s;
}
function radical(w) {
  if (w.length <= 3 || /^\d/.test(w)) return w;
  let x = w.replace(/coes$/, "cao").replace(/oes$/, "ao").replace(/aes$/, "ao").replace(/ais$/, "al").replace(/eis$/, "el").replace(/ns$/, "m");
  if (x !== w) return x;
  if (/[rsz]es$/.test(x) && x.length > 4) return x.slice(0, -2);
  return x.endsWith("s") && !x.endsWith("ss") ? x.slice(0, -1) : x;
}
export function tokens(t, { manterVazias = false } = {}) {
  return normalizar(t).split(/[^a-z0-9]+/).filter((w) => w && (manterVazias || !VAZIAS_PT.has(w))).map(radical);
}
const SINO = new Map();
for (const g of SINONIMOS) {
  const toks = [...new Set(g.flatMap((x) => tokens(x)))];
  for (const t of toks) SINO.set(t, [...new Set([...(SINO.get(t) || []), ...toks])]);
}

// Palavras que aparecem em quase tudo e pouco dizem sobre a dúvida
const FRACOS = new Set(["internet", "cliente", "sistema", "updown", "verificar", "problema"]);
let indice = null;
const PESOS = { titulo: 6, tags: 4, categoria: 3, resumo: 2.5, etapa: 3, corpo: 1 };

function construirIndice() {
  const docs = [];
  for (const t of treinos) {
    const base = { titulo: tokens(t.titulo), tags: tokens(t.tags.join(" ")), categoria: tokens(t.categoria), resumo: tokens(t.resumo) };
    t.etapas.forEach((e, i) => {
      const texto = e.blocos.map(textoDoBloco).join(" ").replace(/\s+/g, " ").trim();
      docs.push({ t, i, texto, campos: { ...base, etapa: tokens(e.titulo), corpo: tokens(texto) } });
    });
  }
  const df = new Map();
  for (const d of docs) {
    d.tf = {};
    for (const [campo, toks] of Object.entries(d.campos)) {
      const m = new Map();
      for (const w of toks) m.set(w, (m.get(w) || 0) + 1);
      d.tf[campo] = m;
      d.len = (d.len || 0) + toks.length;
    }
    for (const w of new Set(Object.values(d.campos).flat())) df.set(w, (df.get(w) || 0) + 1);
  }
  const avg = docs.reduce((a, d) => a + d.len, 0) / (docs.length || 1);
  indice = { docs, df, avg, vocab: [...df.keys()] };
  return indice;
}

function trecho(texto, termos, tam = 220) {
  const norm = normalizar(texto);
  let pos = -1;
  for (const t of termos) { const p = norm.search(new RegExp(`\\b${t.replace(/[^a-z0-9]/g, "")}`)); if (p >= 0 && (pos < 0 || p < pos)) pos = p; }
  const ini = Math.max(0, pos - 60);
  let s = texto.slice(ini, ini + tam).trim();
  if (ini > 0) s = "…" + s;
  if (ini + tam < texto.length) s += "…";
  return s;
}

export function buscar(q, u, { setor = "", limite = 30 } = {}) {
  const idx = indice || construirIndice();
  const termos = [...new Set(tokens(q))];
  if (!termos.length) return { termos: [], resultados: [] };
  const N = idx.docs.length || 1;
  const k1 = 1.2, b = 0.6;
  // termo → [{token, peso}] : exato 1, sinônimo .6, prefixo .5
  const exp = termos.map((w) => {
    const lista = [{ w, p: FRACOS.has(w) ? 0.3 : 1 }];
    for (const s of SINO.get(w) || []) if (s !== w) lista.push({ w: s, p: 0.6 });
    if (w.length >= 3) for (const v of idx.vocab) if (v !== w && v.startsWith(w)) lista.push({ w: v, p: 0.5 });
    return lista;
  });
  const qn = normalizar(q).trim();
  const porTreino = new Map();
  for (const d of idx.docs) {
    if (!visivel(d.t, u)) continue;
    if (setor && !(d.t.setores.includes(setor) || !d.t.setores.length)) continue;
    let score = 0, cobertos = 0;
    for (const lista of exp) {
      let melhor = 0;
      for (const { w, p } of lista) {
        const n = idx.df.get(w);
        if (!n) continue;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        let s = 0;
        for (const [campo, peso] of Object.entries(PESOS)) {
          const f = d.tf[campo].get(w) || 0;
          if (f) s += peso * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / idx.avg)));
        }
        melhor = Math.max(melhor, s * p);
      }
      if (melhor > 0) cobertos++;
      score += melhor;
    }
    if (!score) continue;
    score *= 0.5 + cobertos / exp.length; // documentos que respondem a todos os termos sobem
    if (qn.length > 4 && normalizar(`${d.t.titulo} ${d.t.etapas[d.i].titulo} ${d.texto}`).includes(qn)) score *= 1.6;
    const atual = porTreino.get(d.t.id);
    if (!atual || score > atual.score) porTreino.set(d.t.id, { score: Math.max(score, atual?.score || 0), d, extra: atual ? atual.extra + 1 : 0 });
    else atual.extra++;
  }
  const SINTETICOS = new Set(["semconexao", "luzvermelha", "2via"]);
  const crus = String(q).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !VAZIAS_PT.has(w) && w !== "sem").map(radical);
  const termosTexto = [...new Set([...crus, ...exp.flatMap((l) => l.filter((x) => x.p >= 0.6).map((x) => x.w))])].filter((w) => !SINTETICOS.has(w) && !FRACOS.has(w));
  const ordenados = [...porTreino.values()]
    .map((r) => ({ ...r, score: r.score * (1 + Math.min(r.extra, 4) * 0.05) }))
    .sort((a, b) => b.score - a.score);
  const corte = (ordenados[0]?.score || 0) * 0.07; // resultados fracos demais perto do melhor saem
  const resultados = ordenados.filter((r) => r.score >= corte).slice(0, limite)
    .map(({ score, d }) => ({
      ...resumoTreino(d.t, u),
      relevancia: Math.round(score * 10) / 10,
      etapa: d.i,
      etapa_titulo: d.t.etapas[d.i].titulo,
      trecho: trecho(d.texto || d.t.resumo, termosTexto),
    }));
  return { termos: termosTexto, resultados };
}

function registrarBusca(q, n, u) {
  const k = normalizar(q).replace(/\s+/g, " ").trim().slice(0, 120);
  if (k.length < 3) return;
  const b = buscas[k] || (buscas[k] = { q: q.slice(0, 120), vezes: 0, sem_resultado: 0, ultima: null, usuarios: [] });
  b.vezes++;
  if (!n) b.sem_resultado++;
  b.ultima = new Date().toISOString();
  if (!b.usuarios.includes(u.username)) b.usuarios = [...b.usuarios, u.username].slice(-20);
  const chaves = Object.keys(buscas);
  if (chaves.length > 2000) {
    chaves.sort((a, c) => (buscas[a].ultima || "").localeCompare(buscas[c].ultima || "")).slice(0, chaves.length - 2000).forEach((x) => delete buscas[x]);
  }
  saveBuscas();
}

// ================================================================ rotas
const vistos = new Map();
function contarVisita(t, u) {
  const k = `${u.username}|${t.id}`;
  if ((vistos.get(k) || 0) > Date.now() - 3600_000) return;
  vistos.set(k, Date.now());
  t.visualizacoes = (t.visualizacoes || 0) + 1;
  serial(() => writeJsonAtomic(TREINOS_FILE, { treinamentos: treinos }));
}

const paginaErro = (titulo, texto, link) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo} · Treinamentos UPDOWN</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/css/app.css"></head>
<body class="pagina-erro"><main><img src="/assets/brand/updown-logo-dark.png" alt="UPDOWN" class="erro-logo"><h1>${titulo}</h1><p>${texto}</p>${link}</main></body></html>`;

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  const method = req.method;

  if (p === "/healthz") return send(res, 200, "ok", { "Content-Type": "text/plain" });
  if (method === "GET" && (p.startsWith("/assets/") || p.startsWith("/css/") || p.startsWith("/js/") || p === "/favicon.ico")) {
    return serveFile(res, p, p.startsWith("/assets/") ? "public, max-age=604800" : "public, max-age=300");
  }

  const r = await quem(req);
  if (r.status !== 200) {
    const api = p.startsWith("/api/");
    if (r.status === 401) {
      if (api) return json(res, 401, { error: "Sessão expirada. Entre novamente pelo portal.", login: loginUrl({ url: "/" }), login_base: `${PORTAL_URL}/sso/entrar?sistema=${SISTEMA}&volta=` });
      // Na página inicial o link pode ter #/t/...: o navegador só conhece o # e o repassa ao portal.
      if (p === "/" && method === "GET") {
        return send(res, 200, `<!doctype html><meta charset="utf-8"><title>Entrando…</title><a id="entrar" href="${loginUrl(req)}" data-base="${PORTAL_URL}/sso/entrar?sistema=${SISTEMA}&amp;volta=">Entrar pelo portal</a><script src="/js/entrar.js"></script>`,
          { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; script-src 'self'" });
      }
      return redirect(res, loginUrl(req));
    }
    if (r.status === 403) {
      return api ? json(res, 403, { error: "Seu usuário não tem acesso aos Treinamentos." })
        : send(res, 403, paginaErro("Sem acesso aos treinamentos", "Seu usuário ainda não foi liberado para esta plataforma. Peça ao administrador para marcar <b>Treinamentos UPDOWN</b> no seu cadastro do portal.",
          `<a class="btn btn-primario" href="${PORTAL_URL}/">Voltar ao portal</a>`), { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    }
    return api ? json(res, 503, { error: "O portal de login não respondeu. Tente de novo em instantes." })
      : send(res, 503, paginaErro("Portal indisponível", "Não foi possível confirmar seu login no portal agora. Tente de novo em instantes.", `<a class="btn btn-primario" href="/">Tentar de novo</a>`),
        { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  }
  const u = r.user;

  if ((method === "GET" || method === "HEAD") && p.startsWith("/midia/")) return serveMidia(req, res, p.slice(7));
  if (method === "GET" && (p === "/" || p === "/index.html")) return serveFile(res, "/index.html");
  if (p === "/sair") return redirect(res, `${PORTAL_URL}/sso/sair`);

  if (!p.startsWith("/api/")) return redirect(res, "/");
  if (method !== "GET" && req.headers["x-treinamentos"] !== "1") return json(res, 403, { error: "Requisição recusada." });

  if (p === "/api/me" && method === "GET") {
    return json(res, 200, { user: { username: u.username, nome: u.nome, perfil: u.perfil, admin: u.admin, editor: u.editor, setores: u.setores }, setores: u.catalogo, portal: PORTAL_URL });
  }

  if (p === "/api/treinamentos" && method === "GET") {
    const lista = treinos.filter((t) => visivel(t, u)).map((t) => resumoTreino(t, u));
    const categorias = [...new Set(lista.map((t) => t.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return json(res, 200, { treinamentos: lista, categorias });
  }

  if (p === "/api/busca" && method === "GET") {
    const q = String(url.searchParams.get("q") || "").slice(0, 200);
    const r2 = buscar(q, u, { setor: String(url.searchParams.get("setor") || "") });
    if (url.searchParams.get("registrar") === "1") registrarBusca(q, r2.resultados.length, u);
    return json(res, 200, r2);
  }

  const tm = p.match(/^\/api\/treinamentos\/([a-z0-9-]+)$/);
  if (tm && method === "GET") {
    const t = treinos.find((x) => x.id === tm[1]);
    if (!t || !visivel(t, u)) return json(res, 404, { error: "Treinamento não encontrado ou sem acesso para o seu setor." });
    if (url.searchParams.get("editar") !== "1") contarVisita(t, u);
    return json(res, 200, { treinamento: t, progresso: progresso[u.username]?.[t.id] || null });
  }

  const pm = p.match(/^\/api\/progresso\/([a-z0-9-]+)$/);
  if (pm && method === "POST") {
    const t = treinos.find((x) => x.id === pm[1]);
    if (!t || !visivel(t, u)) return json(res, 404, { error: "Treinamento não encontrado." });
    const body = await readJson(req, 4096);
    const meu = progresso[u.username] || (progresso[u.username] = {});
    const atual = meu[t.id] || {};
    const etapa = Math.max(0, Math.min(t.etapas.length - 1, Number(body.etapa) || 0));
    meu[t.id] = {
      etapa,
      vistas: [...new Set([...(atual.vistas || []), etapa])].slice(0, 200),
      concluido: body.concluido === undefined ? !!atual.concluido : !!body.concluido,
      em: new Date().toISOString(),
    };
    saveProgresso();
    return json(res, 200, { progresso: meu[t.id] });
  }

  // ------------------------------------------------ edição
  if (!u.editor) return json(res, 403, { error: "Só editores de treinamentos." });

  if (p === "/api/midia" && method === "POST") return upload(req, res, u);

  if (p === "/api/treinamentos" && method === "POST") {
    const t = validarTreino(await readJson(req), null, u, u.catalogo);
    while (treinos.some((x) => x.id === t.id)) t.id = `${slug(t.titulo)}-${crypto.randomBytes(2).toString("hex")}`;
    treinos.unshift(t);
    await saveTreinos();
    return json(res, 201, { treinamento: t });
  }
  if (tm && method === "PUT") {
    const i = treinos.findIndex((x) => x.id === tm[1]);
    if (i < 0) return json(res, 404, { error: "Treinamento não encontrado." });
    treinos[i] = validarTreino(await readJson(req), treinos[i], u, u.catalogo);
    await saveTreinos();
    return json(res, 200, { treinamento: treinos[i] });
  }
  if (tm && method === "DELETE") {
    const i = treinos.findIndex((x) => x.id === tm[1]);
    if (i < 0) return json(res, 404, { error: "Treinamento não encontrado." });
    treinos.splice(i, 1);
    await saveTreinos();
    return json(res, 200, { ok: true });
  }

  if (p === "/api/gestao" && method === "GET") {
    const concl = {};
    for (const porTreino of Object.values(progresso)) for (const [id, x] of Object.entries(porTreino)) {
      concl[id] = concl[id] || { iniciados: 0, concluidos: 0 };
      concl[id].iniciados++;
      if (x.concluido) concl[id].concluidos++;
    }
    const duvidas = Object.values(buscas).sort((a, b) => b.sem_resultado - a.sem_resultado || b.vezes - a.vezes).slice(0, 200)
      .map((b) => ({ q: b.q, vezes: b.vezes, sem_resultado: b.sem_resultado, ultima: b.ultima, pessoas: b.usuarios.length }));
    return json(res, 200, { progresso: concl, buscas: duvidas });
  }

  return json(res, 404, { error: "Rota não encontrada." });
}

// ================================================================ start
export async function start({ port = PORT, host = HOST } = {}) {
  await loadAll();
  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      if (!res.headersSent) json(res, status, { error: status === 500 ? "Erro interno." : err.message });
      else res.end();
    });
  });
  server.requestTimeout = 0; // envio de vídeos grandes
  server.on("close", descarregar);
  await new Promise((resolve) => server.listen(port, host, resolve));
  console.log(`[treinamentos] ouvindo em http://${host}:${server.address().port}${DEV_USUARIO ? ` (DEV: ${DEV_USUARIO})` : ""}`);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch((e) => { console.error(e); process.exit(1); });
  for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { descarregar(); process.exit(0); });
}
