#!/usr/bin/env python3
"""Monta conteudo/treinamentos.json: o que veio da wiki + os treinamentos feitos para a plataforma.

  python3 -I scripts/montar-conteudo.py conteudo/
"""
import json
import re
import sys
from pathlib import Path

pasta = Path(sys.argv[1])
wiki = json.loads((pasta / "treinamentos-wiki.json").read_text())["treinamentos"]
texto_interativo = (pasta / "processo-de-atendimento.txt").read_text() if (pasta / "processo-de-atendimento.txt").exists() else ""

# Títulos de etapa mais claros que os nomes das páginas da wiki
TITULOS = {
    ("atendimento-n1-no-ixc", 0): "Consultar o cliente e o status do contrato",
    ("atendimento-n1-no-ixc", 1): "Histórico de atendimentos",
    ("atendimento-n1-no-ixc", 2): "Abrir o atendimento",
    ("atendimento-n1-no-ixc", 3): "Abrir a ordem de serviço",
    ("atendimento-n1-no-ixc", 4): "Consultar ordens de serviço",
    ("smart-olt-sinal-e-logs", 0): "Conhecendo o Smart OLT",
    ("smart-olt-sinal-e-logs", 1): "Informações do cliente",
    ("smart-olt-sinal-e-logs", 2): "Get Status: logs do equipamento",
    ("smart-olt-sinal-e-logs", 3): "Logs da ONU: LOS, LOSi, LOFi, SFI e Dying Gasp",
    ("smart-olt-sinal-e-logs", 4): "Sinal óptico do cliente",
    ("smart-olt-sinal-e-logs", 5): "Resumo dos logs",
    ("smart-olt-sinal-e-logs", 6): "Identificando o segundo contrato",
    ("scripts-de-suporte-tecnico", 0): "Sinal óptico crítico",
    ("scripts-de-suporte-tecnico", 1): "Problemas de navegação e Downdetector",
    ("scripts-de-suporte-tecnico", 2): "Lentidão: perguntas para entender o caso",
    ("documentos-e-materiais", 0): "Documentos em PDF",
    ("documentos-e-materiais", 1): "Apresentações no Canva",
    ("videos-e-cursos-tecnicos", 0): "Vídeos técnicos",
    ("videos-e-cursos-tecnicos", 1): "Cursos gratuitos",
    ("videos-e-cursos-tecnicos", 2): "Cursos avançados (NOC)",
    ("svas-e-adicionais", 0): "Novos planos com SVAs",
    ("svas-e-adicionais", 1): "Produtos à la carte",
    ("svas-e-adicionais", 2): "Incluindo o Watch TV no contrato",
    ("quebra-de-objecoes", 0): "Objeções sobre planos",
    ("quebra-de-objecoes", 1): "\"Tá caro\": como responder",
    ("quebra-de-objecoes", 2): "Estratégias de venda",
    ("quebra-de-objecoes", 3): "Upgrade",
    ("quebra-de-objecoes", 4): "Reversão de cancelamento",
    ("planos-vigentes", 0): "Tabela de planos vigentes",
    ("planos-vigentes", 1): "Como explicar os planos",
    ("planos-vigentes", 2): "Planos com adicionais",
    ("planos-vigentes", 3): "Planos com Watch, Paramount e Leveduca",
    ("vencimento-suspensao-cobrancas", 0): "Mudar a data de vencimento",
    ("vencimento-suspensao-cobrancas", 1): "Suspensão temporária",
    ("vencimento-suspensao-cobrancas", 2): "Gerar cobranças de taxas e serviços",
    ("assinatura-de-contratos", 0): "ZapSign",
    ("assinatura-de-contratos", 1): "IXC Assina: gerar o link",
    ("assinatura-de-contratos", 2): "Como o cliente assina",
    ("assinatura-de-contratos", 3): "Autentique",
    ("cadastro-do-cliente", 0): "Dados e documentos obrigatórios",
    ("cadastro-do-cliente", 1): "Cadastro no IXC (prospecção)",
    ("cadastro-do-cliente", 2): "Cadastro de CNPJ",
    ("fiberdocs-e-viabilidade", 0): "Pesquisando no Fiberdocs",
    ("fiberdocs-e-viabilidade", 1): "Porta disponível na CTO",
    ("provisionamento-de-cliente", 0): "Processo obrigatório",
    ("provisionamento-de-cliente", 1): "Passo a passo no SGP e no Smart OLT",
    ("provisionamento-de-cliente", 2): "Fotos exigidas na ativação",
    ("comandos-huawei", 0): "Comandos de verificação",
    ("comandos-huawei", 1): "Comandos por assunto",
    ("comandos-huawei", 2): "Documentação de referência",
    ("olt-huawei-configuracao", 0): "Configurações iniciais",
    ("olt-huawei-configuracao", 1): "Comandos da OLT",
    ("setor-comercial-spin-selling", 0): "Objetivos e SPIN Selling",
    ("setor-comercial-spin-selling", 1): "Missão, visão e valores",
    ("faq-tecnico", 0): "Perguntas e respostas",
    ("script-de-atendimento-n1", 0): "Do primeiro contato ao encerramento",
    ("small-business", 0): "Small Business",
    ("links-de-sistemas", 0): "Sistemas",
    ("links-de-sistemas", 1): "Serviços",
}
for t in wiki:
    for i, e in enumerate(t["etapas"]):
        if (t["id"], i) in TITULOS:
            e["titulo"] = TITULOS[(t["id"], i)]

AGORA = "2026-11-17T20:00:00.000Z"
n = [0]


def bid(p="n"):
    n[0] += 1
    return f"{p}{n[0]:05d}"


def treino(**k):
    base = dict(resumo="", setores=[], categoria="", tags=[], capa="", icone="", nivel="basico", duracao=10, publicado=True,
                destaque=False, origem="", autor="UPDOWN", criado_em=AGORA, atualizado_em=AGORA, atualizado_por="UPDOWN", visualizacoes=0)
    base.update(k)
    for e in base["etapas"]:
        e["id"] = bid("e")
        for b in e["blocos"]:
            b["id"] = bid()
    return base


interativo = treino(
    id="processo-de-atendimento", titulo="Processo de atendimento UPDOWN (interativo)",
    resumo="As 7 etapas do atendimento, do atendimento encantador ao encerramento, com fluxograma, onboarding e tutoriais. Navegue clicando nas etapas.",
    setores=["atendimento"], categoria="Processos", icone="headset", nivel="basico", duracao=20, destaque=True,
    tags=["processo", "atendimento encantador", "fluxograma", "onboarding", "sinal", "logs", "firmware", "canal", "rssi", "mcs"],
    etapas=[{"titulo": "Processo de atendimento", "blocos": [
        {"tipo": "aviso", "estilo": "dica", "titulo": "Como usar", "html": "<p>Este treinamento é interativo: use as abas <strong>Processo</strong>, <strong>Onboarding</strong>, <strong>Fluxograma</strong> e <strong>Tutoriais</strong> e avance pelas etapas com os botões no fim do quadro. Para ver em tela cheia, clique em <strong>Tela cheia</strong>.</p>"},
        {"tipo": "interativo", "src": "/midia/processo-de-atendimento-updown.html", "titulo": "Processo de atendimento UPDOWN", "altura": 900, "texto": texto_interativo},
    ]}],
)

diagnostico = treino(
    id="primeiro-diagnostico-sem-conexao", titulo="Primeiro diagnóstico: cliente sem conexão",
    resumo="O roteiro de 4 verificações antes de abrir uma visita: status no IXC, sinal no Smart OLT, logs da ONU e abertura da O.S.",
    setores=["atendimento"], categoria="Diagnóstico", icone="sinal", nivel="basico", duracao=8, destaque=True,
    tags=["sem conexão", "sem internet", "caiu", "los", "sinal", "o.s", "visita técnica", "diagnóstico"],
    etapas=[
        {"titulo": "O roteiro em 4 passos", "blocos": [
            {"tipo": "texto", "html": "<p>Quando o cliente diz que está <strong>sem internet</strong>, siga sempre a mesma ordem. Em menos de dois minutos você sabe se o problema é financeiro, de sinal, de energia ou se precisa de visita.</p>"},
            {"tipo": "animacao", "modo": "sequencia", "titulo": "Diagnóstico rápido", "intervalo": 5, "transicao": "deslizar", "quadros": [
                {"src": "/midia/wiki-a32ebaf4e0a8.webp", "titulo": "1. Status do contrato no IXC", "texto": "Bloqueio automático ou financeiro em atraso? Resolva com o financeiro antes de qualquer teste técnico."},
                {"src": "/midia/wiki-a816709f6a94.webp", "titulo": "2. Sinal no Smart OLT", "texto": "Online e entre -19 e -24 dBm: sinal bom. -28 dBm ou pior: crítico, precisa de correção."},
                {"src": "/midia/wiki-5c1d42fe5941.webp", "titulo": "3. Logs da ONU", "texto": "LOS = sem sinal (cabo ou CTO). Dying Gasp = sem energia. LOSi/LOFi = interferência óptica."},
                {"src": "/midia/wiki-99cc58276daa.webp", "titulo": "4. Abrir a O.S. se precisar", "texto": "Testes feitos e o problema continua? Abra a O.S. com o relato completo para o técnico."},
            ]},
            {"tipo": "checklist", "titulo": "Antes de abrir visita, confirme", "itens": [
                "Contrato ativo e sem bloqueio financeiro",
                "Sinal óptico e status da ONU conferidos no Smart OLT",
                "Logs analisados (LOS, LOSi, LOFi, SFI, Dying Gasp)",
                "Cliente confirmou energia, tomada e botão do equipamento",
                "Verificado se outros clientes da mesma CTO estão fora (rompimento)",
            ]},
        ]},
        {"titulo": "Status do contrato no IXC", "blocos": [
            {"tipo": "imagem", "src": "/midia/wiki-a32ebaf4e0a8.webp", "w": 1239, "h": 443, "largura": "larga", "alt": "Cadastro do cliente no IXC",
             "legenda": "Passe o mouse ou toque nos pontos para ver o que conferir.", "marcadores": [
                 {"x": 12, "y": 63, "texto": "Status do contrato: aqui aparece Ativo, Financeiro em atraso ou Bloqueio automático."},
                 {"x": 72, "y": 62, "texto": "Status redução: Normal ou Reduzido. Se estiver reduzido, a velocidade foi limitada por pendência."},
             ]},
            {"tipo": "aviso", "estilo": "atencao", "titulo": "Bloqueado por motivo financeiro", "html": "<p>Escalone para o <strong>setor financeiro</strong> ou ofereça a <a href=\"#/t/liberacao-temporaria\">liberação temporária</a> dentro do prazo permitido.</p>"},
        ]},
        {"titulo": "Sinal e logs no Smart OLT", "blocos": [
            {"tipo": "imagem", "src": "/midia/wiki-a816709f6a94.webp", "w": 1052, "h": 540, "largura": "normal", "alt": "Lista de ONUs no Smart OLT", "legenda": "", "marcadores": [
                {"x": 12, "y": 55, "texto": "Barrinhas vermelhas: sinal crítico."},
                {"x": 18, "y": 55, "texto": "Valor do sinal em dBm. Quanto mais perto de zero, melhor: -20 é melhor que -26."},
            ]},
            {"tipo": "texto", "html": "<table><thead><tr><th>Sinal</th><th>Situação</th><th>O que fazer</th></tr></thead><tbody><tr><td>-19 a -24 dBm</td><td>Bom</td><td>Siga para os logs</td></tr><tr><td>-25 a -27 dBm</td><td>Irregular</td><td>Pode oscilar; avalie com os logs</td></tr><tr><td>-28 dBm ou pior</td><td>Crítico</td><td>Abrir visita para correção</td></tr></tbody></table>"},
            {"tipo": "aviso", "estilo": "dica", "titulo": "Quer se aprofundar?", "html": "<p>Veja o treinamento <a href=\"#/t/smart-olt-sinal-e-logs\">Smart OLT: sinal óptico, logs e diagnóstico da ONU</a>.</p>"},
        ]},
        {"titulo": "O que falar com o cliente", "blocos": [
            {"tipo": "dialogo", "falas": [
                {"quem": "cliente", "texto": "Estou sem internet desde cedo."},
                {"quem": "atendente", "texto": "Poxa, entendo. Vou verificar agora mesmo! A luz vermelha (LOS) do seu equipamento está piscando?"},
                {"quem": "cliente", "texto": "Está sim, vermelha piscando."},
                {"quem": "atendente", "texto": "Obrigado! Isso indica que o sinal da fibra não está chegando. Vou agendar a visita de um técnico para corrigir. Tenho uma vaga no dia (data), posso agendar?"},
            ]},
            {"tipo": "video", "src": "https://www.youtube.com/watch?v=CdfM_1Env3o", "titulo": "Qual a maneira certa de medir o sinal do cliente FTTH", "legenda": ""},
        ]},
    ],
)

guia = treino(
    id="como-usar-a-plataforma", titulo="Como usar a plataforma de treinamentos",
    resumo="Encontre respostas pela busca, acompanhe seu progresso e, se você é editor, crie treinamentos com imagens, vídeos e animações.",
    setores=[], categoria="Plataforma", icone="ajuda", nivel="basico", duracao=4,
    tags=["ajuda", "busca", "editor", "criar treinamento", "como usar"],
    etapas=[
        {"titulo": "Encontrando o que você precisa", "blocos": [
            {"tipo": "passos", "itens": [
                "Escreva a dúvida do jeito que você falaria, por exemplo <em>cliente sem internet com luz vermelha</em> ou <em>como mudar o vencimento</em>.",
                "A busca entende sinônimos do dia a dia: <em>wifi</em>, <em>roteador</em>, <em>boleto</em>, <em>O.S.</em>, <em>caiu</em>…",
                "Clique no resultado para abrir o treinamento direto na etapa que responde a sua dúvida.",
                "Use <kbd>/</kbd> em qualquer tela para ir direto para a busca.",
            ]},
            {"tipo": "aviso", "estilo": "info", "titulo": "Não achou?", "html": "<p>As buscas sem resultado aparecem para os editores, que criam o conteúdo que está faltando.</p>"},
        ]},
        {"titulo": "Seu progresso", "blocos": [
            {"tipo": "texto", "html": "<p>A plataforma lembra em que etapa você parou. Na página inicial, <strong>Continuar de onde parei</strong> leva você de volta. Ao terminar, marque <strong>Concluí este treinamento</strong>.</p>"},
        ]},
        {"titulo": "Para editores: criando um treinamento", "blocos": [
            {"tipo": "passos", "itens": [
                "Em <strong>Gerenciar</strong>, clique em <strong>Novo treinamento</strong>.",
                "Preencha título, resumo, setores (quem vai ver) e palavras-chave (ajudam a busca).",
                "Monte as etapas e, em cada uma, adicione blocos: texto, imagem, vídeo, animação, passo a passo, checklist, diálogo, código, aviso, anexo, links ou conteúdo interativo (HTML).",
                "Nas imagens, clique na foto para marcar pontos com explicação: eles aparecem pulsando para quem estiver estudando.",
                "Em <strong>Animação</strong>, envie um GIF/vídeo curto ou monte uma sequência de telas que passa sozinha.",
                "Use <strong>Pré-visualizar</strong> e depois <strong>Publicar</strong>.",
            ]},
            {"tipo": "aviso", "estilo": "dica", "titulo": "Quem pode editar", "html": "<p>Administradores do portal e quem tem o acesso <strong>Treinamentos · Editor</strong> liberado em portal.updown.com.br → Usuários.</p>"},
        ]},
    ],
)

todos = [diagnostico, interativo] + wiki + [guia]
(pasta / "treinamentos.json").write_text(json.dumps({"treinamentos": todos}, ensure_ascii=False, indent=1) + "\n")
print(len(todos), "treinamentos")
