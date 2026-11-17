import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Portal falso: cada cookie é um usuário diferente
const USUARIOS = {
  ana: { user: { username: "ana.n1", name: "Ana N1", role: "atendimento", setores: ["atendimento"], admin: false }, sistemas: ["treinamentos"] },
  edu: { user: { username: "edu.editor", name: "Edu Editor", role: "analista", setores: ["noc"], admin: false }, sistemas: ["treinamentos", "treinamentos-editor"] },
  sem: null,
};
const SETORES = [
  { id: "atendimento", nome: "Atendimento", cor: "#0BBBEF" },
  { id: "noc", nome: "NOC", cor: "#0B0FEE" },
  { id: "comercial", nome: "Comercial", cor: "#9B00FF" },
];
const portal = http.createServer((req, res) => {
  const m = /updown_sso=(\w+)/.exec(req.headers.cookie || "");
  if (!m) { res.writeHead(401); return res.end("{}"); }
  const u = USUARIOS[m[1]];
  if (!u) { res.writeHead(403); return res.end("{}"); }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ...u, setores: SETORES }));
});
await new Promise((r) => portal.listen(0, "127.0.0.1", r));

const dir = mkdtempSync(path.join(tmpdir(), "treinamentos-"));
process.env.DATA_DIR = dir;
process.env.PORTAL_INTERNO = `http://127.0.0.1:${portal.address().port}`;
process.env.PORTAL_URL = "https://portal.updown.com.br";
process.env.PUBLIC_URL = "https://treinamentos.updown.com.br";
delete process.env.DEV_USUARIO;
const { start, sanitizar } = await import("../server.mjs");
let server, base;
before(async () => { server = await start({ port: 0, host: "127.0.0.1" }); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise((r) => server.close(r)); portal.close(); rmSync(dir, { recursive: true, force: true }); });

const como = (quem, extra = {}) => ({ headers: { Cookie: `updown_sso=${quem}`, ...extra } });
const H = (quem) => ({ Cookie: `updown_sso=${quem}`, "X-Treinamentos": "1", "Content-Type": "application/json" });

test("sem sessão vai para o login do portal; sem acesso mostra aviso", async () => {
  let r = await fetch(`${base}/`, { redirect: "manual" });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /sso\/entrar\?sistema=treinamentos/);
  r = await fetch(`${base}/midia/x.png`, { redirect: "manual" });
  assert.equal(r.status, 302);
  assert.match(r.headers.get("location"), /^https:\/\/portal\.updown\.com\.br\/sso\/entrar\?sistema=treinamentos&volta=https%3A%2F%2Ftreinamentos\.updown\.com\.br%2Fmidia/);
  r = await fetch(`${base}/api/me`);
  assert.equal(r.status, 401);
  r = await fetch(`${base}/`, como("sem"));
  assert.equal(r.status, 403);
  assert.match(await r.text(), /Sem acesso/);
});

test("usuário vê só os treinamentos do seu setor e os de todos", async () => {
  const me = await (await fetch(`${base}/api/me`, como("ana"))).json();
  assert.equal(me.user.editor, false);
  assert.deepEqual(me.user.setores, ["atendimento"]);
  const { treinamentos } = await (await fetch(`${base}/api/treinamentos`, como("ana"))).json();
  assert.ok(treinamentos.length > 10);
  assert.ok(treinamentos.every((t) => !t.setores.length || t.setores.includes("atendimento")));
  assert.ok(!treinamentos.some((t) => t.id === "comandos-ne8000"));
  assert.equal((await fetch(`${base}/api/treinamentos/comandos-ne8000`, como("ana"))).status, 404);
  assert.equal((await fetch(`${base}/api/treinamentos/processo-de-atendimento`, como("ana"))).status, 200);
  // não edita
  const r = await fetch(`${base}/api/treinamentos`, { method: "POST", headers: H("ana"), body: JSON.stringify({ titulo: "x", etapas: [{ blocos: [] }] }) });
  assert.equal(r.status, 403);
});

test("busca entende a dúvida do jeito que se fala", async () => {
  const b = async (q, quem = "ana") => (await (await fetch(`${base}/api/busca?q=${encodeURIComponent(q)}`, como(quem))).json()).resultados;
  assert.equal((await b("cliente sem internet"))[0].id, "primeiro-diagnostico-sem-conexao");
  assert.equal((await b("como mudar o vencimento"))[0].id, "vencimento-suspensao-cobrancas");
  assert.equal((await b("abrir O.S."))[0].id, "atendimento-n1-no-ixc");
  assert.equal((await b("trocar senha do wifi"))[0].id, "configuracao-zte-f670l");
  assert.equal((await b("dying gasp"))[0].id, "smart-olt-sinal-e-logs");
  assert.equal((await b("display access-user", "edu"))[0].id, "comandos-ne8000");
  // a busca respeita o setor: comandos do NE8000 não aparecem para o atendimento
  assert.ok(!(await b("display access-user")).some((r) => r.id === "comandos-ne8000"));
  assert.equal((await b("xyzqwk")).length, 0);
});

test("todo o conteúdo inicial passa na validação do editor", async () => {
  const { treinamentos } = await (await fetch(`${base}/api/treinamentos`, como("edu"))).json();
  for (const r of treinamentos) {
    const { treinamento: t } = await (await fetch(`${base}/api/treinamentos/${r.id}?editar=1`, como("edu"))).json();
    const res = await fetch(`${base}/api/treinamentos/${t.id}`, { method: "PUT", headers: H("edu"), body: JSON.stringify(t) });
    const d = await res.json();
    assert.equal(res.status, 200, `${t.id}: ${d.error}`);
    assert.equal(d.treinamento.etapas.length, t.etapas.length);
    assert.equal(d.treinamento.etapas.flatMap((e) => e.blocos).length, t.etapas.flatMap((e) => e.blocos).length, t.id);
  }
});

test("editor cria treinamento com imagem, vídeo e animação; HTML perigoso é limpo", async () => {
  // envio de mídia
  let r = await fetch(`${base}/api/midia`, { method: "POST", headers: { ...H("edu"), "Content-Type": "image/png", "X-Nome": "tela teste.png" }, body: Buffer.from("89504e470d0a1a0a", "hex") });
  assert.equal(r.status, 201);
  const { url } = await r.json();
  assert.match(url, /^\/midia\/tela-teste-[a-f0-9]{10}\.png$/);
  r = await fetch(`${base}/api/midia`, { method: "POST", headers: { ...H("edu"), "X-Nome": "virus.exe" }, body: "x" });
  assert.equal(r.status, 415);
  // leitura parcial (vídeos)
  r = await fetch(`${base}${url}`, como("ana", { Range: "bytes=0-3" }));
  assert.equal(r.status, 206);
  assert.equal((await r.arrayBuffer()).byteLength, 4);

  const corpo = {
    titulo: "Teste de criação", resumo: "r", setores: ["comercial"], tags: ["Teste"], publicado: true,
    etapas: [{ titulo: "E1", blocos: [
      { tipo: "texto", html: '<p onclick="x()">Oi <script>alert(1)</script><a href="javascript:alert(1)">link</a> <strong>ok</strong></p>' },
      { tipo: "imagem", src: url, marcadores: [{ x: 10, y: 20, texto: "aqui" }] },
      { tipo: "video", src: "https://www.youtube.com/watch?v=CdfM_1Env3o" },
      { tipo: "animacao", modo: "sequencia", quadros: [{ src: url, titulo: "1" }, { src: url, titulo: "2" }] },
      { tipo: "dialogo", falas: [{ quem: "cliente", texto: "oi" }] },
    ] }],
  };
  r = await fetch(`${base}/api/treinamentos`, { method: "POST", headers: H("edu"), body: JSON.stringify(corpo) });
  assert.equal(r.status, 201);
  const { treinamento: t } = await r.json();
  const html = t.etapas[0].blocos[0].html;
  assert.ok(!/script|onclick|javascript/i.test(html), html);
  assert.match(html, /<strong>ok<\/strong>/);
  assert.equal(t.etapas[0].blocos[3].quadros.length, 2);
  // mídia de fora do servidor é recusada
  r = await fetch(`${base}/api/treinamentos/${t.id}`, { method: "PUT", headers: H("edu"), body: JSON.stringify({ ...t, etapas: [{ titulo: "x", blocos: [{ tipo: "imagem", src: "https://evil.example/x.png" }] }] }) });
  assert.equal(r.status, 400);
  // ana (atendimento) não vê o treinamento do comercial; rascunho some para quem não edita
  assert.equal((await fetch(`${base}/api/treinamentos/${t.id}`, como("ana"))).status, 404);
  // exclusão
  assert.equal((await fetch(`${base}/api/treinamentos/${t.id}`, { method: "DELETE", headers: H("edu") })).status, 200);
});

test("progresso e dúvidas sem resposta", async () => {
  let r = await fetch(`${base}/api/progresso/primeiro-diagnostico-sem-conexao`, { method: "POST", headers: H("ana"), body: JSON.stringify({ etapa: 2 }) });
  assert.equal(r.status, 200);
  r = await fetch(`${base}/api/progresso/primeiro-diagnostico-sem-conexao`, { method: "POST", headers: H("ana"), body: JSON.stringify({ etapa: 3, concluido: true }) });
  assert.equal((await r.json()).progresso.concluido, true);
  const lista = (await (await fetch(`${base}/api/treinamentos`, como("ana"))).json()).treinamentos;
  assert.equal(lista.find((t) => t.id === "primeiro-diagnostico-sem-conexao").progresso.concluido, true);
  await fetch(`${base}/api/busca?q=${encodeURIComponent("qwzk plim fax")}&registrar=1`, como("ana"));
  const g = await (await fetch(`${base}/api/gestao`, como("edu"))).json();
  assert.ok(g.buscas.some((b) => b.q === "qwzk plim fax" && b.sem_resultado === 1));
  assert.equal(g.progresso["primeiro-diagnostico-sem-conexao"].concluidos, 1);
  assert.equal((await fetch(`${base}/api/gestao`, como("ana"))).status, 403);
});

test("sanitizador mantém só a formatação permitida", () => {
  assert.equal(sanitizar('<p style="x">a<img src=x onerror=alert(1)>b</p>'), "<p>a b</p>".replace(" ", ""));
  assert.equal(sanitizar("1 < 2 > 0"), "1 &lt; 2 &gt; 0");
  assert.match(sanitizar('<a href="https://x.com">x</a>'), /target="_blank" rel="noopener noreferrer"/);
  assert.equal(sanitizar('<a href="#/t/abc?etapa=1">x</a>'), '<a href="#/t/abc?etapa=1">x</a>');
});
