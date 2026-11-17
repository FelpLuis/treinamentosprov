// Treinamentos UPDOWN — telas: início, setor, busca, treinamento e gestão.
(function () {
  const { api, esc, icone, chevrons, toast, data, relativo, num, guardar, ler, copiar } = window.T;
  const S = { me: null, setores: [], treinos: [], categorias: [], carregado: 0 };
  const view = document.getElementById("view");
  const $ = (s, r = document) => r.querySelector(s);

  const NIVEL = { basico: "Básico", intermediario: "Intermediário", avancado: "Avançado" };
  const setor = (id) => S.setores.find((s) => s.id === id) || { id, nome: id, cor: "#0B0FEE" };
  const corDe = (t) => (t.setores?.length ? setor(t.setores[0]).cor : "#0B0FEE");
  const meusSetores = () => S.setores.filter((s) => S.me.setores.includes(s.id));

  async function carregarTreinos(forcar) {
    if (!forcar && Date.now() - S.carregado < 30_000) return;
    const d = await api("/api/treinamentos");
    S.treinos = d.treinamentos; S.categorias = d.categorias; S.carregado = Date.now();
  }
  window.App = { invalidar: () => (S.carregado = 0), S };

  // ------------------------------------------------------------ casca
  function montarCasca() {
    const u = S.me;
    const iniciais = (u.nome || u.username).split(/[\s.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    document.body.insertAdjacentHTML("afterbegin", `
      <a class="pular" href="#view">Pular para o conteúdo</a>
      <header class="topo" id="topo">
        <div class="topo-in">
          <a class="marca" href="#/" aria-label="Treinamentos UPDOWN, início">
            <img src="/assets/brand/updown-logo.png" alt="UPDOWN" width="118" height="36"><span class="marca-sub">Treinamentos</span></a>
          <nav class="nav" aria-label="Principal">
            <a href="#/" data-nav="inicio">Início</a>
            <a href="#/setores" data-nav="setores">Setores</a>
            ${u.editor ? `<a href="#/gerenciar" data-nav="gerenciar">Gerenciar</a>` : ""}
          </nav>
          <form class="busca-topo" id="buscaTopo" role="search">
            ${icone("busca")}<input type="search" name="q" placeholder="Buscar dúvida ou palavra-chave" aria-label="Buscar treinamentos" autocomplete="off"><kbd>/</kbd>
          </form>
          <button type="button" class="btn-ico topo-btn" data-tema></button>
          <div class="usuario">
            <button type="button" class="avatar" id="btnUsuario" aria-haspopup="menu" aria-expanded="false" title="${esc(u.nome)}">${esc(iniciais)}</button>
            <div class="menu" id="menuUsuario" role="menu" hidden>
              <div class="menu-cab"><strong>${esc(u.nome)}</strong><small>${esc(u.username)}</small>
                <span class="menu-setores">${meusSetores().map((s) => `<span class="tag" style="--c:${esc(s.cor)}">${esc(s.nome)}</span>`).join("") || '<small class="mudo">Sem setor no portal</small>'}</span></div>
              <a role="menuitem" href="${esc(S.portal)}/" >${icone("portal")}Portal UPDOWN</a>
              <a role="menuitem" href="/sair">${icone("sair")}Sair</a>
            </div>
          </div>
        </div>
      </header>
      <nav class="nav-movel" aria-label="Navegação">
        <a href="#/" data-nav="inicio">${icone("casa")}<span>Início</span></a>
        <a href="#/setores" data-nav="setores">${icone("grade")}<span>Setores</span></a>
        <a href="#/busca" data-nav="busca">${icone("busca")}<span>Buscar</span></a>
        ${u.editor ? `<a href="#/gerenciar" data-nav="gerenciar">${icone("editar")}<span>Gerenciar</span></a>` : ""}
      </nav>`);
    T.aplicarTema(document.documentElement.getAttribute("data-theme"));
    const bu = $("#btnUsuario"), mu = $("#menuUsuario");
    bu.addEventListener("click", (e) => { e.stopPropagation(); mu.hidden = !mu.hidden; bu.setAttribute("aria-expanded", String(!mu.hidden)); });
    document.addEventListener("click", (e) => { if (!e.target.closest(".usuario")) { mu.hidden = true; bu.setAttribute("aria-expanded", "false"); } });
    $("#buscaTopo").addEventListener("submit", (e) => { e.preventDefault(); const q = e.target.q.value.trim(); if (q) location.hash = `#/busca?q=${encodeURIComponent(q)}`; });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
        e.preventDefault();
        ($("#buscaHero") || $("#buscaPagina") || $("#buscaTopo input")).focus();
      }
    });
  }

  // ------------------------------------------------------------ peças
  function capa(t, grande) {
    if (t.capa) return `<div class="capa capa-img"><img src="${esc(t.capa)}" alt="" loading="lazy"></div>`;
    return `<div class="capa capa-gerada${grande ? " capa-g" : ""}" style="--c:${esc(corDe(t))}">${chevrons()}<span class="capa-ico">${icone(t.icone || "camadas", 1.6)}</span></div>`;
  }
  const tagsSetor = (ids) => (ids?.length ? ids : ["*"]).map((id) => id === "*" ? `<span class="tag tag-todos">Todos os setores</span>` : `<span class="tag" style="--c:${esc(setor(id).cor)}">${esc(setor(id).nome)}</span>`).join("");

  function estadoProgresso(t) {
    if (!t.progresso) return "";
    if (t.progresso.concluido) return `<span class="estado ok">${icone("check", 2.4)}Concluído</span>`;
    return `<span class="estado andamento">Etapa ${t.progresso.etapa + 1} de ${t.etapas}</span>`;
  }
  function midias(t) {
    const m = [];
    if (t.midias?.video) m.push(`<span title="Tem vídeo">${icone("video")}</span>`);
    if (t.midias?.animacao) m.push(`<span title="Tem animação">${icone("animacao")}</span>`);
    if (t.midias?.interativo) m.push(`<span title="Interativo">${icone("interativo")}</span>`);
    return m.length ? `<span class="midias">${m.join("")}</span>` : "";
  }

  function linha(t, extra = "") {
    return `<a class="linha" href="#/t/${esc(t.id)}${extra}" style="--c:${esc(corDe(t))}">
      <span class="linha-ico">${icone(t.icone || "camadas", 1.7)}</span>
      <span class="linha-corpo">
        <span class="linha-titulo">${esc(t.titulo)}${t.publicado ? "" : ' <span class="tag tag-rascunho">Rascunho</span>'}</span>
        <span class="linha-resumo">${esc(t.resumo || "")}</span>
        <span class="linha-meta">${t.etapas} ${t.etapas === 1 ? "etapa" : "etapas"}${t.duracao ? ` · ${t.duracao} min` : ""} · ${NIVEL[t.nivel] || ""}${midias(t)}</span>
      </span>
      <span class="linha-fim">${estadoProgresso(t)}</span>
    </a>`;
  }

  function vazio(ico, titulo, texto, acao = "") {
    return `<div class="vazio-box">${icone(ico, 1.5)}<h3>${titulo}</h3><p>${texto}</p>${acao}</div>`;
  }

  // ------------------------------------------------------------ busca instantânea (sugestões)
  function ligarBuscaInstantanea(input, caixa, setorId = "") {
    let timer, seq = 0, sel = -1;
    const fechar = () => { caixa.hidden = true; sel = -1; input.setAttribute("aria-expanded", "false"); };
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", caixa.id);
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) return fechar();
      timer = setTimeout(async () => {
        const meu = ++seq;
        const d = await api(`/api/busca?q=${encodeURIComponent(q)}${setorId ? `&setor=${setorId}` : ""}`).catch(() => null);
        if (!d || meu !== seq) return;
        sel = -1;
        caixa.innerHTML = d.resultados.length
          ? d.resultados.slice(0, 6).map((r, i) => `<a role="option" id="${caixa.id}-${i}" href="#/t/${esc(r.id)}?etapa=${r.etapa}&q=${encodeURIComponent(q)}" class="sug" style="--c:${esc(corDe(r))}">
              <span class="sug-ico">${icone(r.icone || "camadas")}</span><span><strong>${esc(r.titulo)}</strong><small>${r.etapas > 1 ? `${esc(r.etapa_titulo)} · ` : ""}${esc(r.trecho.slice(0, 110))}</small></span></a>`).join("") +
            `<a class="sug sug-todos" href="#/busca?q=${encodeURIComponent(q)}">${icone("busca")}Ver todos os resultados para “${esc(q)}”</a>`
          : `<div class="sug sug-nada">Nada encontrado para “${esc(q)}”. Tente outras palavras ou <a href="#/busca?q=${encodeURIComponent(q)}">veja a busca completa</a>.</div>`;
        caixa.hidden = false;
        input.setAttribute("aria-expanded", "true");
      }, 140);
    });
    input.addEventListener("keydown", (e) => {
      const itens = [...caixa.querySelectorAll("a.sug")];
      if (caixa.hidden || !itens.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length;
        itens.forEach((x, i) => x.classList.toggle("sel", i === sel));
        input.setAttribute("aria-activedescendant", itens[sel].id || "");
      } else if (e.key === "Enter" && sel >= 0) { e.preventDefault(); location.hash = itens[sel].getAttribute("href"); }
      else if (e.key === "Escape") fechar();
    });
    input.addEventListener("blur", () => setTimeout(fechar, 180));
  }

  // ------------------------------------------------------------ INÍCIO
  async function telaInicio() {
    await carregarTreinos();
    const visiveis = S.treinos.filter((t) => t.publicado);
    const andamento = visiveis.filter((t) => t.progresso && !t.progresso.concluido).sort((a, b) => (b.progresso.em || "").localeCompare(a.progresso.em || "")).slice(0, 4);
    const destaques = visiveis.filter((t) => t.destaque).slice(0, 3);
    const recentes = [...visiveis].sort((a, b) => (b.atualizado_em || "").localeCompare(a.atualizado_em || "")).slice(0, 6);
    const meus = meusSetores();
    const contagem = (id) => visiveis.filter((t) => !t.setores.length || t.setores.includes(id)).length;
    const outros = S.setores.filter((s) => !meus.includes(s) && (S.me.editor || contagem(s.id)));
    const sugestoes = ["cliente sem internet", "sinal crítico", "abrir O.S.", "mudar vencimento", "trocar senha do Wi-Fi", "comandos Huawei"];
    const primeiroNome = (S.me.nome || "").split(" ")[0];

    view.innerHTML = `
      <section class="hero">
        <div class="hero-fundo" aria-hidden="true">${chevrons("hero-chev")}</div>
        <div class="hero-in">
          <p class="hero-ola">Olá, ${esc(primeiroNome)}.</p>
          <h1>Qual é a sua dúvida?</h1>
          <p class="hero-sub">Pesquise nos ${num(visiveis.length)} treinamentos, manuais e passo a passo da UPDOWN. Escreva do jeito que você falaria.</p>
          <form class="busca-hero" id="formHero" role="search">
            ${icone("busca", 2)}<input id="buscaHero" type="search" name="q" placeholder="Ex.: cliente com luz vermelha piscando" autocomplete="off" aria-label="Sua dúvida">
            <button class="btn btn-primario" type="submit">Buscar</button>
            <div class="sugestoes" id="sugHero" role="listbox" hidden></div>
          </form>
          <div class="hero-tente"><span>Mais buscadas:</span>${sugestoes.map((s) => `<a href="#/busca?q=${encodeURIComponent(s)}">${esc(s)}</a>`).join("")}</div>
        </div>
      </section>
      <div class="pagina">
        ${andamento.length ? `<section class="sec">
          <div class="sec-cab"><h2>Continuar de onde parei</h2></div>
          <div class="continuar">${andamento.map((t) => `<a class="cont" href="#/t/${esc(t.id)}?etapa=${t.progresso.etapa}" style="--c:${esc(corDe(t))}">
            <span class="cont-titulo">${esc(t.titulo)}</span>
            <span class="cont-barra"><i style="width:${Math.round(((t.progresso.etapa + 1) / t.etapas) * 100)}%"></i></span>
            <span class="cont-meta">Etapa ${t.progresso.etapa + 1} de ${t.etapas} · ${relativo(t.progresso.em)}</span></a>`).join("")}</div></section>` : ""}

        <section class="sec">
          <div class="sec-cab"><h2>${meus.length ? (meus.length > 1 ? "Seus setores" : "Seu setor") : "Setores"}</h2><a href="#/setores" class="sec-link">Todos os setores</a></div>
          ${meus.length ? `<div class="meus-setores">${meus.map((s) => setorMeu(s, visiveis)).join("")}</div>`
            : `<div class="setores">${S.setores.map((s) => tileSetor(s, contagem(s.id), true)).join("")}</div>`}
          ${meus.length && outros.length ? `<div class="setores setores-p">${outros.map((s) => tileSetor(s, contagem(s.id))).join("")}</div>` : ""}
        </section>

        ${destaques.length ? `<section class="sec">
          <div class="sec-cab"><h2>Em destaque</h2></div>
          <div class="destaques">${destaques.map((t) => `<a class="destaque" href="#/t/${esc(t.id)}">${capa(t, true)}
            <span class="dest-corpo"><span class="dest-setores">${tagsSetor(t.setores)}</span><strong>${esc(t.titulo)}</strong><span>${esc(t.resumo)}</span>
            <span class="linha-meta">${t.etapas} ${t.etapas === 1 ? "etapa" : "etapas"}${t.duracao ? ` · ${t.duracao} min` : ""}${midias(t)}</span></span></a>`).join("")}</div></section>` : ""}

        <section class="sec">
          <div class="sec-cab"><h2>Atualizados recentemente</h2></div>
          <div class="lista">${recentes.map((t) => linha(t)).join("")}</div>
        </section>
      </div>`;
    ligarBuscaInstantanea($("#buscaHero"), $("#sugHero"));
    $("#formHero").addEventListener("submit", (e) => { e.preventDefault(); const q = e.target.q.value.trim(); if (q) location.hash = `#/busca?q=${encodeURIComponent(q)}`; });
    if (matchMedia("(min-width: 800px)").matches) $("#buscaHero").focus({ preventScroll: true });
  }

  function setorMeu(s, visiveis) {
    const ts = visiveis.filter((t) => t.setores.includes(s.id));
    const top = [...ts].sort((a, b) => (b.destaque - a.destaque) || (b.visualizacoes - a.visualizacoes) || a.titulo.localeCompare(b.titulo)).slice(0, 5);
    const feitos = ts.filter((t) => t.progresso?.concluido).length;
    return `<div class="setor-meu" style="--c:${esc(s.cor)}">
      <a class="setor-meu-info" href="#/setor/${esc(s.id)}"><span class="setor-nome">${esc(s.nome)}</span>
        ${s.descricao ? `<span class="setor-desc">${esc(s.descricao)}</span>` : ""}
        <span class="setor-meu-num"><b>${num(ts.length)}</b> treinamentos do setor</span>
        <span class="cont-barra"><i style="width:${ts.length ? Math.round((feitos / ts.length) * 100) : 0}%"></i></span>
        <span class="cont-meta">${feitos} concluído${feitos === 1 ? "" : "s"} por você</span>
        <span class="sec-link">Ver todos ${icone("seta_d", 2)}</span></a>
      <div class="setor-meu-lista">${top.map((t) => `<a href="#/t/${esc(t.id)}"><span class="linha-ico">${icone(t.icone || "camadas", 1.7)}</span><span>${esc(t.titulo)}</span>${t.progresso?.concluido ? icone("check", 2.4) : ""}</a>`).join("")}</div></div>`;
  }

  function tileSetor(s, n, grande) {
    return `<a class="setor${grande ? " setor-g" : ""}" href="#/setor/${esc(s.id)}" style="--c:${esc(s.cor)}">
      <span class="setor-nome">${esc(s.nome)}</span>
      ${grande && s.descricao ? `<span class="setor-desc">${esc(s.descricao)}</span>` : ""}
      <span class="setor-n">${num(n)} ${n === 1 ? "treinamento" : "treinamentos"}</span></a>`;
  }

  // ------------------------------------------------------------ SETORES
  async function telaSetores() {
    await carregarTreinos();
    const vis = S.treinos.filter((t) => t.publicado || S.me.editor);
    const contagem = (id) => vis.filter((t) => !t.setores.length || t.setores.includes(id)).length;
    const gerais = vis.filter((t) => !t.setores.length);
    view.innerHTML = `<div class="pagina">
      <div class="cab-pagina"><h1>Setores</h1><p>Cada setor reúne os treinamentos do dia a dia da equipe. Os conteúdos marcados para todos aparecem em todos os setores.</p></div>
      <div class="setores">${S.setores.map((s) => tileSetor(s, contagem(s.id), true)).join("")}</div>
      ${gerais.length ? `<section class="sec"><div class="sec-cab"><h2>Para todos os setores</h2></div><div class="lista">${gerais.map((t) => linha(t)).join("")}</div></section>` : ""}
    </div>`;
  }

  // ------------------------------------------------------------ SETOR
  async function telaSetor(id) {
    await carregarTreinos();
    const s = setor(id);
    let lista = S.treinos.filter((t) => (t.publicado || S.me.editor) && (!t.setores.length || t.setores.includes(id)));
    const cats = [...new Set(lista.map((t) => t.categoria || "Outros"))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    let filtro = "";
    view.innerHTML = `
      <section class="faixa-setor" style="--c:${esc(s.cor)}"><div class="pagina">
        <a class="voltar" href="#/setores">${icone("seta_e", 2)}Setores</a>
        <h1>${esc(s.nome)}</h1>${s.descricao ? `<p>${esc(s.descricao)}</p>` : ""}
        <form class="busca-setor" id="formSetor" role="search">${icone("busca")}<input id="buscaSetor" type="search" placeholder="Buscar em ${esc(s.nome)}" autocomplete="off"><div class="sugestoes" id="sugSetor" role="listbox" hidden></div></form>
      </div></section>
      <div class="pagina">
        <div class="filtros" role="group" aria-label="Filtrar por assunto"><button type="button" class="chip on" data-cat="">Tudo <b>${lista.length}</b></button>
          ${cats.map((c) => `<button type="button" class="chip" data-cat="${esc(c)}">${esc(c)} <b>${lista.filter((t) => (t.categoria || "Outros") === c).length}</b></button>`).join("")}</div>
        <div id="grupos"></div>
      </div>`;
    const desenhar = () => {
      const porCat = cats.filter((c) => !filtro || c === filtro).map((c) => [c, lista.filter((t) => (t.categoria || "Outros") === c)]);
      $("#grupos").innerHTML = lista.length ? porCat.map(([c, ts]) => `<section class="grupo"><h2 class="grupo-titulo">${esc(c)}</h2><div class="lista">${ts.map((t) => linha(t)).join("")}</div></section>`).join("")
        : vazio("camadas", "Nenhum treinamento neste setor ainda", S.me.editor ? "Crie o primeiro treinamento para este setor." : "Assim que um treinamento for publicado para este setor, ele aparece aqui.",
          S.me.editor ? `<a class="btn btn-primario" href="#/novo?setor=${esc(id)}">${icone("mais", 2)}Novo treinamento</a>` : "");
    };
    desenhar();
    view.querySelector(".filtros").addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      filtro = b.dataset.cat;
      view.querySelectorAll(".filtros .chip").forEach((x) => x.classList.toggle("on", x === b));
      desenhar();
    });
    ligarBuscaInstantanea($("#buscaSetor"), $("#sugSetor"), id);
    $("#formSetor").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#buscaSetor").value.trim(); if (q) location.hash = `#/busca?q=${encodeURIComponent(q)}&setor=${id}`; });
  }

  // ------------------------------------------------------------ BUSCA
  function marcar(texto, termos) {
    let h = esc(texto);
    const norm = (x) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const plano = norm(texto);
    const faixas = [];
    for (const t of termos) {
      if (t.length < 2) continue;
      const re = new RegExp(`\\b${t.replace(/[^a-z0-9]/g, "")}[a-z0-9]*`, "g");
      let m; while ((m = re.exec(plano))) faixas.push([m.index, m.index + m[0].length]);
    }
    if (!faixas.length) return h;
    faixas.sort((a, b) => a[0] - b[0]);
    let out = "", pos = 0;
    for (const [a, b] of faixas) { if (a < pos) continue; out += esc(texto.slice(pos, a)) + `<mark>${esc(texto.slice(a, b))}</mark>`; pos = b; }
    return out + esc(texto.slice(pos));
  }

  async function telaBusca(params) {
    const q = params.get("q") || "";
    const setorId = params.get("setor") || "";
    view.innerHTML = `<div class="pagina pagina-busca">
      <form class="busca-pagina" id="formBusca" role="search">${icone("busca", 2)}<input id="buscaPagina" type="search" name="q" value="${esc(q)}" placeholder="Qual é a sua dúvida?" autocomplete="off" aria-label="Buscar"><button class="btn btn-primario">Buscar</button></form>
      <div class="filtros" id="filtroSetor" role="group" aria-label="Filtrar por setor">
        <button type="button" class="chip ${setorId ? "" : "on"}" data-s="">Todos os setores</button>
        ${S.setores.map((s) => `<button type="button" class="chip ${setorId === s.id ? "on" : ""}" data-s="${esc(s.id)}" style="--c:${esc(s.cor)}">${esc(s.nome)}</button>`).join("")}</div>
      <div id="resultados" aria-live="polite"><div class="carregando">Procurando…</div></div></div>`;
    $("#formBusca").addEventListener("submit", (e) => { e.preventDefault(); const v = e.target.q.value.trim(); location.hash = `#/busca?q=${encodeURIComponent(v)}${setorId ? `&setor=${setorId}` : ""}`; });
    $("#filtroSetor").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) location.hash = `#/busca?q=${encodeURIComponent(q)}${b.dataset.s ? `&setor=${b.dataset.s}` : ""}`; });
    if (!q) { $("#resultados").innerHTML = vazio("busca", "Escreva sua dúvida", "Por exemplo: “cliente sem internet”, “como abrir O.S.” ou “planos com Paramount”."); $("#buscaPagina").focus(); return; }
    const d = await api(`/api/busca?q=${encodeURIComponent(q)}&registrar=1${setorId ? `&setor=${setorId}` : ""}`);
    const r = d.resultados;
    $("#resultados").innerHTML = r.length ? `
      <p class="contagem">${r.length} ${r.length === 1 ? "treinamento responde" : "treinamentos respondem"} a “${esc(q)}”${setorId ? ` em ${esc(setor(setorId).nome)}` : ""}</p>
      <ol class="resultados">${r.map((x, i) => `<li><a class="res" href="#/t/${esc(x.id)}?etapa=${x.etapa}&q=${encodeURIComponent(q)}" style="--c:${esc(corDe(x))}">
        <span class="res-cab"><span class="linha-ico">${icone(x.icone || "camadas")}</span><span><strong class="res-titulo">${marcar(x.titulo, d.termos)}</strong>
          ${x.etapas > 1 ? `<span class="res-etapa">Responde na etapa ${x.etapa + 1}: ${marcar(x.etapa_titulo, d.termos)}</span>` : ""}</span>${i === 0 ? '<span class="tag tag-melhor">Melhor resposta</span>' : ""}</span>
        <span class="res-trecho">${marcar(x.trecho, d.termos)}</span>
        <span class="res-pe">${tagsSetor(x.setores)}${x.categoria ? `<span class="mudo">${esc(x.categoria)}</span>` : ""}${estadoProgresso(x)}</span></a></li>`).join("")}</ol>`
      : vazio("pergunta", "Ainda não temos um treinamento para isso", `Nenhum conteúdo responde a “${esc(q)}”${setorId ? ` em ${esc(setor(setorId).nome)}` : ""}. Tente com outras palavras${setorId ? " ou busque em todos os setores" : ""}. Sua busca fica registrada para os editores criarem esse conteúdo.`,
        setorId ? `<a class="btn btn-claro" href="#/busca?q=${encodeURIComponent(q)}">Buscar em todos os setores</a>` : (S.me.editor ? `<a class="btn btn-primario" href="#/novo?titulo=${encodeURIComponent(q)}">${icone("mais", 2)}Criar treinamento sobre isso</a>` : ""));
  }

  // ------------------------------------------------------------ TREINAMENTO
  async function telaTreino(id, params) {
    const { treinamento: t, progresso } = await api(`/api/treinamentos/${encodeURIComponent(id)}`);
    S.carregado = 0;
    let etapa = Math.max(0, Math.min(t.etapas.length - 1, Number(params.get("etapa") ?? progresso?.etapa ?? 0) || 0));
    const vistas = new Set(progresso?.vistas || []);
    let concluido = !!progresso?.concluido;
    const q = params.get("q") || "";
    const cor = t.setores.length ? setor(t.setores[0]).cor : "#0B0FEE";
    const varias = t.etapas.length > 1;

    view.innerHTML = `
      <div class="leitura" style="--c:${esc(cor)}">
        <div class="barra-progresso" aria-hidden="true"><i id="barraProg"></i></div>
        <header class="treino-cab"><div class="pagina">
          <nav class="migalhas" aria-label="Caminho">${t.setores.length ? `<a href="#/setor/${esc(t.setores[0])}">${esc(setor(t.setores[0]).nome)}</a><span>/</span>` : `<a href="#/setores">Todos os setores</a><span>/</span>`}<span>${esc(t.categoria || "Treinamento")}</span></nav>
          <div class="treino-titulo"><span class="treino-ico">${icone(t.icone || "camadas", 1.6)}</span><div>
            <h1>${esc(t.titulo)}</h1>${t.resumo ? `<p class="treino-resumo">${esc(t.resumo)}</p>` : ""}</div></div>
          <div class="treino-meta">${tagsSetor(t.setores)}
            <span>${icone("camadas")}${t.etapas.length} ${t.etapas.length === 1 ? "etapa" : "etapas"}</span>
            ${t.duracao ? `<span>${icone("relogio")}${t.duracao} min</span>` : ""}
            <span>${NIVEL[t.nivel] || ""}</span>
            <span class="mudo">Atualizado ${relativo(t.atualizado_em)}${t.atualizado_por ? ` por ${esc(t.atualizado_por)}` : ""}</span>
            ${t.publicado ? "" : '<span class="tag tag-rascunho">Rascunho: só editores veem</span>'}
            <span class="treino-acoes">
              <button type="button" class="btn btn-claro btn-p" id="copiarLink">${icone("link")}Copiar link</button>
              ${S.me.editor ? `<a class="btn btn-claro btn-p" href="#/editar/${esc(t.id)}">${icone("editar")}Editar</a>` : ""}
            </span>
          </div>
        </div></header>
        <div class="pagina leitura-corpo${varias ? "" : " sem-trilho"}">
          ${varias ? `<aside class="trilho" aria-label="Etapas">
            <button type="button" class="trilho-abrir" id="trilhoAbrir" aria-expanded="false">${icone("camadas")}<span id="trilhoAtual"></span>${icone("seta_b", 2)}</button>
            <ol class="etapas" id="listaEtapas">${t.etapas.map((e, i) => `<li><a href="#/t/${esc(t.id)}?etapa=${i}" data-etapa="${i}"><span class="et-n">${i + 1}</span><span class="et-t">${esc(e.titulo)}</span></a></li>`).join("")}</ol>
            <div class="trilho-prog"><span id="progTexto"></span></div>
          </aside>` : ""}
          <article class="conteudo" id="conteudo" tabindex="-1"></article>
        </div>
      </div>`;

    $("#copiarLink").addEventListener("click", async () => { if (await copiar(`${location.origin}/#/t/${t.id}${varias ? `?etapa=${etapa}` : ""}`)) toast("Link copiado."); });
    if (varias) {
      const abrir = $("#trilhoAbrir");
      abrir.addEventListener("click", () => { const v = abrir.getAttribute("aria-expanded") !== "true"; abrir.setAttribute("aria-expanded", String(v)); $(".trilho").classList.toggle("aberto", v); });
      $("#listaEtapas").addEventListener("click", (e) => {
        const a = e.target.closest("a[data-etapa]"); if (!a) return;
        e.preventDefault(); ir(Number(a.dataset.etapa));
        abrir.setAttribute("aria-expanded", "false"); $(".trilho").classList.remove("aberto");
      });
    }

    function salvarProgresso(extra = {}) {
      api(`/api/progresso/${encodeURIComponent(t.id)}`, { method: "POST", body: { etapa, ...extra } }).catch(() => {});
    }

    function ir(n, rolar = true) {
      etapa = n;
      vistas.add(n);
      history.replaceState(null, "", `#/t/${t.id}${varias ? `?etapa=${n}` : ""}${q ? `${varias ? "&" : "?"}q=${encodeURIComponent(q)}` : ""}`);
      const e = t.etapas[n];
      const ultima = n === t.etapas.length - 1;
      $("#conteudo").innerHTML = `
        ${q ? `<div class="vindo-busca">${icone("busca")}Você buscou “${esc(q)}”. <a href="#/busca?q=${encodeURIComponent(q)}">Voltar aos resultados</a></div>` : ""}
        ${varias ? `<p class="etapa-n">Etapa ${n + 1} de ${t.etapas.length}</p>` : ""}
        <h2 class="etapa-titulo">${esc(e.titulo)}</h2>
        <div class="blocos">${Blocos.renderEtapa(e, { chave: t.id })}</div>
        <nav class="etapa-nav" aria-label="Navegação entre etapas">
          ${n > 0 ? `<button type="button" class="btn btn-claro" data-ir="${n - 1}">${icone("seta_e", 2)}<span><small>Anterior</small>${esc(t.etapas[n - 1].titulo)}</span></button>` : "<span></span>"}
          ${!ultima ? `<button type="button" class="btn btn-primario btn-prox" data-ir="${n + 1}"><span><small>Próxima etapa</small>${esc(t.etapas[n + 1].titulo)}</span>${icone("seta_d", 2)}</button>`
            : `<button type="button" class="btn ${concluido ? "btn-claro" : "btn-primario"} btn-concluir" id="concluir">${icone("check", 2.4)}${concluido ? "Concluído · marcar como não concluído" : "Concluí este treinamento"}</button>`}
        </nav>`;
      Blocos.ativar($("#conteudo"));
      $("#conteudo").querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => ir(Number(b.dataset.ir))));
      $("#concluir")?.addEventListener("click", () => {
        concluido = !concluido;
        salvarProgresso({ concluido });
        toast(concluido ? "Treinamento concluído. Bom trabalho!" : "Marcado como não concluído.");
        ir(etapa, false);
      });
      if (varias) {
        view.querySelectorAll("#listaEtapas a").forEach((a, i) => {
          a.classList.toggle("atual", i === n);
          a.classList.toggle("vista", vistas.has(i) && i !== n);
          if (i === n) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current");
        });
        $("#trilhoAtual").textContent = `Etapa ${n + 1} de ${t.etapas.length}: ${e.titulo}`;
        $("#progTexto").textContent = concluido ? "Treinamento concluído" : `${vistas.size} de ${t.etapas.length} etapas vistas`;
      }
      $("#barraProg").style.width = `${concluido ? 100 : Math.round((vistas.size / t.etapas.length) * 100)}%`;
      salvarProgresso();
      if (rolar) {
        const topo = $(".leitura-corpo").getBoundingClientRect().top + scrollY - 80;
        if (scrollY > topo) scrollTo({ top: topo, behavior: T.reduzMovimento() ? "auto" : "smooth" });
        $("#conteudo").focus({ preventScroll: true });
      }
    }
    ir(etapa, false);
    document.title = `${t.titulo} · Treinamentos UPDOWN`;
  }

  // ------------------------------------------------------------ GERENCIAR
  async function telaGerenciar(params) {
    if (!S.me.editor) return (location.hash = "#/");
    await carregarTreinos(true);
    const aba = params.get("aba") || "treinamentos";
    const g = await api("/api/gestao");
    const semResp = g.buscas.filter((b) => b.sem_resultado > 0);
    view.innerHTML = `<div class="pagina">
      <div class="cab-pagina cab-acoes"><div><h1>Gerenciar treinamentos</h1><p>Crie e edite conteúdos, veja quem está estudando e as dúvidas que ainda não têm resposta.</p></div>
        <a class="btn btn-primario" href="#/novo">${icone("mais", 2)}Novo treinamento</a></div>
      <div class="abas" role="tablist">
        <a role="tab" href="#/gerenciar" class="${aba === "treinamentos" ? "on" : ""}" aria-selected="${aba === "treinamentos"}">Treinamentos <b>${S.treinos.length}</b></a>
        <a role="tab" href="#/gerenciar?aba=duvidas" class="${aba === "duvidas" ? "on" : ""}" aria-selected="${aba === "duvidas"}">Dúvidas sem resposta <b>${semResp.length}</b></a>
        <a role="tab" href="#/gerenciar?aba=buscas" class="${aba === "buscas" ? "on" : ""}" aria-selected="${aba === "buscas"}">Mais buscadas</a>
      </div>
      <div id="abaConteudo"></div></div>`;
    const box = $("#abaConteudo");
    if (aba === "treinamentos") {
      box.innerHTML = `<div class="ferramentas"><label class="campo-busca">${icone("busca")}<input id="filtroG" type="search" placeholder="Filtrar por título, setor ou assunto"></label>
        <select id="filtroSetorG" aria-label="Setor"><option value="">Todos os setores</option>${S.setores.map((s) => `<option value="${esc(s.id)}">${esc(s.nome)}</option>`).join("")}</select></div>
        <div class="tabela-caixa"><table class="tabela"><thead><tr><th>Treinamento</th><th>Setores</th><th>Situação</th><th class="n">Etapas</th><th class="n">Visitas</th><th class="n">Concluíram</th><th>Atualizado</th><th class="n">Ações</th></tr></thead><tbody id="linhasG"></tbody></table></div>`;
      const desenhar = () => {
        const f = $("#filtroG").value.trim().toLowerCase(), sf = $("#filtroSetorG").value;
        const ls = S.treinos.filter((t) => (!f || `${t.titulo} ${t.categoria} ${t.setores.map((x) => setor(x).nome).join(" ")}`.toLowerCase().includes(f)) && (!sf || t.setores.includes(sf) || !t.setores.length));
        $("#linhasG").innerHTML = ls.map((t) => `<tr>
          <td><a class="tab-titulo" href="#/t/${esc(t.id)}">${esc(t.titulo)}</a><small>${esc(t.categoria || "")}</small></td>
          <td>${tagsSetor(t.setores)}</td>
          <td>${t.publicado ? '<span class="estado ok">Publicado</span>' : '<span class="tag tag-rascunho">Rascunho</span>'}${t.destaque ? ' <span class="tag">Destaque</span>' : ""}</td>
          <td class="n">${t.etapas}</td><td class="n">${num(t.visualizacoes)}</td>
          <td class="n">${num(g.progresso[t.id]?.concluidos)} <small class="mudo">/ ${num(g.progresso[t.id]?.iniciados)}</small></td>
          <td class="mudo">${data(t.atualizado_em)}</td>
          <td class="n"><span class="acoes"><a class="btn-ico" href="#/editar/${esc(t.id)}" title="Editar" aria-label="Editar ${esc(t.titulo)}">${icone("editar")}</a>
            <button type="button" class="btn-ico" data-dup="${esc(t.id)}" title="Duplicar" aria-label="Duplicar">${icone("duplicar")}</button>
            <button type="button" class="btn-ico perigo" data-del="${esc(t.id)}" title="Excluir" aria-label="Excluir">${icone("lixo")}</button></span></td></tr>`).join("") || `<tr><td colspan="8" class="mudo centro">Nada encontrado.</td></tr>`;
      };
      desenhar();
      $("#filtroG").addEventListener("input", desenhar);
      $("#filtroSetorG").addEventListener("change", desenhar);
      $("#linhasG").addEventListener("click", async (e) => {
        const del = e.target.closest("[data-del]"), dup = e.target.closest("[data-dup]");
        if (del) {
          const t = S.treinos.find((x) => x.id === del.dataset.del);
          if (!(await confirmar("Excluir treinamento?", `“${t.titulo}” sai da plataforma para todos os setores. Isso não pode ser desfeito.`, "Excluir"))) return;
          try { await api(`/api/treinamentos/${encodeURIComponent(t.id)}`, { method: "DELETE" }); toast("Treinamento excluído."); await carregarTreinos(true); desenhar(); }
          catch (ex) { toast(ex.message, "erro"); }
        }
        if (dup) {
          try {
            const { treinamento } = await api(`/api/treinamentos/${encodeURIComponent(dup.dataset.dup)}?editar=1`);
            const { treinamento: novo } = await api("/api/treinamentos", { method: "POST", body: { ...treinamento, titulo: `${treinamento.titulo} (cópia)`, publicado: false, destaque: false } });
            toast("Cópia criada como rascunho."); location.hash = `#/editar/${novo.id}`;
          } catch (ex) { toast(ex.message, "erro"); }
        }
      });
    } else {
      const lista = aba === "duvidas" ? semResp : [...g.buscas].sort((a, b) => b.vezes - a.vezes);
      box.innerHTML = lista.length ? `<p class="mudo">${aba === "duvidas" ? "Buscas que terminaram sem nenhum resultado. Cada uma é um treinamento que está faltando." : "O que as equipes mais procuram."}</p>
        <div class="tabela-caixa"><table class="tabela"><thead><tr><th>Busca</th><th class="n">Vezes</th><th class="n">Sem resultado</th><th class="n">Pessoas</th><th>Última</th><th class="n"></th></tr></thead><tbody>
        ${lista.map((b) => `<tr><td><strong>${esc(b.q)}</strong></td><td class="n">${num(b.vezes)}</td><td class="n">${num(b.sem_resultado)}</td><td class="n">${num(b.pessoas)}</td><td class="mudo">${relativo(b.ultima)}</td>
          <td class="n"><span class="acoes"><a class="btn-mini" href="#/busca?q=${encodeURIComponent(b.q)}">Testar busca</a>${aba === "duvidas" ? `<a class="btn-mini" href="#/novo?titulo=${encodeURIComponent(b.q)}">${icone("mais")}Criar</a>` : ""}</span></td></tr>`).join("")}
        </tbody></table></div>`
        : vazio("check_c", aba === "duvidas" ? "Nenhuma dúvida sem resposta" : "Ainda não há buscas registradas", aba === "duvidas" ? "Todas as buscas feitas até agora encontraram algum treinamento." : "As buscas feitas pelas equipes aparecem aqui.");
    }
  }

  function confirmar(titulo, texto, ok = "Confirmar") {
    return new Promise((resolve) => {
      const d = document.createElement("div");
      d.className = "modal-fundo";
      d.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mt"><h3 id="mt">${esc(titulo)}</h3><p>${esc(texto)}</p>
        <div class="modal-acoes"><button type="button" class="btn btn-claro" data-r="0">Cancelar</button><button type="button" class="btn btn-perigo" data-r="1">${esc(ok)}</button></div></div>`;
      const fim = (v) => { d.remove(); document.removeEventListener("keydown", esc_); resolve(v); };
      const esc_ = (e) => e.key === "Escape" && fim(false);
      d.addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) fim(b.dataset.r === "1"); else if (e.target === d) fim(false); });
      document.addEventListener("keydown", esc_);
      document.body.appendChild(d);
      d.querySelector("[data-r='0']").focus();
    });
  }
  window.App.confirmar = confirmar;

  // ------------------------------------------------------------ roteador
  async function rotear() {
    if (window.Editor?.saindo && !(await window.Editor.saindo())) return;
    const [caminho, qs] = location.hash.replace(/^#/, "").split("?");
    const params = new URLSearchParams(qs || "");
    const partes = (caminho || "/").split("/").filter(Boolean);
    document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on",
      (a.dataset.nav === "inicio" && !partes.length) || (a.dataset.nav === "setores" && /^setor/.test(partes[0] || "")) || (a.dataset.nav === "gerenciar" && /^(gerenciar|editar|novo)$/.test(partes[0] || "")) || (a.dataset.nav === "busca" && partes[0] === "busca")));
    document.body.classList.toggle("em-inicio", !partes.length);
    document.title = "Treinamentos UPDOWN";
    const buscaTopo = $("#buscaTopo input");
    if (buscaTopo && partes[0] !== "busca") buscaTopo.value = "";
    view.classList.add("trocando");
    try {
      if (!partes.length) await telaInicio();
      else if (partes[0] === "setores") await telaSetores();
      else if (partes[0] === "setor" && partes[1]) await telaSetor(partes[1]);
      else if (partes[0] === "busca") { await telaBusca(params); if (buscaTopo) buscaTopo.value = params.get("q") || ""; }
      else if (partes[0] === "t" && partes[1]) await telaTreino(partes[1], params);
      else if (partes[0] === "gerenciar") await telaGerenciar(params);
      else if ((partes[0] === "editar" && partes[1]) || partes[0] === "novo") {
        if (!S.me.editor) { location.hash = "#/"; return; }
        await window.Editor.abrir(view, partes[0] === "novo" ? null : partes[1], params, S);
      } else location.hash = "#/";
    } catch (ex) {
      view.innerHTML = `<div class="pagina">${vazio("aviso", "Não foi possível abrir esta página", esc(ex.message), `<a class="btn btn-primario" href="#/">Ir para o início</a>`)}</div>`;
    } finally {
      view.classList.remove("trocando");
    }
    if (!/^t$/.test(partes[0] || "")) scrollTo(0, 0);
  }

  async function iniciar() {
    try {
      const d = await api("/api/me");
      S.me = d.user; S.setores = d.setores || []; S.portal = d.portal;
    } catch (ex) {
      view.innerHTML = `<div class="pagina">${vazio("aviso", "Não foi possível entrar", esc(ex.message), `<a class="btn btn-primario" href="/">Tentar de novo</a>`)}</div>`;
      return;
    }
    montarCasca();
    addEventListener("hashchange", rotear);
    rotear();
  }
  iniciar();
})();
