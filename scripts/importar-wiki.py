#!/usr/bin/env python3
"""Converte o export da wiki (Wiki.js) em treinamentos da plataforma.

Uso:
  python3 -I scripts/importar-wiki.py <pasta-do-export> conteudo/

A pasta do export tem pages.json ({pages, mapa}), anexos.json e midia/ (imagens e PDFs).
Cada treinamento é montado a partir de uma ou mais páginas da wiki (veja TRILHAS):
- páginas viram etapas; títulos h1/h2 de uma página única também viram etapas;
- "Atendente:" + bloco de código vira diálogo; citações coloridas viram avisos;
- listas numeradas viram passo a passo; links do YouTube viram vídeos; PDFs viram anexos.
"""
import html as H
import json
import re
import shutil
import sys
import unicodedata
from html.parser import HTMLParser
from pathlib import Path

ORIGEM = "https://wiki.updowntelecom.com.br"

# id, título, setores, categoria, ícone, nível, páginas (ids da wiki), resumo, tags extras
TRILHAS = [
    # ---------------- Atendimento
    ("atendimento-n1-no-ixc", "Atendimento N1 no IXC: do cadastro à ordem de serviço", ["atendimento"], "IXC Provedor", "ixc", "basico",
     [4, 6, 7, 8, 67], "Como localizar o cliente, ler o histórico, abrir o atendimento e a O.S. com tudo que o técnico precisa saber.", ["ixc", "o.s", "atendimento", "protocolo"]),
    ("script-de-atendimento-n1", "Script de atendimento N1", ["atendimento"], "Scripts de atendimento", "chat", "basico",
     [3], "As falas do atendente do primeiro contato ao encerramento, prontas para usar no chat ou na ligação.", ["script", "atendimento encantador"]),
    ("procedimento-e-protocolo-de-conformidade", "Procedimento de atendimento e protocolo de conformidade", ["atendimento"], "Processos", "check", "intermediario",
     [65], "O padrão que todo atendimento precisa seguir e o que é considerado inconformidade.", ["conformidade", "padrão", "auditoria"]),
    ("smart-olt-sinal-e-logs", "Smart OLT: sinal óptico, logs e diagnóstico da ONU", ["atendimento", "noc"], "Diagnóstico", "sinal", "intermediario",
     [9, 10, 12, 13, 14, 81, 32], "Ler o sinal do cliente, entender LOS, LOSi, LOFi, SFI e Dying Gasp e identificar contratos no Smart OLT.", ["smartolt", "sinal", "dbm", "los", "onu", "logs"]),
    ("scripts-de-suporte-tecnico", "Scripts de suporte: sinal crítico, navegação e lentidão", ["atendimento"], "Scripts de atendimento", "chat", "basico",
     [16, 17, 84], "O que falar e o que verificar quando o cliente reclama de lentidão, sites fora do ar ou sinal fora do padrão.", ["lentidão", "downdetector", "navegação", "sinal crítico"]),
    ("faq-tecnico", "FAQ técnico para atendimento ao cliente", ["atendimento"], "Scripts de atendimento", "ajuda", "basico",
     [20], "Respostas para as perguntas mais comuns dos clientes sobre conexão, Wi-Fi e equipamento.", ["faq", "perguntas frequentes"]),
    ("configuracao-zte-f670l", "Configuração do roteador ZTE F670L", ["atendimento", "campo"], "Equipamentos", "roteador", "intermediario",
     [18], "SSID, senha, canais e mesh do F670L, com o padrão de senha da UPDOWN.", ["f670l", "zte", "roteador", "wifi", "mesh", "ssid"]),
    ("iptv-tratativas", "IPTV: tratativas com o cliente", ["atendimento"], "Scripts de atendimento", "tv", "basico",
     [19], "Passos iniciais e script para clientes com dificuldade nos canais de IPTV.", ["iptv", "tv", "canais"]),
    ("cliente-gamer", "Cliente gamer: NAT, latência e script", ["atendimento", "comercial"], "Scripts de atendimento", "jogo", "intermediario",
     [53], "Tipos de NAT, portas e como conversar com o cliente que joga online.", ["gamer", "nat", "latência", "ping", "jogos"]),
    ("comando-ping", "Comando PING na prática", ["atendimento", "noc"], "Redes", "terminal", "basico",
     [54], "Testar conectividade e latência com o ping e interpretar o resultado.", ["ping", "latência", "perda de pacotes"]),
    ("rompimentos-service", "Verificando rompimentos no SERVICE (InMap)", ["atendimento", "noc"], "Diagnóstico", "mapa", "basico",
     [66], "Como confirmar um rompimento massivo no mapa do SERVICE antes de abrir visitas.", ["rompimento", "massiva", "inmap", "service"]),
    ("liberacao-temporaria", "Liberação temporária", ["atendimento", "financeiro"], "Financeiro e contrato", "cadeado", "basico",
     [68], "Como liberar o acesso do cliente bloqueado e o prazo máximo permitido.", ["liberação", "bloqueado", "desbloqueio"]),
    ("protocolos-e-procedimentos", "Protocolos e procedimentos", ["atendimento"], "Processos", "check", "basico",
     [88], "Protocolos de atendimento e procedimentos internos.", ["protocolo"]),
    ("voip", "VoIP: funcionamento e cadastro da linha", ["atendimento", "campo"], "Equipamentos", "telefone", "intermediario",
     [74], "Como funciona o VoIP e onde cadastrar a linha no IXC e na ONT.", ["voip", "telefonia", "linha"]),
    # ---------------- Comercial
    ("setor-comercial-spin-selling", "Setor comercial: SPIN Selling, missão e valores", ["comercial"], "Vendas", "alvo", "basico",
     [33, 34], "Os objetivos do comercial, o método SPIN e a missão, visão e valores da UPDOWN.", ["spin selling", "missão", "visão", "valores"]),
    ("planos-vigentes", "Planos vigentes e como explicar cada um", ["comercial", "atendimento"], "Planos e produtos", "plano", "basico",
     [35, 37, 61, 60], "Os planos atuais, preços, benefícios inclusos e como apresentar cada um ao cliente.", ["planos", "preço", "upmax", "smart", "prime", "turbo"]),
    ("svas-e-adicionais", "SVAs: Watch TV, Leveduca e à la carte", ["comercial", "atendimento"], "Planos e produtos", "tv", "intermediario",
     [62, 63, 57], "O que cada serviço adicional entrega e como incluir o Watch TV no contrato.", ["sva", "watch", "leveduca", "paramount", "premiere", "telecine", "max"]),
    ("internet-mais-tv", "Planos Internet + TV", ["comercial"], "Planos e produtos", "tv", "basico",
     [49], "Script e regras dos planos com TV.", ["tv", "box"]),
    ("small-business", "Planos para pequenas empresas", ["comercial"], "Planos e produtos", "empresa", "basico",
     [45], "Small Business: para quem é e como contratar.", ["empresa", "pj", "cnpj"]),
    ("quebra-de-objecoes", "Quebra de objeções e scripts de venda", ["comercial"], "Vendas", "alvo", "intermediario",
     [36, 71, 64, 43, 44], "Respostas para \"tá caro\", estratégias de conversão, upgrade e reversão de cancelamento.", ["objeções", "tá caro", "cancelamento", "upgrade", "retenção"]),
    ("taxas-de-instalacao", "Taxas de instalação", ["comercial", "atendimento"], "Planos e produtos", "dinheiro", "basico",
     [38], "Valores e o script para apresentar a taxa de instalação.", ["taxa", "instalação"]),
    ("cadastro-do-cliente", "Cadastro do cliente (CPF e CNPJ)", ["comercial"], "IXC Provedor", "ixc", "basico",
     [39, 40, 86], "Dados e documentos obrigatórios e o passo a passo da prospecção no IXC.", ["cadastro", "prospecção", "crm", "cnpj", "documentos"]),
    ("fiberdocs-e-viabilidade", "Fiberdocs e viabilidade de porta na CTO", ["comercial", "campo", "atendimento"], "Rede e viabilidade", "mapa", "basico",
     [41, 48], "Encontrar a CTO no mapa e confirmar se há porta disponível para o cliente.", ["fiberdocs", "cto", "viabilidade", "porta"]),
    ("planilhas-controle-comercial", "Planilhas de controle diário do comercial", ["comercial"], "Processos", "planilha", "basico",
     [42], "Como preencher as planilhas de atendimento, agenda, upgrade e downgrade.", ["planilha", "controle"]),
    ("mudanca-de-titularidade", "Mudança de titularidade", ["comercial", "atendimento"], "Financeiro e contrato", "contrato", "intermediario",
     [46], "Quando pode, o que conferir e o passo a passo completo da troca de titular.", ["titularidade", "titular", "cpf"]),
    ("assinatura-de-contratos", "Assinatura de contratos: ZapSign, IXC Assina e Autentique", ["comercial", "atendimento"], "Financeiro e contrato", "contrato", "basico",
     [47, 72, 73, 77], "Gerar o link de assinatura e acompanhar como o cliente assina.", ["assinatura", "contrato", "zapsign", "ixc assina", "autentique"]),
    ("mudanca-de-endereco", "Mudança de endereço de ativação", ["comercial", "atendimento"], "Financeiro e contrato", "mapa", "basico",
     [70], "Como validar o novo endereço e registrar a mudança.", ["endereço", "mudança"]),
    ("vencimento-suspensao-cobrancas", "Vencimento, suspensão e cobranças de taxas", ["financeiro", "atendimento", "comercial"], "Financeiro e contrato", "dinheiro", "intermediario",
     [69, 59, 56], "Alterar a data de vencimento, fazer a suspensão temporária e gerar cobranças de taxas e serviços.", ["vencimento", "suspensão", "cobrança", "taxa", "boleto"]),
    # ---------------- NOC
    ("comandos-huawei", "Comandos Huawei para switches", ["noc"], "Comandos", "terminal", "avancado",
     [27, 25, 29], "Comandos de verificação, diagnóstico, VLAN, MPLS e configuração rápida em switches Huawei.", ["huawei", "switch", "display", "vlan", "mpls", "cli"]),
    ("comandos-ne8000", "Comandos do NE8000 (BRAS)", ["noc"], "Comandos", "terminal", "avancado",
     [31], "Consultar clientes online, sessões PPPoE e interfaces no NE8000.", ["ne8000", "bras", "pppoe", "access-user"]),
    ("olt-huawei-configuracao", "OLT Huawei: configurações iniciais e comandos", ["noc"], "Comandos", "olt", "avancado",
     [55, 83], "Primeiro acesso, modo de configuração e comandos de OLT.", ["olt", "huawei", "gpon"]),
    ("simuladores-de-switch", "Simuladores de switch (eNSP)", ["noc"], "Cursos e estudo", "terminal", "intermediario",
     [28], "Instalar e usar o eNSP para treinar configurações Huawei.", ["ensp", "simulador", "laboratório"]),
    ("provisionamento-de-cliente", "Provisionamento de cliente", ["campo", "noc"], "Instalação e campo", "olt", "intermediario",
     [30, 51, 50], "O processo obrigatório no SGP e no Smart OLT e as fotos exigidas na ativação.", ["provisionamento", "ativação", "sgp", "smartolt", "fotos"]),
    ("conferencia-de-cto", "Conferência de CTO", ["noc", "campo"], "Rede e viabilidade", "mapa", "intermediario",
     [80], "Cruzar log radius, Fiberdocs e clientes da fibra para conferir uma CTO.", ["cto", "conferência", "radius", "fiberdocs"]),
    ("videos-e-cursos-tecnicos", "Vídeos e cursos técnicos", ["atendimento", "noc", "campo"], "Cursos e estudo", "play", "basico",
     [23, 24, 26], "Uma seleção de vídeos e cursos gratuitos sobre FTTH, redes, Wi-Fi e Huawei.", ["curso", "vídeo", "ftth", "redes"]),
    ("aprenda-redes-wifi-fibra", "Aprenda: redes, Wi-Fi e fibra em infográficos", [], "Cursos e estudo", "fibra", "basico",
     [87], "TCP/IP, comandos do Windows e PowerShell, Wi-Fi e mesh, fibra, VPN, PPPoE e transporte L2L.", ["tcp/ip", "powershell", "wifi", "mesh", "vpn", "pppoe", "fibra"]),
    # ---------------- Geral
    ("documentos-e-materiais", "Documentos e materiais de treinamento", [], "Materiais", "pasta", "basico",
     [21, 76], "Os PDFs de treinamento operacional e as apresentações do Canva em um só lugar.", ["pdf", "materiais", "canva", "documentos"]),
    ("quadro-kanban-ixc", "Quadro Kanban no IXC", [], "IXC Provedor", "quadro", "basico",
     [75], "Como acessar e usar o Kanban do IXC para acompanhar tarefas.", ["kanban", "tarefas"]),
    ("ramais-corporativos", "Ramais corporativos", [], "Institucional", "telefone", "basico",
     [15], "Lista de ramais por setor.", ["ramal", "telefone", "contato"]),
    ("links-de-sistemas", "Links dos sistemas", [], "Institucional", "link", "basico",
     [22], "Endereços do IXC, Opa Suite, webmail e demais sistemas usados no dia a dia.", ["links", "sistemas", "opa", "ixc"]),
]

TAG_BLOCO = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "ul", "ol", "table", "hr", "div", "figure", "dl"}


class No:
    def __init__(self, tag, attrs=None, pai=None):
        self.tag, self.attrs, self.pai, self.filhos = tag, dict(attrs or []), pai, []

    def texto(self):
        return "".join(f if isinstance(f, str) else f.texto() for f in self.filhos)

    def achar(self, tag):
        for f in self.filhos:
            if isinstance(f, No):
                if f.tag == tag:
                    yield f
                yield from f.achar(tag)


VOID = {"br", "img", "hr", "input", "meta", "link", "source", "col", "wbr"}


class Arvore(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.raiz = No("raiz")
        self.atual = self.raiz

    def handle_starttag(self, tag, attrs):
        n = No(tag, attrs, self.atual)
        self.atual.filhos.append(n)
        if tag not in VOID:
            self.atual = n

    def handle_startendtag(self, tag, attrs):
        self.atual.filhos.append(No(tag, attrs, self.atual))

    def handle_endtag(self, tag):
        n = self.atual
        while n is not self.raiz and n.tag != tag:
            n = n.pai
        if n is not self.raiz:
            self.atual = n.pai

    def handle_data(self, data):
        self.atual.filhos.append(data)


def arvore(html):
    a = Arvore()
    a.feed(html)
    return a.raiz


def esc(t):
    return H.escape(t, quote=True)


class Conversor:
    def __init__(self, mapa, anexos, rotas):
        self.mapa, self.anexos, self.rotas = mapa, anexos, rotas
        self.usadas = set()

    def midia_img(self, src):
        for k in (src, H.escape(src, quote=False), src.replace("&", "&amp;")):
            if k in self.mapa:
                self.usadas.add(self.mapa[k]["arquivo"])
                return self.mapa[k]
        return None

    def anexo(self, href):
        for k in (href, href.replace("&amp;", "&")):
            if k in self.anexos:
                self.usadas.add(self.anexos[k]["arquivo"])
                return self.anexos[k]
        return None

    def link(self, href):
        href = href.replace("&amp;", "&")
        if re.match(r"^https?://", href):
            href = re.sub(r"/cpsess\d+/.*$", "/", href)  # tira tokens de sessão do webmail
            return href
        a = self.anexo(href)
        if a:
            return "/midia/" + a["arquivo"]
        caminho = href.split("#")[0].strip("/")
        caminho = re.sub(r"^(pt-br|en)/", "", caminho)
        if caminho in self.rotas:
            tid, etapa = self.rotas[caminho]
            return f"#/t/{tid}?etapa={etapa}"
        if href.startswith("#"):
            return ""
        return ORIGEM + "/" + caminho if caminho else ""

    # HTML interno (inline) já limpo; imagens são retiradas para blocos próprios
    def inline(self, n, imgs):
        out = []
        for f in n.filhos:
            if isinstance(f, str):
                out.append(esc(f))
                continue
            t = f.tag
            if t == "img":
                imgs.append(f)
                continue
            if t == "a" and "toc-anchor" in f.attrs.get("class", ""):
                continue
            if t == "br":
                out.append("<br>")
                continue
            inner = self.inline(f, imgs)
            if t == "a":
                href = self.link(f.attrs.get("href", ""))
                out.append(f'<a href="{esc(href)}">{inner}</a>' if href else inner)
            elif t in ("strong", "b"):
                out.append(f"<strong>{inner}</strong>" if inner.strip() else inner)
            elif t in ("em", "i"):
                out.append(f"<em>{inner}</em>" if inner.strip() else inner)
            elif t in ("u", "s", "code", "mark", "kbd", "sub", "sup", "small"):
                out.append(f"<{t}>{inner}</{t}>")
            elif t in ("ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "blockquote", "pre", "hr"):
                if t == "hr":
                    out.append("<hr>")
                else:
                    out.append(f"<{t}>{inner}</{t}>")
            elif t == "p":
                out.append(f"<p>{inner}</p>")
            elif t in ("h1", "h2", "h3", "h4", "h5", "h6"):
                out.append(f"<h4>{inner}</h4>")
            else:
                out.append(inner)
        return "".join(out)

    def bloco_img(self, img):
        src = img.attrs.get("src", "")
        m = self.midia_img(src)
        if not m:
            return None
        alt = img.attrs.get("alt", "")
        if re.match(r"^[\w\-().%]+\.(png|jpe?g|gif|webp)$", alt, re.I):
            alt = ""
        larga = m.get("w", 0) >= 1400
        return {"tipo": "imagem", "src": "/midia/" + m["arquivo"], "legenda": "", "alt": alt, "w": m.get("w", 0), "h": m.get("h", 0),
                "largura": "larga" if larga else "normal", "marcadores": []}

    def youtube(self, href):
        href = href.replace("&amp;", "&")
        m = re.search(r"(?:youtube\.com/watch\?[^\s]*v=|youtu\.be/|youtube\.com/embed/)([\w-]{11})", href)
        return m and m.group(1)

    def converter(self, html, modo_grupo):
        raiz = arvore(html)
        blocos = []
        secoes = []  # (titulo, blocos) quando a página é dividida por h1/h2
        fala_pendente = [None]

        def add(b):
            if not b:
                return
            if b["tipo"] == "texto":
                if not re.sub(r"<[^>]+>|\s|&nbsp;", "", b["html"]):
                    return
                if blocos and blocos[-1]["tipo"] == "texto":
                    blocos[-1]["html"] += b["html"]
                    return
            if b["tipo"] == "dialogo" and blocos and blocos[-1]["tipo"] == "dialogo":
                blocos[-1]["falas"] += b["falas"]
                return
            blocos.append(b)

        def emitir_imgs(imgs):
            for i in imgs:
                add(self.bloco_img(i))

        def processar(n):
            if isinstance(n, str):
                if n.strip():
                    add({"tipo": "texto", "html": f"<p>{esc(n.strip())}</p>"})
                return
            t = n.tag
            cls = n.attrs.get("class", "")
            texto = re.sub(r"\s+", " ", n.texto().replace("¶", "")).strip()
            if t in ("h1", "h2"):
                if modo_grupo:
                    imgs = []
                    inner = self.inline(n, imgs).replace("¶", "").strip()
                    if texto:
                        add({"tipo": "texto", "html": f"<h3>{inner}</h3>"})
                    emitir_imgs(imgs)
                else:
                    secoes.append((texto, len(blocos)))
                    imgs = []
                    self.inline(n, imgs)
                    emitir_imgs(imgs)
                return
            if t in ("h3", "h4", "h5", "h6"):
                if re.match(r"^(atendente|consultor|t[ée]cnico)\s*:?\s*$", texto, re.I):
                    fala_pendente[0] = "tecnico" if texto.lower().startswith("t") else "atendente"
                    return
                imgs = []
                inner = self.inline(n, imgs).strip()
                if texto:
                    add({"tipo": "texto", "html": f"<{'h3' if t == 'h3' else 'h4'}>{inner}</{'h3' if t == 'h3' else 'h4'}>"})
                emitir_imgs(imgs)
                return
            if t == "pre":
                cod = n.texto().strip("\n")
                if fala_pendente[0]:
                    add({"tipo": "dialogo", "falas": [{"quem": fala_pendente[0], "texto": cod.strip()}]})
                    fala_pendente[0] = None
                else:
                    add({"tipo": "codigo", "rotulo": "", "texto": cod})
                return
            fala_pendente[0] = None if t not in ("blockquote",) else fala_pendente[0]
            if t == "blockquote":
                links = list(n.achar("a"))
                if links and all("is-asset-link" in a.attrs.get("class", "") or self.anexo(a.attrs.get("href", "")) for a in links) and len(texto) < 160:
                    for a in links:
                        an = self.anexo(a.attrs.get("href", ""))
                        if an:
                            add({"tipo": "arquivo", "src": "/midia/" + an["arquivo"], "nome": re.sub(r"\s+", " ", a.texto()).strip() or an["nome"], "descricao": ""})
                    return
                if re.match(r"^cliente\b", texto, re.I) and blocos and blocos[-1]["tipo"] == "dialogo":
                    add({"tipo": "dialogo", "falas": [{"quem": "cliente", "texto": re.sub(r"^cliente\s*:?\s*", "", texto, flags=re.I)}]})
                    return
                estilo = "info"
                if "is-warning" in cls or "is-danger" in cls:
                    estilo = "atencao"
                elif "is-success" in cls:
                    estilo = "sucesso"
                imgs = []
                inner = self.inline(n, imgs).strip()
                if re.sub(r"<[^>]+>|\s", "", inner):
                    add({"tipo": "aviso", "estilo": estilo, "titulo": "", "html": inner})
                emitir_imgs(imgs)
                return
            if t == "p" or t == "div" or t == "figure":
                links = list(n.achar("a"))
                yts = [(a, self.youtube(a.attrs.get("href", ""))) for a in links]
                yts = [(a, y) for a, y in yts if y]
                if yts:
                    resto = texto
                    for a, _ in yts:
                        resto = resto.replace(re.sub(r"\s+", " ", a.texto()).strip(), "")
                    resto = resto.strip(" :-–")
                    for a, y in yts:
                        add({"tipo": "video", "src": f"https://www.youtube.com/watch?v={y}", "titulo": resto[:160], "legenda": "", "capa": ""})
                    return
                if links and all(self.anexo(a.attrs.get("href", "")) for a in links) and len(texto) < 200:
                    for a in links:
                        an = self.anexo(a.attrs.get("href", ""))
                        add({"tipo": "arquivo", "src": "/midia/" + an["arquivo"], "nome": re.sub(r"\s+", " ", a.texto()).strip() or an["nome"], "descricao": ""})
                    return
                imgs = []
                inner = self.inline(n, imgs).strip()
                if t == "div" and any(isinstance(f, No) and f.tag in TAG_BLOCO for f in n.filhos):
                    for f in n.filhos:
                        processar(f)
                    return
                if re.sub(r"<[^>]+>|\s|&nbsp;", "", inner):
                    add({"tipo": "texto", "html": f"<p>{inner}</p>"})
                emitir_imgs(imgs)
                return
            if t in ("ul", "ol"):
                itens = [f for f in n.filhos if isinstance(f, No) and f.tag == "li"]
                # lista só de anexos ou só de links externos
                if itens and all(any(self.anexo(a.attrs.get("href", "")) for a in li.achar("a")) for li in itens):
                    for li in itens:
                        for a in li.achar("a"):
                            an = self.anexo(a.attrs.get("href", ""))
                            if an:
                                add({"tipo": "arquivo", "src": "/midia/" + an["arquivo"], "nome": re.sub(r"\s+", " ", a.texto()).strip() or an["nome"], "descricao": ""})
                    return
                imgs = []
                lis = [self.inline(li, imgs).strip() for li in itens]
                if t == "ol" and lis:
                    add({"tipo": "passos", "itens": [x for x in lis if x]})
                elif lis:
                    add({"tipo": "texto", "html": "<ul>" + "".join(f"<li>{x}</li>" for x in lis) + "</ul>"})
                emitir_imgs(imgs)
                return
            if t == "table":
                imgs = []
                inner = self.inline(n, imgs)
                add({"tipo": "texto", "html": f"<table>{inner}</table>"})
                emitir_imgs(imgs)
                return
            if t == "hr":
                return
            if t == "img":
                add(self.bloco_img(n))
                return
            imgs = []
            inner = self.inline(n, imgs).strip()
            if inner:
                add({"tipo": "texto", "html": f"<p>{inner}</p>"})
            emitir_imgs(imgs)

        for f in raiz.filhos:
            processar(f)
        return blocos, secoes


SIGLAS = {"IXC", "OLT", "ONU", "ONT", "CTO", "SGP", "TV", "SVA", "SVAS", "CPF", "CNPJ", "NE8000", "OS", "O.S", "UPDOWN", "LOS", "PDF",
          "SSID", "PPPOE", "NAT", "DMZ", "UPNP", "IP", "PJ", "VPN", "L2L", "TCP/IP", "OLT", "SMARTOLT", "FTTH", "GPON", "UPMAX", "CEP"}
TROCAS = {"PPPOE": "PPPoE", "WIFI": "Wi-Fi", "VOIP": "VoIP", "UPNP": "UPnP", "SMARTOLT": "Smart OLT", "SVAS": "SVAs", "UPDOWN": "UPDOWN"}


def titulo_bonito(t):
    t = re.sub(r"\s+", " ", (t or "").replace("¶", "")).strip(" :|-")
    letras = [c for c in t if c.isalpha()]
    if letras and sum(c.isupper() for c in letras) / len(letras) > 0.8:
        palavras = []
        for i, w in enumerate(t.split(" ")):
            base = re.sub(r"[^\w/.]", "", w).upper()
            if base in TROCAS:
                palavras.append(w.upper().replace(base, TROCAS[base]))
            elif base in SIGLAS:
                palavras.append(w.upper())
            else:
                palavras.append(w.lower())
        t = " ".join(palavras)
        t = t[:1].upper() + t[1:]
    return t


COMANDO = re.compile(r"(^\s*[#<\[]|display |interface |undo |sysname|\bconfig\b|ping |tracert|ipconfig|netsh|\w+>|^\s*\w+(-\w+)+\s*$)", re.I | re.M)


def dialogar(blocos):
    """Em scripts: falas em bloco de código viram balões do atendente e as falas do cliente viram balões do cliente."""
    out = []
    for b in blocos:
        if b["tipo"] == "codigo" and len(b["texto"].split()) >= 4 and not COMANDO.search(b["texto"]):
            b = {"tipo": "dialogo", "falas": [{"quem": "atendente", "texto": b["texto"].strip()}]}
        elif b["tipo"] in ("aviso", "texto"):
            txt = re.sub(r"<[^>]+>", "", b.get("html", "")).strip()
            m = re.match(r"^cliente\s*(relata|diz|fala|escolhe|responde|pergunta)?\b[^:]*:?\s*(.*)$", txt, re.I | re.S)
            if m and len(txt) < 400 and (out and out[-1]["tipo"] == "dialogo"):
                b = {"tipo": "dialogo", "falas": [{"quem": "cliente", "texto": txt}]}
        if b["tipo"] == "dialogo" and out and out[-1]["tipo"] == "dialogo":
            out[-1]["falas"] += b["falas"]
            continue
        out.append(b)
    return out


def main():
    origem, destino = Path(sys.argv[1]), Path(sys.argv[2])
    d = json.loads((origem / "pages.json").read_text())
    anexos = json.loads((origem / "anexos.json").read_text())
    paginas = {p["id"]: p for p in d["pages"] if p.get("render") is not None}
    mapa = d["mapa"]

    # rota da wiki → (treinamento, etapa) para refazer os links internos
    rotas = {}
    for tid, _, _, _, _, _, ids, *_ in TRILHAS:
        for i, pid in enumerate(ids):
            if pid in paginas:
                rotas[paginas[pid]["path"]] = (tid, i if len(ids) > 1 else 0)

    conv = Conversor(mapa, anexos, rotas)
    contador = [0]

    def bid(p="b"):
        contador[0] += 1
        return f"{p}{contador[0]:06d}"

    treinos = []
    agora = "2026-11-17T20:00:00.000Z"
    for tid, titulo, setores, categoria, icone, nivel, ids, resumo, tags in TRILHAS:
        etapas = []
        grupo = len(ids) > 1
        tags_wiki = []
        atualizado = ""
        for pid in ids:
            p = paginas.get(pid)
            if not p:
                continue
            tags_wiki += [t["tag"] for t in p.get("tags", [])]
            atualizado = max(atualizado, p.get("updatedAt", ""))
            blocos, secoes = conv.converter(p["render"], grupo)
            if categoria in ("Scripts de atendimento", "Vendas"):
                blocos = dialogar(blocos)
            divide = not grupo and 2 <= len(secoes) <= 12 and len(blocos) / len(secoes) >= 3
            if divide:
                pontos = secoes + [(None, len(blocos))]
                if pontos[0][1] > 0:
                    etapas.append({"titulo": "Introdução", "blocos": blocos[: pontos[0][1]]})
                for (t, ini), (_, fim) in zip(pontos, pontos[1:]):
                    if fim > ini:
                        etapas.append({"titulo": titulo_bonito(t)[:160], "blocos": blocos[ini:fim]})
                    elif etapas:
                        pass
            else:
                tt = (p.get("title") or "").strip() or titulo
                if not grupo and secoes:
                    # página única sem divisão: os títulos voltam para dentro do texto
                    for ttl, pos in reversed(secoes):
                        if pos == 0 and ttl.strip().lower() == tt.strip().lower():
                            continue
                        blocos.insert(pos, {"tipo": "texto", "html": f"<h3>{esc(titulo_bonito(ttl))}</h3>"})
                etapas.append({"titulo": titulo_bonito(re.sub(r"\s*\|\s*Script\s*$", "", tt))[:160], "blocos": blocos})
        for e in etapas:
            e["id"] = bid("e")
            for b in e["blocos"]:
                b["id"] = bid()
        palavras = len(re.findall(r"\w+", json.dumps(etapas, ensure_ascii=False)))
        treinos.append({
            "id": tid, "titulo": titulo, "resumo": resumo, "setores": setores, "categoria": categoria,
            "tags": sorted(set(x.lower() for x in tags + tags_wiki))[:30], "capa": "", "icone": icone, "nivel": nivel,
            "duracao": max(3, min(60, round(palavras / 180))), "publicado": True, "destaque": False, "etapas": etapas,
            "origem": f"{ORIGEM}/" + paginas[ids[0]]["path"] if ids and ids[0] in paginas else "",
            "autor": "Wiki UPDOWN", "criado_em": atualizado or agora, "atualizado_em": atualizado or agora,
            "atualizado_por": "Importação da wiki", "visualizacoes": 0,
        })

    (destino / "midia").mkdir(parents=True, exist_ok=True)
    for nome in sorted(conv.usadas):
        shutil.copy2(origem / "midia" / nome, destino / "midia" / nome)
    (destino / "treinamentos-wiki.json").write_text(json.dumps({"treinamentos": treinos}, ensure_ascii=False, indent=1))
    usadas_paginas = {pid for t in TRILHAS for pid in t[6]}
    sobrou = [(p["id"], p["path"]) for p in paginas.values() if p["id"] not in usadas_paginas]
    print(f"{len(treinos)} treinamentos, {sum(len(t['etapas']) for t in treinos)} etapas, {len(conv.usadas)} arquivos de mídia")
    print("páginas não usadas:", sobrou)


if __name__ == "__main__":
    main()
