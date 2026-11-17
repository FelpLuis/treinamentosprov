// Desenho dos blocos de um treinamento (usado na leitura e na pré-visualização do editor).
(function () {
  const { esc, icone, reduzMovimento, copiar, toast, ler, guardar } = window.T;

  const AVISO = {
    info: { ico: "info", nome: "Informação" },
    dica: { ico: "lampada", nome: "Dica" },
    atencao: { ico: "aviso", nome: "Atenção" },
    sucesso: { ico: "check_c", nome: "Certo" },
  };
  const QUEM = { atendente: "Atendente", cliente: "Cliente", tecnico: "Técnico" };

  function youtubeId(url) {
    const m = String(url || "").match(/(?:youtube\.com\/watch\?[^\s]*v=|youtu\.be\/|youtube\.com\/(?:embed|shorts)\/)([\w-]{11})/);
    return m && m[1];
  }
  function vimeoId(url) { const m = String(url || "").match(/vimeo\.com\/(?:video\/)?(\d+)/); return m && m[1]; }
  const ehVideo = (src) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src || "");
  const extensao = (src) => (String(src || "").split("?")[0].match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || "";
  const dominio = (url) => { try { return new URL(url, location.href).hostname.replace(/^www\./, ""); } catch { return ""; } };

  function img(src, alt, w, h, extra = "") {
    const dims = w && h ? ` width="${w}" height="${h}"` : "";
    return `<img src="${esc(src)}" alt="${esc(alt || "")}" loading="lazy" decoding="async"${dims} ${extra}>`;
  }

  // ------------------------------------------------------------ HTML de cada bloco
  function render(b, ctx = {}) {
    switch (b.tipo) {
      case "texto":
        return `<div class="bl bl-texto prosa">${b.html || ""}</div>`;
      case "aviso": {
        const a = AVISO[b.estilo] || AVISO.info;
        return `<aside class="bl bl-aviso aviso-${esc(b.estilo || "info")}">
          <span class="aviso-ico">${icone(a.ico, 2)}</span>
          <div class="prosa">${b.titulo ? `<strong class="aviso-titulo">${esc(b.titulo)}</strong>` : ""}${b.html || ""}</div></aside>`;
      }
      case "imagem": {
        if (!b.src) return ctx.editor ? `<div class="bl vazio">Imagem sem arquivo</div>` : "";
        const marc = (b.marcadores || []).map((m, i) => `
          <button type="button" class="marcador" style="left:${m.x}%;top:${m.y}%" aria-label="Ponto ${i + 1}: ${esc(m.texto)}" data-i="${i}">
            <span class="marcador-n">${i + 1}</span><span class="marcador-tip" role="tooltip">${esc(m.texto)}</span></button>`).join("");
        return `<figure class="bl bl-imagem larg-${esc(b.largura || "normal")}">
          <div class="moldura${marc ? " tem-marcadores" : ""}">${img(b.src, b.alt, b.w, b.h, 'data-zoom="1"')}${marc}</div>
          ${b.legenda ? `<figcaption>${b.legenda}</figcaption>` : ""}</figure>`;
      }
      case "video": {
        const yt = youtubeId(b.src), vm = vimeoId(b.src);
        let corpo;
        if (yt) {
          corpo = `<button type="button" class="yt" data-yt="${esc(yt)}" aria-label="Assistir: ${esc(b.titulo || "vídeo")}">
            <img src="https://i.ytimg.com/vi/${esc(yt)}/hqdefault.jpg" alt="" loading="lazy"><span class="yt-play">${icone("play", 0)}</span></button>`;
        } else if (vm) {
          corpo = `<iframe src="https://player.vimeo.com/video/${esc(vm)}" title="${esc(b.titulo || "Vídeo")}" allow="fullscreen; picture-in-picture" loading="lazy"></iframe>`;
        } else if (b.src) {
          corpo = `<video controls preload="metadata" playsinline ${b.capa ? `poster="${esc(b.capa)}"` : ""} src="${esc(b.src)}"></video>`;
        } else return ctx.editor ? `<div class="bl vazio">Vídeo sem arquivo ou endereço</div>` : "";
        return `<figure class="bl bl-video">${b.titulo ? `<div class="midia-titulo">${icone("video")}${esc(b.titulo)}</div>` : ""}
          <div class="video-caixa">${corpo}</div>${b.legenda ? `<figcaption>${esc(b.legenda)}</figcaption>` : ""}</figure>`;
      }
      case "animacao": {
        if (b.modo === "arquivo") {
          if (!b.src) return ctx.editor ? `<div class="bl vazio">Animação sem arquivo</div>` : "";
          const midia = ehVideo(b.src)
            ? `<video class="anim-video" src="${esc(b.src)}" muted loop playsinline preload="metadata" ${reduzMovimento() ? "" : "autoplay"}></video>
               <button type="button" class="anim-pausa" aria-label="Pausar animação">${icone(reduzMovimento() ? "play" : "pausa", 2)}</button>`
            : extensao(b.src) === "html"
              ? `<iframe class="anim-html" src="${esc(b.src)}" sandbox="allow-scripts" title="${esc(b.titulo || "Animação")}"></iframe>`
              : img(b.src, b.titulo, 0, 0);
          return `<figure class="bl bl-anim anim-arquivo">${b.titulo ? `<div class="midia-titulo">${icone("animacao")}${esc(b.titulo)}</div>` : ""}<div class="anim-caixa">${midia}</div></figure>`;
        }
        const q = (b.quadros || []).filter((x) => x.src || x.titulo || x.texto);
        if (!q.length) return ctx.editor ? `<div class="bl vazio">Sequência sem quadros</div>` : "";
        return `<figure class="bl bl-anim anim-seq trans-${esc(b.transicao || "deslizar")}" data-intervalo="${Number(b.intervalo) || 4}" tabindex="0" aria-roledescription="sequência animada" aria-label="${esc(b.titulo || "Sequência animada")}">
          <div class="seq-topo">${b.titulo ? `<span class="midia-titulo">${icone("animacao")}${esc(b.titulo)}</span>` : "<span></span>"}
            <div class="seq-barras">${q.map((_, i) => `<button type="button" class="seq-barra" data-ir="${i}" aria-label="Quadro ${i + 1}"><i></i></button>`).join("")}</div></div>
          <div class="seq-palco">${q.map((x, i) => `
            <div class="seq-quadro${i === 0 ? " ativo" : ""}" data-i="${i}" aria-hidden="${i === 0 ? "false" : "true"}">
              ${x.src ? `<div class="seq-img">${img(x.src, x.titulo, 0, 0, 'data-zoom="1"')}</div>` : ""}
              <div class="seq-legenda"><span class="seq-n">${i + 1}/${q.length}</span>${x.titulo ? `<strong>${esc(x.titulo)}</strong>` : ""}${x.texto ? `<p>${esc(x.texto)}</p>` : ""}</div>
            </div>`).join("")}</div>
          <div class="seq-ctrl">
            <button type="button" class="btn-ico" data-seq="ant" aria-label="Quadro anterior">${icone("seta_e", 2)}</button>
            <button type="button" class="btn-ico seq-play" data-seq="play" aria-label="Pausar">${icone("pausa", 2)}</button>
            <button type="button" class="btn-ico" data-seq="prox" aria-label="Próximo quadro">${icone("seta_d", 2)}</button>
          </div></figure>`;
      }
      case "passos":
        return `<ol class="bl bl-passos">${(b.itens || []).map((x) => `<li><div class="prosa">${x}</div></li>`).join("")}</ol>`;
      case "checklist": {
        const salvo = ctx.chave ? ler(`chk:${ctx.chave}:${b.id}`, []) : [];
        return `<div class="bl bl-checklist" data-chave="${esc(ctx.chave ? `chk:${ctx.chave}:${b.id}` : "")}">
          ${b.titulo ? `<div class="chk-titulo">${icone("checklist")}${esc(b.titulo)}</div>` : ""}
          ${(b.itens || []).map((x, i) => `<label class="chk"><input type="checkbox" data-i="${i}" ${salvo.includes(i) ? "checked" : ""}><span class="caixa">${icone("check", 3)}</span><span>${esc(x)}</span></label>`).join("")}</div>`;
      }
      case "dialogo":
        return `<div class="bl bl-dialogo">${(b.falas || []).map((f) => `
          <div class="fala fala-${esc(f.quem)}"><span class="fala-quem">${QUEM[f.quem] || "Atendente"}</span>
            <div class="balao">${esc(f.texto).replace(/\n/g, "<br>")}${f.quem !== "cliente" ? `<button type="button" class="copiar-fala" data-copiar="${esc(f.texto)}" aria-label="Copiar fala">${icone("copiar")}</button>` : ""}</div></div>`).join("")}</div>`;
      case "codigo":
        return `<div class="bl bl-codigo"><div class="codigo-topo"><span>${esc(b.rotulo || "")}</span>
          <button type="button" class="btn-mini" data-copiar="${esc(b.texto)}">${icone("copiar")}Copiar</button></div><pre><code>${esc(b.texto)}</code></pre></div>`;
      case "arquivo": {
        if (!b.src) return ctx.editor ? `<div class="bl vazio">Anexo sem arquivo</div>` : "";
        const ext = extensao(b.src);
        const pdf = ext === "pdf";
        return `<div class="bl bl-arquivo"><div class="arq-linha">
          <span class="arq-tipo t-${esc(ext)}">${esc((ext || "link").toUpperCase())}</span>
          <div class="arq-nome"><strong>${esc(b.nome || "Arquivo")}</strong>${b.descricao ? `<small>${esc(b.descricao)}</small>` : ""}</div>
          ${pdf ? `<button type="button" class="btn btn-claro btn-p" data-pdf="${esc(b.src)}">${icone("olho")}Ver aqui</button>` : ""}
          <a class="btn btn-claro btn-p" href="${esc(b.src)}" target="_blank" rel="noopener">${icone("ext")}Abrir</a></div></div>`;
      }
      case "links":
        return `<ul class="bl bl-links">${(b.itens || []).map((l) => `<li><a href="${esc(l.url)}" ${/^https?:/.test(l.url) ? 'target="_blank" rel="noopener"' : ""}>
          <span class="lk-ico">${icone("link")}</span><span class="lk-txt"><strong>${esc(l.titulo || l.url)}</strong><small>${esc(l.descricao || dominio(l.url))}</small></span>${icone("ext")}</a></li>`).join("")}</ul>`;
      case "interativo":
        if (!b.src) return ctx.editor ? `<div class="bl vazio">Conteúdo interativo sem arquivo</div>` : "";
        return `<div class="bl bl-interativo"><div class="int-topo"><span>${icone("interativo")}${esc(b.titulo || "Conteúdo interativo")}</span>
          <span class="int-acoes"><button type="button" class="btn-mini" data-tela-cheia>${icone("tela")}Tela cheia</button>
          <a class="btn-mini" href="${esc(b.src)}" target="_blank" rel="noopener">${icone("ext")}Abrir em nova aba</a></span></div>
          <iframe src="${esc(b.src)}" title="${esc(b.titulo || "Conteúdo interativo")}" sandbox="allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox" style="height:${Number(b.altura) || 820}px" loading="lazy"></iframe></div>`;
      case "divisor":
        return `<hr class="bl bl-divisor">`;
      default:
        return "";
    }
  }

  const renderEtapa = (etapa, ctx) => (etapa.blocos || []).map((b) => render(b, ctx)).join("");

  // ------------------------------------------------------------ comportamento
  const sequencias = new Set();
  function iniciarSequencia(el) {
    const quadros = [...el.querySelectorAll(".seq-quadro")];
    const barras = [...el.querySelectorAll(".seq-barra")];
    const btnPlay = el.querySelector(".seq-play");
    const ms = (Number(el.dataset.intervalo) || 4) * 1000;
    let i = 0, tocando = !reduzMovimento(), timer = null, inicio = 0, raf = null;
    const desenharBarras = (p) => barras.forEach((b, k) => b.firstElementChild.style.transform = `scaleX(${k < i ? 1 : k === i ? p : 0})`);
    function ir(n, manual) {
      quadros[i].classList.remove("ativo"); quadros[i].setAttribute("aria-hidden", "true");
      quadros[i].classList.toggle("saiu", true);
      setTimeout(((q) => () => q.classList.remove("saiu"))(quadros[i]), 700);
      i = (n + quadros.length) % quadros.length;
      quadros[i].classList.add("ativo"); quadros[i].setAttribute("aria-hidden", "false");
      inicio = performance.now();
      if (manual) desenharBarras(tocando ? 0 : 1);
    }
    function passo(t) {
      if (!document.body.contains(el)) { parar(); sequencias.delete(el); return; }
      if (tocando) {
        const p = Math.min(1, (t - inicio) / ms);
        desenharBarras(p);
        if (p >= 1) ir(i + 1);
      }
      raf = requestAnimationFrame(passo);
    }
    function parar() { cancelAnimationFrame(raf); }
    function play(v) {
      tocando = v;
      btnPlay.innerHTML = icone(v ? "pausa" : "play", 2);
      btnPlay.setAttribute("aria-label", v ? "Pausar" : "Reproduzir");
      inicio = performance.now();
      if (!v) desenharBarras(1);
    }
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-seq],[data-ir]");
      if (!b) return;
      if (b.dataset.ir !== undefined) ir(Number(b.dataset.ir), true);
      else if (b.dataset.seq === "ant") ir(i - 1, true);
      else if (b.dataset.seq === "prox") ir(i + 1, true);
      else play(!tocando);
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { ir(i + 1, true); e.preventDefault(); }
      if (e.key === "ArrowLeft") { ir(i - 1, true); e.preventDefault(); }
      if (e.key === " " && e.target === el) { play(!tocando); e.preventDefault(); }
    });
    // pausa quando sai da tela, retoma quando volta
    const io = new IntersectionObserver(([en]) => { if (!en.isIntersecting && tocando) { el.dataset.pausadoAuto = "1"; play(false); } else if (en.isIntersecting && el.dataset.pausadoAuto) { delete el.dataset.pausadoAuto; play(true); } }, { threshold: 0.3 });
    io.observe(el);
    play(tocando);
    desenharBarras(0);
    raf = requestAnimationFrame(passo);
    sequencias.add(el);
  }

  function lightbox(src, alt) {
    const d = document.createElement("div");
    d.className = "lightbox";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-label", "Imagem ampliada");
    d.innerHTML = `<button type="button" class="btn-ico lb-fechar" aria-label="Fechar">${icone("x", 2)}</button><img src="${esc(src)}" alt="${esc(alt || "")}">`;
    const fechar = () => { d.classList.add("sai"); setTimeout(() => d.remove(), 160); document.removeEventListener("keydown", tecla); };
    const tecla = (e) => e.key === "Escape" && fechar();
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest(".lb-fechar")) fechar(); else if (e.target.tagName === "IMG") d.classList.toggle("zoom"); });
    document.addEventListener("keydown", tecla);
    document.body.appendChild(d);
    d.querySelector(".lb-fechar").focus();
  }

  function ativar(raiz) {
    raiz.querySelectorAll(".anim-seq:not([data-on])").forEach((el) => { el.dataset.on = "1"; iniciarSequencia(el); });
    raiz.querySelectorAll(".anim-pausa:not([data-on])").forEach((b) => {
      b.dataset.on = "1";
      b.addEventListener("click", () => {
        const v = b.parentElement.querySelector("video");
        if (v.paused) { v.play(); b.innerHTML = icone("pausa", 2); b.setAttribute("aria-label", "Pausar animação"); }
        else { v.pause(); b.innerHTML = icone("play", 2); b.setAttribute("aria-label", "Reproduzir animação"); }
      });
    });
    raiz.querySelectorAll(".yt img").forEach((im) => im.addEventListener("error", () => im.classList.add("falhou"), { once: true }));
    if (raiz.dataset.blocosOn) return;
    raiz.dataset.blocosOn = "1";
    raiz.addEventListener("click", async (e) => {
      const yt = e.target.closest(".yt");
      if (yt) {
        yt.outerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(yt.dataset.yt)}?autoplay=1&rel=0" title="Vídeo do YouTube" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
        return;
      }
      const cp = e.target.closest("[data-copiar]");
      if (cp) { if (await copiar(cp.dataset.copiar)) toast("Copiado."); return; }
      const pdf = e.target.closest("[data-pdf]");
      if (pdf) {
        const box = pdf.closest(".bl-arquivo");
        const atual = box.querySelector(".pdf-embed");
        if (atual) { atual.remove(); pdf.innerHTML = `${icone("olho")}Ver aqui`; }
        else { box.insertAdjacentHTML("beforeend", `<iframe class="pdf-embed" src="${esc(pdf.dataset.pdf)}#view=FitH" title="Visualização do PDF"></iframe>`); pdf.innerHTML = `${icone("x")}Fechar`; }
        return;
      }
      const tc = e.target.closest("[data-tela-cheia]");
      if (tc) { const box = tc.closest(".bl-interativo"); (box.requestFullscreen || box.webkitRequestFullscreen)?.call(box); return; }
      const z = e.target.closest("img[data-zoom]");
      if (z && !e.target.closest(".editor-imagem")) { lightbox(z.currentSrc || z.src, z.alt); return; }
      const m = e.target.closest(".marcador");
      if (m) { const ativo = m.classList.contains("aberto"); m.closest(".moldura").querySelectorAll(".marcador.aberto").forEach((x) => x.classList.remove("aberto")); if (!ativo) m.classList.add("aberto"); }
    });
    raiz.addEventListener("change", (e) => {
      const c = e.target.closest(".bl-checklist input");
      if (!c) return;
      const box = c.closest(".bl-checklist");
      if (box.dataset.chave) guardar(box.dataset.chave, [...box.querySelectorAll("input:checked")].map((x) => Number(x.dataset.i)));
      box.classList.toggle("completo", [...box.querySelectorAll("input")].every((x) => x.checked));
    });
  }

  window.Blocos = { render, renderEtapa, ativar, youtubeId, extensao, AVISO };
})();
