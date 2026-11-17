// Utilitários compartilhados: API, escape, ícones, avisos, datas e tema.
(function () {
  async function api(path, { method = "GET", body, raw } = {}) {
    const r = await fetch(path, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      headers: { "X-Treinamentos": "1", ...(body && !raw ? { "Content-Type": "application/json" } : {}) },
      body: body ? (raw ? body : JSON.stringify(body)) : undefined,
    });
    let data = {};
    try { data = await r.json(); } catch {}
    if (r.status === 401) {
      location.href = data.login_base ? data.login_base + encodeURIComponent(location.href) : data.login || "/";
      throw new Error("Sessão expirada.");
    }
    if (!r.ok) throw new Error(data.error || `Falha na requisição (${r.status}).`);
    return data;
  }

  // Envio de arquivo com barra de progresso (fetch não informa progresso de upload)
  function enviarArquivo(file, aoProgresso) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open("POST", "/api/midia");
      x.setRequestHeader("X-Treinamentos", "1");
      x.setRequestHeader("X-Nome", encodeURIComponent(file.name || "arquivo"));
      x.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      x.upload.onprogress = (e) => e.lengthComputable && aoProgresso && aoProgresso(e.loaded / e.total);
      x.onload = () => {
        let d = {};
        try { d = JSON.parse(x.responseText); } catch {}
        if (x.status >= 200 && x.status < 300) resolve(d);
        else reject(new Error(d.error || `Falha no envio (${x.status}).`));
      };
      x.onerror = () => reject(new Error("Falha de rede no envio do arquivo."));
      x.send(file);
    });
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const TZ = "America/Sao_Paulo";
  const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
  const fmtDH = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
  const data = (iso) => (iso ? fmtData.format(new Date(iso)).replace(/ de /g, " ").replace(".", "") : "—");
  const dataHora = (iso) => (iso ? fmtDH.format(new Date(iso)) : "—");
  const num = (n) => new Intl.NumberFormat("pt-BR").format(n || 0);
  function relativo(iso) {
    if (!iso) return "";
    const d = (Date.now() - new Date(iso)) / 86400000;
    if (d < 1) return "hoje";
    if (d < 2) return "ontem";
    if (d < 30) return `há ${Math.floor(d)} dias`;
    return data(iso);
  }

  function toast(msg, tipo = "ok") {
    let box = document.getElementById("toasts");
    if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    const el = document.createElement("div");
    el.className = `toast toast-${tipo}`;
    el.setAttribute("role", "status");
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.classList.add("sai"), 3600);
    setTimeout(() => el.remove(), 4000);
  }

  // Ícones de traço 24×24
  const P = {
    busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    casa: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    grade: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    lixo: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    sair: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
    lua: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    seta_e: '<path d="M15 6l-6 6 6 6"/>',
    seta_d: '<path d="M9 6l6 6-6 6"/>',
    seta_c: '<path d="M6 15l6-6 6 6"/>',
    seta_b: '<path d="M6 9l6 6 6-6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    check_c: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    camadas: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    copiar: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    pausa: '<path d="M8 5v14M16 5v14"/>',
    tela: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    salvar: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    arrastar: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',
    duplicar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    pergunta: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
    grafico: '<path d="M5 20V12M11 20V5M17 20v-9"/><path d="M3 20h18"/>',
    usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
    portal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 20V9"/>',
    // blocos
    texto: '<path d="M5 6h14M5 11h14M5 16h9"/>',
    imagem: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
    animacao: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 9.5v5l4-2.5z"/><path d="M7 5v14M17 5v14" opacity=".45"/>',
    passos: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5l1.5-1V9M3.5 15.5a1.5 1.5 0 1 1 2.6 1L4 19h3"/>',
    checklist: '<rect x="3" y="4" width="6" height="6" rx="1"/><path d="M4.5 7l1 1 2-2M12 7h9M3 15h6v6H3zM12 18h9"/>',
    dialogo: '<path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M17 9h3a1 1 0 0 1 1 1v8l-3-2h-6"/>',
    codigo: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    aviso: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    lampada: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    arquivo: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
    links: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
    interativo: '<path d="M4 4l7 17 2.5-7.5L21 11z"/>',
    divisor: '<path d="M4 12h16"/>',
    // ícones de assunto (capas)
    headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/><path d="M19 20a3 3 0 0 1-3 2h-3"/>',
    ixc: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 13h4M7 16h7"/>',
    chat: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8 10h8M8 13h5"/>',
    sinal: '<path d="M4 20v-3M9 20v-7M14 20v-11M19 20V5"/>',
    roteador: '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 16.5h.01M11 16.5h.01M8 13l-2-6M16 13l2-6"/><path d="M9 5a5 5 0 0 1 6 0"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
    jogo: '<path d="M6 8h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15 13H9l-1.6 1.8A3 3 0 0 1 2 13v-1a4 4 0 0 1 4-4z"/><path d="M7 11v3M5.5 12.5h3M16 11.5h.01M18 13h.01"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
    mapa: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0"/>',
    telefone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    alvo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    plano: '<path d="M4 7h16M4 12h16M4 17h10"/><circle cx="18" cy="17" r="2"/>',
    empresa: '<path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 9h5a1 1 0 0 1 1 1v11M3 21h18"/><path d="M8 8h2M8 12h2M8 16h2M17 13h.01M17 17h.01"/>',
    dinheiro: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M7 9.5v5M17 9.5v5"/>',
    contrato: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 17c1.5-2 2.5-2 3 0s1.5 1 3-1"/>',
    planilha: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>',
    olt: '<rect x="3" y="5" width="18" height="6" rx="1.5"/><rect x="3" y="13" width="18" height="6" rx="1.5"/><path d="M7 8h.01M7 16h.01M11 8h6M11 16h6"/>',
    fibra: '<path d="M3 17c4 0 5-10 9-10s5 10 9 10"/><path d="M3 12h3M18 12h3"/>',
    pasta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    quadro: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/><path d="M5 8h2M11 8h2M11 11h2M17 8h2"/>',
    ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
    check2: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.5l2.8 2.8L16.5 9"/>',
  };
  P.check_c2 = P.check2;
  const icone = (k, sw = 1.8) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k] || P.arquivo}</svg>`;

  // Símbolo oficial UPDOWN (o mesmo desenho do favicon), em traço para o fundo e as capas
  const simbolo = (cls = "") => `<svg class="chev ${cls}" viewBox="580 280 850 850" aria-hidden="true" fill="none" stroke-linejoin="round">
    <g class="s-u" stroke="#0BBBEF">
      <path pathLength="1" d="M612 682L680 727L748 682V800C748 892 814 967 898 967C978 967 1044 906 1044 830V727L1113 675L1183 727V820C1183 972 1055 1097 898 1097C740 1097 612 968 612 810Z"/>
      <path pathLength="1" d="M1398 730L1329 685L1261 730V600C1261 515 1198 445 1113 445C1032 445 966 508 966 585V685L897 737L827 685V585C827 436 956 315 1113 315C1270 315 1398 443 1398 600Z"/></g>
    <g class="s-v" stroke="#9B00FF">
      <path pathLength="1" d="M610 500L680 550L750 500V620L680 673L610 620Z"/><path pathLength="1" d="M827 738L897 788L967 738V858L897 910L827 858Z"/>
      <path pathLength="1" d="M1042 553L1112 500L1182 553V672L1112 623L1042 672Z"/><path pathLength="1" d="M1259 790L1329 738L1399 790V910L1329 860L1259 910Z"/></g></svg>`;
  const chevrons = simbolo;

  // Tema claro/escuro
  const TEMA = "treinamentos-tema";
  function temaSalvo() { try { return localStorage.getItem(TEMA); } catch { return null; } }
  function aplicarTema(t) {
    document.documentElement.setAttribute("data-theme", t);
    document.querySelectorAll("[data-tema]").forEach((b) => {
      b.innerHTML = icone(t === "dark" ? "sol" : "lua");
      b.setAttribute("aria-label", t === "dark" ? "Mudar para o modo claro" : "Mudar para o modo escuro");
      b.title = b.getAttribute("aria-label");
    });
  }
  const mq = matchMedia("(prefers-color-scheme: dark)");
  aplicarTema(temaSalvo() || (mq.matches ? "dark" : "light"));
  mq.addEventListener?.("change", (e) => { if (!temaSalvo()) aplicarTema(e.matches ? "dark" : "light"); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-tema]");
    if (!b) return;
    const novo = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem(TEMA, novo); } catch {}
    aplicarTema(novo);
  });

  const reduzMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  function ler(k, padrao) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } }

  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); return true; }
    catch {
      const t = document.createElement("textarea"); t.value = texto; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      const ok = document.execCommand("copy"); t.remove(); return ok;
    }
  }

  window.T = { api, enviarArquivo, esc, data, dataHora, num, relativo, toast, icone, chevrons, aplicarTema, reduzMovimento, guardar, ler, copiar };
})();
