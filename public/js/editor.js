// Editor de treinamentos: informações, etapas e blocos (texto, imagem, vídeo, animação…).
(function () {
  const { api, enviarArquivo, esc, icone, toast, guardar, ler } = window.T;
  const $ = (s, r = document) => r.querySelector(s);

  const TIPOS = [
    { tipo: "texto", nome: "Texto", desc: "Parágrafos, listas, títulos e tabelas" },
    { tipo: "imagem", nome: "Imagem", desc: "Print de tela com pontos explicativos" },
    { tipo: "video", nome: "Vídeo", desc: "Envie um vídeo ou cole o link do YouTube" },
    { tipo: "animacao", nome: "Animação", desc: "GIF, vídeo em loop ou sequência de telas" },
    { tipo: "passos", nome: "Passo a passo", desc: "Lista numerada de ações" },
    { tipo: "checklist", nome: "Checklist", desc: "Itens para conferir antes de seguir" },
    { tipo: "dialogo", nome: "Diálogo / script", desc: "Falas do atendente e do cliente" },
    { tipo: "aviso", nome: "Aviso", desc: "Informação, dica, atenção ou confirmação" },
    { tipo: "codigo", nome: "Comando / código", desc: "Bloco para copiar, como comandos de CLI" },
    { tipo: "arquivo", nome: "Anexo", desc: "PDF, apresentação ou planilha" },
    { tipo: "links", nome: "Links", desc: "Lista de links úteis" },
    { tipo: "interativo", nome: "Interativo (HTML)", desc: "Página HTML com animações e cliques" },
    { tipo: "divisor", nome: "Divisor", desc: "Linha para separar assuntos" },
  ];
  const NOME_TIPO = Object.fromEntries(TIPOS.map((t) => [t.tipo, t.nome]));
  const ICONES_CAPA = ["headset", "ixc", "chat", "sinal", "roteador", "tv", "jogo", "terminal", "mapa", "cadeado", "telefone", "alvo", "plano", "empresa", "dinheiro", "contrato", "planilha", "olt", "fibra", "pasta", "quadro", "ajuda", "check2", "camadas"];

  const novoId = (p = "b") => p + Math.random().toString(36).slice(2, 10);
  function blocoNovo(tipo) {
    const b = { id: novoId(), tipo };
    switch (tipo) {
      case "texto": b.html = ""; break;
      case "aviso": Object.assign(b, { estilo: "info", titulo: "", html: "" }); break;
      case "imagem": Object.assign(b, { src: "", legenda: "", alt: "", w: 0, h: 0, largura: "normal", marcadores: [] }); break;
      case "video": Object.assign(b, { src: "", titulo: "", legenda: "", capa: "" }); break;
      case "animacao": Object.assign(b, { modo: "sequencia", titulo: "", src: "", intervalo: 4, transicao: "deslizar", quadros: [{ src: "", titulo: "", texto: "" }] }); break;
      case "passos": b.itens = [""]; break;
      case "checklist": Object.assign(b, { titulo: "", itens: [""] }); break;
      case "dialogo": b.falas = [{ quem: "cliente", texto: "" }, { quem: "atendente", texto: "" }]; break;
      case "codigo": Object.assign(b, { rotulo: "", texto: "" }); break;
      case "arquivo": Object.assign(b, { src: "", nome: "", descricao: "" }); break;
      case "links": b.itens = [{ titulo: "", url: "", descricao: "" }]; break;
      case "interativo": Object.assign(b, { src: "", titulo: "", altura: 820, texto: "" }); break;
    }
    return b;
  }

  let estado = null; // { t, sujo, S, etapaAberta }

  // ------------------------------------------------------------ envio de arquivos
  function seletorArquivo(aceita) {
    return new Promise((resolve) => {
      const i = document.createElement("input");
      i.type = "file"; i.accept = aceita;
      i.onchange = () => resolve(i.files[0] || null);
      i.click();
    });
  }
  async function subir(file, alvo) {
    const barra = document.createElement("div");
    barra.className = "envio";
    barra.innerHTML = `<span>${esc(file.name)}</span><i><b></b></i>`;
    (alvo || document.body).appendChild(barra);
    try {
      const r = await enviarArquivo(file, (p) => (barra.querySelector("b").style.width = `${Math.round(p * 100)}%`));
      return r;
    } catch (ex) { toast(ex.message, "erro"); return null; }
    finally { barra.remove(); }
  }
  function dimensoes(url) {
    return new Promise((resolve) => { const im = new Image(); im.onload = () => resolve([im.naturalWidth, im.naturalHeight]); im.onerror = () => resolve([0, 0]); im.src = url; });
  }
  async function textoDeHtml(file) {
    try {
      const html = await file.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("script,style,noscript").forEach((x) => x.remove());
      return (doc.body?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60000);
    } catch { return ""; }
  }

  // ------------------------------------------------------------ editor de texto rico simples
  function rico(html, aoMudar, { compacto = false } = {}) {
    const id = novoId("r");
    return {
      html: `<div class="rico${compacto ? " rico-c" : ""}">
        <div class="rico-barra" role="toolbar" aria-label="Formatação" data-rico="${id}">
          <button type="button" data-cmd="bold" title="Negrito (Ctrl+B)" aria-label="Negrito"><b>N</b></button>
          <button type="button" data-cmd="italic" title="Itálico (Ctrl+I)" aria-label="Itálico"><i>I</i></button>
          <button type="button" data-cmd="underline" title="Sublinhado" aria-label="Sublinhado"><u>S</u></button>
          ${compacto ? "" : `<button type="button" data-cmd="h3" title="Título" aria-label="Título">T</button>`}
          <button type="button" data-cmd="insertUnorderedList" title="Lista" aria-label="Lista">•</button>
          <button type="button" data-cmd="insertOrderedList" title="Lista numerada" aria-label="Lista numerada">1.</button>
          <button type="button" data-cmd="link" title="Link" aria-label="Link">${icone("link")}</button>
          <button type="button" data-cmd="code" title="Código" aria-label="Código">${icone("codigo")}</button>
          <button type="button" data-cmd="removeFormat" title="Limpar formatação" aria-label="Limpar formatação">${icone("x")}</button>
        </div>
        <div class="rico-area prosa" contenteditable="true" data-rico-area="${id}" role="textbox" aria-multiline="true">${html || ""}</div></div>`,
      ligar(raiz) {
        const area = raiz.querySelector(`[data-rico-area="${id}"]`);
        const barra = raiz.querySelector(`[data-rico="${id}"]`);
        area.addEventListener("input", () => aoMudar(area.innerHTML));
        barra.addEventListener("mousedown", (e) => e.preventDefault());
        barra.addEventListener("click", (e) => {
          const b = e.target.closest("[data-cmd]"); if (!b) return;
          area.focus();
          const c = b.dataset.cmd;
          if (c === "h3") document.execCommand("formatBlock", false, document.queryCommandValue("formatBlock") === "h3" ? "p" : "h3");
          else if (c === "link") { const u = prompt("Endereço do link (https://… ou #/t/id-do-treinamento):"); if (u) document.execCommand("createLink", false, u); }
          else if (c === "code") { const s = getSelection(); if (s.rangeCount && !s.isCollapsed) document.execCommand("insertHTML", false, `<code>${esc(s.toString())}</code>`); }
          else document.execCommand(c, false, null);
          aoMudar(area.innerHTML);
        });
        // colar: mantém só o texto com quebras (o servidor limpa o restante)
        area.addEventListener("paste", (e) => {
          const arq = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
          if (arq) { e.preventDefault(); area.dispatchEvent(new CustomEvent("colar-imagem", { bubbles: true, detail: arq })); return; }
          const html = e.clipboardData?.getData("text/html");
          if (!html) return;
          e.preventDefault();
          const doc = new DOMParser().parseFromString(html, "text/html");
          doc.querySelectorAll("script,style,meta,link,img,svg,iframe").forEach((x) => x.remove());
          doc.body.querySelectorAll("*").forEach((el) => { [...el.attributes].forEach((a) => { if (!(el.tagName === "A" && a.name === "href")) el.removeAttribute(a.name); }); });
          document.execCommand("insertHTML", false, doc.body.innerHTML);
        });
      },
    };
  }

  // ------------------------------------------------------------ formulário de cada bloco
  function formBloco(b, ei, bi) {
    const ligadores = [];
    const mudou = () => marcarSujo();
    const campo = (rotulo, inner, cls = "") => `<label class="campo ${cls}"><span>${rotulo}</span>${inner}</label>`;
    const inp = (k, ph = "", max = 300) => `<input data-k="${k}" value="${esc(b[k] ?? "")}" placeholder="${esc(ph)}" maxlength="${max}">`;
    let corpo = "";
    switch (b.tipo) {
      case "texto": {
        const r = rico(b.html, (h) => { b.html = h; mudou(); });
        ligadores.push(r.ligar); corpo = r.html; break;
      }
      case "aviso": {
        const r = rico(b.html, (h) => { b.html = h; mudou(); }, { compacto: true });
        ligadores.push(r.ligar);
        corpo = `<div class="grade-2">${campo("Tipo", `<select data-k="estilo">${Object.entries(Blocos.AVISO).map(([k, v]) => `<option value="${k}" ${b.estilo === k ? "selected" : ""}>${v.nome}</option>`).join("")}</select>`)}
          ${campo("Título (opcional)", inp("titulo", "Ex.: Antes de agendar", 120))}</div>${r.html}`;
        break;
      }
      case "imagem":
        corpo = `<div class="editor-imagem">${b.src ? `
            <div class="ed-img-caixa" data-marcar title="Clique na imagem para adicionar um ponto explicativo">
              <img src="${esc(b.src)}" alt="">${(b.marcadores || []).map((m, i) => `<span class="marcador fixo" style="left:${m.x}%;top:${m.y}%"><span class="marcador-n">${i + 1}</span></span>`).join("")}</div>
            <p class="dica">${icone("info")}Clique na imagem para marcar um ponto. Quem estiver estudando vê o ponto pulsando com a sua explicação.</p>
            <div class="marcadores-ed">${(b.marcadores || []).map((m, i) => `<div class="linha-ed"><span class="marcador-n est">${i + 1}</span>
              <input data-marc="${i}" value="${esc(m.texto)}" placeholder="O que este ponto mostra?" maxlength="200">
              <button type="button" class="btn-ico perigo" data-rm-marc="${i}" aria-label="Remover ponto">${icone("x")}</button></div>`).join("")}</div>
            <div class="grade-2">${campo("Texto alternativo", inp("alt", "Descreva a imagem para leitores de tela", 200))}
              ${campo("Largura", `<select data-k="largura"><option value="normal" ${b.largura === "normal" ? "selected" : ""}>Normal</option><option value="larga" ${b.largura === "larga" ? "selected" : ""}>Larga</option><option value="pequena" ${b.largura === "pequena" ? "selected" : ""}>Pequena</option></select>`)}</div>
            ${campo("Legenda", inp("legenda", "Opcional", 600))}
            <button type="button" class="btn btn-claro btn-p" data-subir="imagem">${icone("upload")}Trocar imagem</button>`
          : `<button type="button" class="soltar" data-subir="imagem">${icone("imagem", 1.5)}<strong>Enviar imagem</strong><span>Clique, arraste ou cole (Ctrl+V) um print de tela. PNG, JPG, GIF ou WebP.</span></button>`}</div>`;
        break;
      case "video":
        corpo = `<div class="grade-2">${campo("Link do YouTube/Vimeo ou arquivo enviado", inp("src", "https://www.youtube.com/watch?v=…", 1000))}
          <div class="campo"><span>Ou envie do computador</span><button type="button" class="btn btn-claro" data-subir="video">${icone("upload")}Enviar vídeo (MP4, WebM)</button></div></div>
          <div class="grade-2">${campo("Título", inp("titulo", "Ex.: Como medir o sinal", 160))}${campo("Legenda", inp("legenda", "Opcional", 300))}</div>`;
        break;
      case "animacao":
        corpo = `<div class="seg" role="radiogroup" aria-label="Tipo de animação">
            <label><input type="radio" name="modo-${b.id}" value="sequencia" ${b.modo !== "arquivo" ? "checked" : ""}> Sequência de telas</label>
            <label><input type="radio" name="modo-${b.id}" value="arquivo" ${b.modo === "arquivo" ? "checked" : ""}> Arquivo (GIF, vídeo em loop ou HTML)</label></div>
          ${campo("Título", inp("titulo", "Ex.: Diagnóstico em 4 passos", 160))}
          ${b.modo === "arquivo" ? `<div class="campo"><span>Arquivo</span><div class="linha-ed">${b.src ? `<code class="arq">${esc(b.src.split("/").pop())}</code>` : '<span class="mudo">Nenhum arquivo</span>'}
              <button type="button" class="btn btn-claro btn-p" data-subir="animacao">${icone("upload")}${b.src ? "Trocar" : "Enviar"} GIF / MP4 / WebM / HTML</button></div>
              <small class="mudo">Vídeos tocam sem som e em repetição. HTML (por exemplo, uma animação exportada) roda isolado.</small></div>`
          : `<div class="grade-2">${campo("Tempo por tela", `<select data-k="intervalo" data-num>${[2, 3, 4, 5, 6, 8, 10, 15].map((n) => `<option value="${n}" ${Number(b.intervalo) === n ? "selected" : ""}>${n} segundos</option>`).join("")}</select>`)}
              ${campo("Transição", `<select data-k="transicao"><option value="deslizar" ${b.transicao === "deslizar" ? "selected" : ""}>Deslizar</option><option value="esmaecer" ${b.transicao === "esmaecer" ? "selected" : ""}>Esmaecer</option><option value="zoom" ${b.transicao === "zoom" ? "selected" : ""}>Aproximar</option></select>`)}</div>
            <div class="quadros">${(b.quadros || []).map((q, i) => `<div class="quadro-ed">
              <button type="button" class="quadro-img" data-subir-quadro="${i}" title="${q.src ? "Trocar imagem" : "Enviar imagem"}">${q.src ? `<img src="${esc(q.src)}" alt="">` : `${icone("imagem", 1.5)}<span>Imagem</span>`}</button>
              <div class="quadro-txt"><input data-q="${i}" data-qk="titulo" value="${esc(q.titulo)}" placeholder="Título da tela ${i + 1}" maxlength="120">
                <textarea data-q="${i}" data-qk="texto" rows="2" placeholder="Explicação curta" maxlength="500">${esc(q.texto)}</textarea></div>
              <div class="quadro-acoes"><button type="button" class="btn-ico" data-mv-q="${i}" data-d="-1" aria-label="Subir" ${i === 0 ? "disabled" : ""}>${icone("seta_c")}</button>
                <button type="button" class="btn-ico" data-mv-q="${i}" data-d="1" aria-label="Descer" ${i === b.quadros.length - 1 ? "disabled" : ""}>${icone("seta_b")}</button>
                <button type="button" class="btn-ico perigo" data-rm-q="${i}" aria-label="Remover tela">${icone("lixo")}</button></div></div>`).join("")}</div>
            <button type="button" class="btn btn-claro btn-p" data-add-q>${icone("mais")}Adicionar tela</button>`}`;
        break;
      case "passos":
      case "checklist":
        corpo = `${b.tipo === "checklist" ? campo("Título", inp("titulo", "Ex.: Antes de abrir visita, confirme", 160)) : ""}
          <div class="itens-ed">${b.itens.map((x, i) => `<div class="linha-ed"><span class="marcador-n est">${b.tipo === "passos" ? i + 1 : "✓"}</span>
            <textarea data-item="${i}" rows="1" placeholder="${b.tipo === "passos" ? "Descreva a ação" : "Item para conferir"}">${esc(x)}</textarea>
            <button type="button" class="btn-ico" data-mv-item="${i}" data-d="-1" aria-label="Subir" ${i === 0 ? "disabled" : ""}>${icone("seta_c")}</button>
            <button type="button" class="btn-ico perigo" data-rm-item="${i}" aria-label="Remover">${icone("x")}</button></div>`).join("")}</div>
          <button type="button" class="btn btn-claro btn-p" data-add-item>${icone("mais")}Adicionar ${b.tipo === "passos" ? "passo" : "item"}</button>`;
        break;
      case "dialogo":
        corpo = `<div class="itens-ed">${b.falas.map((f, i) => `<div class="linha-ed fala-ed">
            <select data-fala="${i}" data-fk="quem" aria-label="Quem fala"><option value="atendente" ${f.quem === "atendente" ? "selected" : ""}>Atendente</option><option value="cliente" ${f.quem === "cliente" ? "selected" : ""}>Cliente</option><option value="tecnico" ${f.quem === "tecnico" ? "selected" : ""}>Técnico</option></select>
            <textarea data-fala="${i}" data-fk="texto" rows="2" placeholder="Fala">${esc(f.texto)}</textarea>
            <button type="button" class="btn-ico" data-mv-fala="${i}" data-d="-1" aria-label="Subir" ${i === 0 ? "disabled" : ""}>${icone("seta_c")}</button>
            <button type="button" class="btn-ico perigo" data-rm-fala="${i}" aria-label="Remover fala">${icone("x")}</button></div>`).join("")}</div>
          <button type="button" class="btn btn-claro btn-p" data-add-fala>${icone("mais")}Adicionar fala</button>`;
        break;
      case "codigo":
        corpo = `${campo("Rótulo (opcional)", inp("rotulo", "Ex.: Verificar versão do switch", 120))}
          <label class="campo"><span>Conteúdo</span><textarea data-k="texto" class="mono" rows="6" spellcheck="false">${esc(b.texto)}</textarea></label>`;
        break;
      case "arquivo":
        corpo = `<div class="linha-ed">${b.src ? `<code class="arq">${esc(b.src.split("/").pop())}</code>` : '<span class="mudo">Nenhum arquivo enviado</span>'}
            <button type="button" class="btn btn-claro btn-p" data-subir="arquivo">${icone("upload")}${b.src ? "Trocar" : "Enviar"} arquivo</button></div>
          <div class="grade-2">${campo("Nome", inp("nome", "Ex.: Script de atendimento N1", 200))}${campo("Descrição", inp("descricao", "Opcional", 300))}</div>`;
        break;
      case "links":
        corpo = `<div class="itens-ed">${b.itens.map((l, i) => `<div class="linha-ed link-ed">
            <input data-link="${i}" data-lk="titulo" value="${esc(l.titulo)}" placeholder="Título" maxlength="200">
            <input data-link="${i}" data-lk="url" value="${esc(l.url)}" placeholder="https://…" maxlength="1000">
            <button type="button" class="btn-ico perigo" data-rm-link="${i}" aria-label="Remover link">${icone("x")}</button></div>`).join("")}</div>
          <button type="button" class="btn btn-claro btn-p" data-add-link>${icone("mais")}Adicionar link</button>`;
        break;
      case "interativo":
        corpo = `<div class="linha-ed">${b.src ? `<code class="arq">${esc(b.src.split("/").pop())}</code>` : '<span class="mudo">Nenhum arquivo enviado</span>'}
            <button type="button" class="btn btn-claro btn-p" data-subir="interativo">${icone("upload")}${b.src ? "Trocar" : "Enviar"} arquivo .html</button></div>
          <div class="grade-2">${campo("Título", inp("titulo", "Ex.: Processo de atendimento", 160))}${campo("Altura (px)", `<input data-k="altura" data-num type="number" min="300" max="4000" step="20" value="${Number(b.altura) || 820}">`)}</div>
          <label class="campo"><span>Texto para a busca <small class="mudo">(preenchido sozinho ao enviar; ajuda a achar este conteúdo)</small></span><textarea data-k="texto" rows="3">${esc(b.texto || "")}</textarea></label>`;
        break;
      case "divisor":
        corpo = `<p class="mudo">Uma linha separando os assuntos.</p>`;
        break;
    }
    return {
      html: `<div class="bloco-ed" data-ei="${ei}" data-bi="${bi}" id="ed-${esc(b.id)}">
        <div class="bloco-cab"><span class="bloco-tipo">${icone(b.tipo === "aviso" ? "aviso" : b.tipo)}${esc(NOME_TIPO[b.tipo] || b.tipo)}</span>
          <span class="bloco-acoes">
            <button type="button" class="btn-ico" data-acao="subir" aria-label="Mover bloco para cima" title="Mover para cima">${icone("seta_c")}</button>
            <button type="button" class="btn-ico" data-acao="descer" aria-label="Mover bloco para baixo" title="Mover para baixo">${icone("seta_b")}</button>
            <button type="button" class="btn-ico" data-acao="duplicar" aria-label="Duplicar bloco" title="Duplicar">${icone("duplicar")}</button>
            <button type="button" class="btn-ico perigo" data-acao="remover" aria-label="Remover bloco" title="Remover">${icone("lixo")}</button></span></div>
        <div class="bloco-corpo">${corpo}</div>
        <div class="inserir-entre"><button type="button" class="inserir" data-inserir="${bi + 1}" aria-label="Inserir bloco aqui">${icone("mais", 2)}</button></div></div>`,
      ligadores,
    };
  }

  function marcarSujo() {
    if (!estado) return;
    estado.sujo = true;
    $("#edEstado").textContent = "Alterações não salvas";
    clearTimeout(estado.rascunhoTimer);
    estado.rascunhoTimer = setTimeout(() => guardar(chaveRascunho(), { em: Date.now(), t: estado.t }), 800);
  }
  const chaveRascunho = () => `rascunho:${estado.t.id || "novo"}`;

  // ------------------------------------------------------------ tela
  async function abrir(view, id, params, S) {
    let t;
    if (id) t = (await api(`/api/treinamentos/${encodeURIComponent(id)}?editar=1`)).treinamento;
    else {
      const s = params.get("setor");
      t = { id: "", titulo: params.get("titulo") || "", resumo: "", setores: s ? [s] : [], categoria: "", tags: [], capa: "", icone: "camadas", nivel: "basico", duracao: 5,
        publicado: true, destaque: false, etapas: [{ id: novoId("e"), titulo: "Introdução", blocos: [blocoNovo("texto")] }] };
    }
    estado = { t, sujo: false, S, aberta: 0, hash: location.hash };
    const rasc = ler(`rascunho:${t.id || "novo"}`, null);
    if (rasc && rasc.t && (!t.atualizado_em || rasc.em > new Date(t.atualizado_em).getTime()) && JSON.stringify(rasc.t.etapas) !== JSON.stringify(t.etapas)) {
      if (await App.confirmar("Recuperar alterações?", `Existe uma versão não salva deste treinamento de ${new Date(rasc.em).toLocaleString("pt-BR")}. Quer continuar dela?`, "Recuperar")) {
        estado.t = t = rasc.t; estado.sujo = true;
      } else localStorage.removeItem(`rascunho:${t.id || "novo"}`);
    }
    desenharTudo(view);
  }

  function desenharTudo(view) {
    const { t, S } = estado;
    view.innerHTML = `<div class="editor">
      <div class="ed-barra"><div class="pagina ed-barra-in">
        <a class="voltar" href="${t.id ? `#/t/${esc(t.id)}` : "#/gerenciar"}">${icone("seta_e", 2)}${t.id ? "Ver treinamento" : "Gerenciar"}</a>
        <span class="ed-titulo">${t.id ? "Editando" : "Novo treinamento"}</span>
        <span class="ed-estado mudo" id="edEstado">${estado.sujo ? "Alterações não salvas" : t.id ? "Tudo salvo" : ""}</span>
        <span class="grow"></span>
        <button type="button" class="btn btn-claro" id="edPrevia">${icone("olho")}Pré-visualizar</button>
        <button type="button" class="btn btn-claro" id="edRascunho">${icone("salvar")}Salvar como rascunho</button>
        <button type="button" class="btn btn-primario" id="edPublicar">${icone("check", 2.4)}${t.id && t.publicado ? "Salvar e publicar" : "Publicar"}</button>
      </div></div>
      <div class="pagina ed-grade">
        <section class="ed-info painel">
          <h2>Informações</h2>
          <label class="campo"><span>Título <b class="req">*</b></span><input id="fTitulo" value="${esc(t.titulo)}" maxlength="140" placeholder="Ex.: Cliente sem conexão: primeiro diagnóstico"></label>
          <label class="campo"><span>Resumo</span><textarea id="fResumo" rows="3" maxlength="500" placeholder="Em uma ou duas frases: o que a pessoa vai aprender?">${esc(t.resumo)}</textarea></label>
          <div class="campo"><span>Quem vê</span>
            <label class="chk-linha"><input type="checkbox" id="fTodos" ${t.setores.length ? "" : "checked"}> Todos os setores</label>
            <div class="setores-ed" id="fSetores">${S.setores.map((s) => `<label class="chk-linha"><input type="checkbox" value="${esc(s.id)}" ${t.setores.includes(s.id) ? "checked" : ""}><span class="ponto" style="background:${esc(s.cor)}"></span>${esc(s.nome)}</label>`).join("")}</div></div>
          <div class="grade-2">
            <label class="campo"><span>Assunto</span><input id="fCategoria" list="listaCategorias" value="${esc(t.categoria)}" maxlength="60" placeholder="Ex.: IXC Provedor"><datalist id="listaCategorias">${S.categorias.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
            <label class="campo"><span>Nível</span><select id="fNivel"><option value="basico">Básico</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></label>
          </div>
          <label class="campo"><span>Palavras-chave <small class="mudo">(separe por vírgula; ajudam a busca)</small></span><input id="fTags" value="${esc(t.tags.join(", "))}" placeholder="Ex.: sem internet, luz vermelha, los"></label>
          <div class="grade-2">
            <label class="campo"><span>Duração (min)</span><input id="fDuracao" type="number" min="0" max="600" value="${Number(t.duracao) || 0}"></label>
            <div class="campo"><span>Destaque</span><label class="chk-linha"><input type="checkbox" id="fDestaque" ${t.destaque ? "checked" : ""}> Mostrar no início</label></div>
          </div>
          <div class="campo"><span>Ícone da capa</span><div class="icones-ed" id="fIcone" role="radiogroup">${ICONES_CAPA.map((k) => `<button type="button" role="radio" aria-checked="${t.icone === k}" data-ico="${k}" class="${t.icone === k ? "on" : ""}" aria-label="${k}">${icone(k)}</button>`).join("")}</div></div>
          <div class="campo"><span>Imagem de capa <small class="mudo">(opcional)</small></span>
            <div class="linha-ed">${t.capa ? `<img class="capa-mini" src="${esc(t.capa)}" alt="">` : ""}<button type="button" class="btn btn-claro btn-p" id="fCapa">${icone("upload")}${t.capa ? "Trocar" : "Enviar"} capa</button>${t.capa ? `<button type="button" class="btn-ico perigo" id="fCapaRm" aria-label="Remover capa">${icone("x")}</button>` : ""}</div></div>
        </section>
        <section class="ed-etapas">
          <div class="ed-etapas-cab"><h2>Etapas</h2><button type="button" class="btn btn-claro btn-p" id="addEtapa">${icone("mais")}Nova etapa</button></div>
          <ol class="abas-etapas" id="abasEtapas"></ol>
          <div id="etapaEd"></div>
        </section>
      </div></div>`;
    $("#fNivel").value = t.nivel;
    const sinc = () => {
      t.titulo = $("#fTitulo").value; t.resumo = $("#fResumo").value; t.categoria = $("#fCategoria").value; t.nivel = $("#fNivel").value;
      t.tags = $("#fTags").value.split(",").map((x) => x.trim()).filter(Boolean); t.duracao = Number($("#fDuracao").value) || 0; t.destaque = $("#fDestaque").checked;
      t.setores = $("#fTodos").checked ? [] : [...view.querySelectorAll("#fSetores input:checked")].map((c) => c.value);
      marcarSujo();
    };
    view.querySelector(".ed-info").addEventListener("input", sinc);
    view.querySelector(".ed-info").addEventListener("change", (e) => {
      if (e.target.id === "fTodos" && e.target.checked) view.querySelectorAll("#fSetores input").forEach((c) => (c.checked = false));
      if (e.target.closest("#fSetores")) $("#fTodos").checked = !view.querySelector("#fSetores input:checked");
      sinc();
    });
    $("#fIcone").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ico]"); if (!b) return;
      t.icone = b.dataset.ico;
      view.querySelectorAll("#fIcone button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", String(x === b)); });
      marcarSujo();
    });
    $("#fCapa").addEventListener("click", async () => {
      const f = await seletorArquivo("image/*"); if (!f) return;
      const r = await subir(f, view.querySelector(".ed-info")); if (!r) return;
      t.capa = r.url; marcarSujo(); desenharTudo(view);
    });
    $("#fCapaRm")?.addEventListener("click", () => { t.capa = ""; marcarSujo(); desenharTudo(view); });
    $("#addEtapa").addEventListener("click", () => { t.etapas.push({ id: novoId("e"), titulo: `Etapa ${t.etapas.length + 1}`, blocos: [blocoNovo("texto")] }); estado.aberta = t.etapas.length - 1; marcarSujo(); desenharEtapas(); });
    $("#edPrevia").addEventListener("click", previa);
    $("#edRascunho").addEventListener("click", () => salvar(false));
    $("#edPublicar").addEventListener("click", () => salvar(true));
    desenharEtapas();
  }

  function desenharEtapas() {
    const { t } = estado;
    estado.aberta = Math.min(estado.aberta, t.etapas.length - 1);
    $("#abasEtapas").innerHTML = t.etapas.map((e, i) => `<li><button type="button" class="${i === estado.aberta ? "on" : ""}" data-aba="${i}"><span class="et-n">${i + 1}</span>${esc(e.titulo || `Etapa ${i + 1}`)}<small>${e.blocos.length}</small></button></li>`).join("");
    $("#abasEtapas").onclick = (ev) => { const b = ev.target.closest("[data-aba]"); if (b) { estado.aberta = Number(b.dataset.aba); desenharEtapas(); } };
    desenharEtapa();
  }

  function desenharEtapa() {
    const { t } = estado;
    const ei = estado.aberta;
    const e = t.etapas[ei];
    // container novo a cada desenho: os ouvintes de eventos não se acumulam
    const box = document.createElement("div");
    $("#etapaEd").replaceChildren(box);
    const forms = e.blocos.map((b, bi) => formBloco(b, ei, bi));
    box.innerHTML = `<div class="painel etapa-ed">
      <div class="etapa-ed-cab">
        <label class="campo grow"><span>Título da etapa ${ei + 1}</span><input id="fEtapaTitulo" value="${esc(e.titulo)}" maxlength="160"></label>
        <span class="bloco-acoes">
          <button type="button" class="btn-ico" data-et="esq" aria-label="Mover etapa para trás" title="Mover para trás" ${ei === 0 ? "disabled" : ""}>${icone("seta_e")}</button>
          <button type="button" class="btn-ico" data-et="dir" aria-label="Mover etapa para frente" title="Mover para frente" ${ei === t.etapas.length - 1 ? "disabled" : ""}>${icone("seta_d")}</button>
          <button type="button" class="btn-ico perigo" data-et="rm" aria-label="Excluir etapa" title="Excluir etapa" ${t.etapas.length === 1 ? "disabled" : ""}>${icone("lixo")}</button></span>
      </div>
      <div class="inserir-entre topo-ins"><button type="button" class="inserir" data-inserir="0" aria-label="Inserir bloco no início">${icone("mais", 2)}</button></div>
      <div class="blocos-ed" id="blocosEd">${forms.map((f) => f.html).join("")}</div>
      <div class="add-bloco" id="addBloco"><p>Adicionar à etapa</p><div class="tipos">${TIPOS.map((x) => `<button type="button" data-tipo="${x.tipo}">${icone(x.tipo === "aviso" ? "aviso" : x.tipo)}<strong>${x.nome}</strong><small>${x.desc}</small></button>`).join("")}</div></div>
    </div>`;
    forms.forEach((f) => f.ligadores.forEach((l) => l(box)));
    ligarEtapa(box, e, ei);
  }

  function menuInserir(botao, aoEscolher) {
    document.querySelectorAll(".menu-tipos").forEach((m) => m.remove());
    const m = document.createElement("div");
    m.className = "menu-tipos";
    m.innerHTML = TIPOS.map((x) => `<button type="button" data-tipo="${x.tipo}">${icone(x.tipo === "aviso" ? "aviso" : x.tipo)}${x.nome}</button>`).join("");
    botao.parentElement.appendChild(m);
    const fora = (ev) => { if (!m.contains(ev.target) && ev.target !== botao) { m.remove(); document.removeEventListener("click", fora, true); } };
    setTimeout(() => document.addEventListener("click", fora, true));
    m.addEventListener("click", (ev) => { const b = ev.target.closest("[data-tipo]"); if (b) { m.remove(); document.removeEventListener("click", fora, true); aoEscolher(b.dataset.tipo); } });
    m.querySelector("button").focus();
  }

  function ligarEtapa(box, e, ei) {
    const { t } = estado;
    const redesenhar = (focoId) => { marcarSujo(); desenharEtapas(); if (focoId) setTimeout(() => document.getElementById(`ed-${focoId}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 30); };
    const blocoDe = (el) => { const c = el.closest(".bloco-ed"); return c ? e.blocos[Number(c.dataset.bi)] : null; };

    $("#fEtapaTitulo").addEventListener("input", (ev) => { e.titulo = ev.target.value; marcarSujo(); const aba = document.querySelector(`#abasEtapas [data-aba="${ei}"]`); if (aba) aba.childNodes[1].textContent = e.titulo; });
    box.querySelector(".etapa-ed-cab").addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-et]"); if (!b || b.disabled) return;
      if (b.dataset.et === "rm") {
        if (!(await App.confirmar("Excluir etapa?", `A etapa “${e.titulo}” e os ${e.blocos.length} blocos dela serão removidos.`, "Excluir"))) return;
        t.etapas.splice(ei, 1); estado.aberta = Math.max(0, ei - 1);
      } else {
        const d = b.dataset.et === "esq" ? -1 : 1;
        [t.etapas[ei], t.etapas[ei + d]] = [t.etapas[ei + d], t.etapas[ei]]; estado.aberta = ei + d;
      }
      redesenhar();
    });
    $("#addBloco").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-tipo]"); if (!b) return;
      const nb = blocoNovo(b.dataset.tipo); e.blocos.push(nb); redesenhar(nb.id);
    });

    // campos simples
    box.addEventListener("input", (ev) => {
      const el = ev.target, b = blocoDe(el); if (!b) return;
      if (el.dataset.k) b[el.dataset.k] = el.dataset.num !== undefined ? Number(el.value) : el.value;
      else if (el.dataset.marc !== undefined) b.marcadores[Number(el.dataset.marc)].texto = el.value;
      else if (el.dataset.q !== undefined) b.quadros[Number(el.dataset.q)][el.dataset.qk] = el.value;
      else if (el.dataset.item !== undefined) { b.itens[Number(el.dataset.item)] = el.value; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
      else if (el.dataset.fala !== undefined) b.falas[Number(el.dataset.fala)][el.dataset.fk] = el.value;
      else if (el.dataset.link !== undefined) b.itens[Number(el.dataset.link)][el.dataset.lk] = el.value;
      else return;
      marcarSujo();
    });
    box.addEventListener("change", (ev) => {
      const el = ev.target, b = blocoDe(el); if (!b) return;
      if (el.type === "radio" && el.name === `modo-${b.id}`) { b.modo = el.value; redesenhar(b.id); return; }
      if (el.tagName === "SELECT" && el.dataset.k) { b[el.dataset.k] = el.dataset.num !== undefined ? Number(el.value) : el.value; marcarSujo(); }
      if (el.tagName === "SELECT" && el.dataset.fala !== undefined) { b.falas[Number(el.dataset.fala)].quem = el.value; marcarSujo(); }
    });
    // colar imagem dentro de um texto → cria bloco de imagem logo abaixo
    box.addEventListener("colar-imagem", async (ev) => {
      const b = blocoDe(ev.target); if (!b) return;
      const r = await subir(ev.detail, box); if (!r) return;
      const [w, h] = await dimensoes(r.url);
      const nb = { ...blocoNovo("imagem"), src: r.url, w, h };
      e.blocos.splice(e.blocos.indexOf(b) + 1, 0, nb); redesenhar(nb.id);
    });

    box.addEventListener("click", async (ev) => {
      const el = ev.target.closest("button, [data-marcar]");
      if (!el) return;
      const b = blocoDe(el);
      const ins = el.dataset.inserir;
      if (ins !== undefined) { menuInserir(el, (tipo) => { const nb = blocoNovo(tipo); e.blocos.splice(Number(ins), 0, nb); redesenhar(nb.id); }); return; }
      if (!b) return;
      const bi = e.blocos.indexOf(b);
      const ac = el.dataset.acao;
      if (ac === "subir" && bi > 0) { [e.blocos[bi - 1], e.blocos[bi]] = [e.blocos[bi], e.blocos[bi - 1]]; return redesenhar(b.id); }
      if (ac === "descer" && bi < e.blocos.length - 1) { [e.blocos[bi + 1], e.blocos[bi]] = [e.blocos[bi], e.blocos[bi + 1]]; return redesenhar(b.id); }
      if (ac === "duplicar") { const c = JSON.parse(JSON.stringify(b)); c.id = novoId(); e.blocos.splice(bi + 1, 0, c); return redesenhar(c.id); }
      if (ac === "remover") {
        const temConteudo = JSON.stringify(b).replace(/"(id|tipo)":"[^"]*"/g, "").replace(/[{}\[\],":]|estilo|info|normal|largura|sequencia|deslizar|modo|intervalo|transicao|quadros|marcadores|itens|falas|quem|atendente|cliente|texto|titulo|src|legenda|alt|w|h|\d/g, "").trim();
        if (temConteudo && !(await App.confirmar("Remover bloco?", `O bloco de ${NOME_TIPO[b.tipo] || b.tipo} será removido desta etapa.`, "Remover"))) return;
        e.blocos.splice(bi, 1); return redesenhar();
      }
      // envios
      const tipoEnvio = el.dataset.subir;
      if (tipoEnvio) {
        const aceita = { imagem: "image/*", video: "video/mp4,video/webm,video/quicktime", animacao: "image/gif,image/webp,image/png,video/mp4,video/webm,.html", arquivo: ".pdf,.pptx,.docx,.xlsx,.mp3", interativo: ".html" }[tipoEnvio];
        const f = await seletorArquivo(aceita); if (!f) return;
        const r = await subir(f, el.closest(".bloco-corpo")); if (!r) return;
        b.src = r.url;
        if (tipoEnvio === "imagem") { const [w, h] = await dimensoes(r.url); b.w = w; b.h = h; b.marcadores = []; }
        if (tipoEnvio === "arquivo" && !b.nome) b.nome = f.name.replace(/\.[^.]+$/, "");
        if (tipoEnvio === "interativo") { b.texto = await textoDeHtml(f); if (!b.titulo) b.titulo = f.name.replace(/\.[^.]+$/, ""); }
        return redesenhar(b.id);
      }
      if (el.dataset.subirQuadro !== undefined) {
        const f = await seletorArquivo("image/*"); if (!f) return;
        const r = await subir(f, el.closest(".bloco-corpo")); if (!r) return;
        b.quadros[Number(el.dataset.subirQuadro)].src = r.url; return redesenhar(b.id);
      }
      if (el.dataset.marcar !== undefined) {
        const img = el.querySelector("img"); const rc = img.getBoundingClientRect();
        const x = Math.round(((ev.clientX - rc.left) / rc.width) * 1000) / 10, y = Math.round(((ev.clientY - rc.top) / rc.height) * 1000) / 10;
        if (b.marcadores.length >= 20) return toast("Até 20 pontos por imagem.", "erro");
        b.marcadores.push({ x, y, texto: "" }); redesenhar(b.id);
        setTimeout(() => document.querySelector(`#ed-${b.id} [data-marc="${b.marcadores.length - 1}"]`)?.focus(), 60);
        return;
      }
      const lista = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
      if (el.dataset.rmMarc !== undefined) { b.marcadores.splice(Number(el.dataset.rmMarc), 1); return redesenhar(b.id); }
      if (el.dataset.addQ !== undefined) { b.quadros.push({ src: "", titulo: "", texto: "" }); return redesenhar(b.id); }
      if (el.dataset.rmQ !== undefined) { b.quadros.splice(Number(el.dataset.rmQ), 1); return redesenhar(b.id); }
      if (el.dataset.mvQ !== undefined) { lista(b.quadros, Number(el.dataset.mvQ), Number(el.dataset.d)); return redesenhar(b.id); }
      if (el.dataset.addItem !== undefined) { b.itens.push(""); redesenhar(b.id); setTimeout(() => document.querySelector(`#ed-${b.id} [data-item="${b.itens.length - 1}"]`)?.focus(), 60); return; }
      if (el.dataset.rmItem !== undefined) { b.itens.splice(Number(el.dataset.rmItem), 1); return redesenhar(b.id); }
      if (el.dataset.mvItem !== undefined) { lista(b.itens, Number(el.dataset.mvItem), Number(el.dataset.d)); return redesenhar(b.id); }
      if (el.dataset.addFala !== undefined) { const ult = b.falas[b.falas.length - 1]; b.falas.push({ quem: ult?.quem === "cliente" ? "atendente" : "cliente", texto: "" }); return redesenhar(b.id); }
      if (el.dataset.rmFala !== undefined) { b.falas.splice(Number(el.dataset.rmFala), 1); return redesenhar(b.id); }
      if (el.dataset.mvFala !== undefined) { lista(b.falas, Number(el.dataset.mvFala), Number(el.dataset.d)); return redesenhar(b.id); }
      if (el.dataset.addLink !== undefined) { b.itens.push({ titulo: "", url: "", descricao: "" }); return redesenhar(b.id); }
      if (el.dataset.rmLink !== undefined) { b.itens.splice(Number(el.dataset.rmLink), 1); return redesenhar(b.id); }
    });

    // arrastar arquivo sobre a área "Enviar imagem"
    box.querySelectorAll(".soltar").forEach((z) => {
      z.addEventListener("dragover", (ev) => { ev.preventDefault(); z.classList.add("sobre"); });
      z.addEventListener("dragleave", () => z.classList.remove("sobre"));
      z.addEventListener("drop", async (ev) => {
        ev.preventDefault(); z.classList.remove("sobre");
        const f = ev.dataTransfer.files[0]; if (!f) return;
        const b = blocoDe(z); const r = await subir(f, z.parentElement); if (!r) return;
        const [w, h] = await dimensoes(r.url); Object.assign(b, { src: r.url, w, h, marcadores: [] }); redesenhar(b.id);
      });
      z.addEventListener("paste", async (ev) => {
        const f = [...(ev.clipboardData?.files || [])][0]; if (!f) return;
        const b = blocoDe(z); const r = await subir(f, z.parentElement); if (!r) return;
        const [w, h] = await dimensoes(r.url); Object.assign(b, { src: r.url, w, h, marcadores: [] }); redesenhar(b.id);
      });
    });
  }

  // ------------------------------------------------------------ pré-visualização e salvar
  function previa() {
    const { t } = estado;
    const d = document.createElement("div");
    d.className = "previa-fundo";
    let i = estado.aberta;
    const desenhar = () => {
      d.innerHTML = `<div class="previa" role="dialog" aria-modal="true" aria-label="Pré-visualização">
        <div class="previa-topo"><strong>Pré-visualização</strong><span class="mudo">Etapa ${i + 1} de ${t.etapas.length}</span><span class="grow"></span>
          <button type="button" class="btn-ico" data-p="-1" ${i === 0 ? "disabled" : ""} aria-label="Etapa anterior">${icone("seta_e", 2)}</button>
          <button type="button" class="btn-ico" data-p="1" ${i === t.etapas.length - 1 ? "disabled" : ""} aria-label="Próxima etapa">${icone("seta_d", 2)}</button>
          <button type="button" class="btn-ico" data-fechar aria-label="Fechar">${icone("x", 2)}</button></div>
        <div class="previa-corpo leitura"><article class="conteudo"><h2 class="etapa-titulo">${esc(t.etapas[i].titulo)}</h2><div class="blocos">${Blocos.renderEtapa(t.etapas[i], { editor: true })}</div></article></div></div>`;
      Blocos.ativar(d.querySelector(".conteudo"));
    };
    desenhar();
    const fechar = () => { d.remove(); document.removeEventListener("keydown", tecla); };
    const tecla = (e) => e.key === "Escape" && fechar();
    d.addEventListener("click", (e) => {
      if (e.target === d || e.target.closest("[data-fechar]")) return fechar();
      const p = e.target.closest("[data-p]"); if (p) { i += Number(p.dataset.p); desenhar(); }
    });
    document.addEventListener("keydown", tecla);
    document.body.appendChild(d);
  }

  async function salvar(publicar) {
    const { t } = estado;
    if (!t.titulo.trim()) { toast("Dê um título ao treinamento.", "erro"); $("#fTitulo").focus(); return; }
    const corpo = { ...t, publicado: publicar };
    const botoes = document.querySelectorAll("#edPublicar, #edRascunho");
    botoes.forEach((b) => (b.disabled = true));
    try {
      const r = t.id ? await api(`/api/treinamentos/${encodeURIComponent(t.id)}`, { method: "PUT", body: corpo })
        : await api("/api/treinamentos", { method: "POST", body: corpo });
      localStorage.removeItem(chaveRascunho());
      const eraNovo = !t.id;
      Object.assign(t, r.treinamento);
      estado.sujo = false;
      App.invalidar();
      toast(publicar ? "Treinamento publicado." : "Rascunho salvo. Só editores veem.");
      if (eraNovo) { estado.hash = `#/editar/${t.id}`; history.replaceState(null, "", estado.hash); }
      $("#edEstado").textContent = "Tudo salvo";
      desenharTudo(document.getElementById("view"));
    } catch (ex) { toast(ex.message, "erro"); }
    finally { botoes.forEach((b) => (b.disabled = false)); }
  }

  // Avisa antes de sair com alterações não salvas
  addEventListener("beforeunload", (e) => { if (estado?.sujo && document.querySelector(".editor")) { e.preventDefault(); e.returnValue = ""; } });
  async function saindo() {
    if (!estado || !document.querySelector(".editor")) { estado = null; return true; }
    if (location.hash === estado.hash) return false;
    if (!estado.sujo) { estado = null; return true; }
    const destino = location.hash;
    history.replaceState(null, "", estado.hash);
    const ok = await App.confirmar("Sair sem salvar?", "As alterações ficam guardadas neste navegador e podem ser recuperadas ao abrir o editor de novo.", "Sair");
    if (!ok) return false;
    estado = null;
    history.replaceState(null, "", destino);
    return true;
  }

  window.Editor = { abrir, saindo };
})();
