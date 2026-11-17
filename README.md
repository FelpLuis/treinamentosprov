# Treinamentos UPDOWN

Plataforma de manuais, treinamentos e passo a passo da UPDOWN, separada por setor, em
**https://treinamentos.updown.com.br**.

- **Login único**: usa a sessão do [Portal UPDOWN](https://github.com/FelpLuis/portalprov) (`portal.updown.com.br`).
  Quem não está logado vai para o portal e volta direto para o treinamento que abriu.
- **Setores**: definidos no portal, em **Usuários → Setores**, e marcados no cadastro de cada usuário.
  Cada pessoa vê os treinamentos dos seus setores e os marcados para todos.
- **Busca por dúvida**: escreva do jeito que fala (“cliente sem internet com luz vermelha”). A busca
  entende sinônimos do provedor (Wi-Fi/roteador/ONU, boleto/fatura, O.S./ordem de serviço…), aponta a
  etapa que responde e registra as dúvidas sem resposta para os editores.
- **Editor** (administradores do portal e quem tem **Treinamentos · Editor**): etapas e blocos de
  texto, imagem com pontos explicativos animados, vídeo (envio ou YouTube/Vimeo), animação (GIF/vídeo em
  loop/HTML ou sequência de telas que passa sozinha), passo a passo, checklist, diálogo/script com botão
  de copiar, aviso, comando/código, anexo (PDF), links e conteúdo interativo em HTML.
- **Progresso**: continua de onde parou, marca etapas vistas e treinamentos concluídos; a gestão mostra
  visitas, conclusões e as buscas mais feitas.

## Conteúdo inicial

`conteudo/treinamentos.json` + `conteudo/midia/` são carregados na primeira subida:
40 treinamentos montados a partir das 78 páginas da wiki (`wiki.updowntelecom.com.br`), com as 328
imagens (otimizadas em WebP) e os 32 PDFs, mais:
- *Processo de atendimento UPDOWN (interativo)*;
- *Primeiro diagnóstico: cliente sem conexão* (exemplo com sequência animada, pontos na imagem, checklist, diálogo e vídeo);
- *Como usar a plataforma de treinamentos*.

Depois da primeira subida, o conteúdo vive em `DATA_DIR/treinamentos.json` e as mídias novas em
`DATA_DIR/midia/` — atualizações do código não sobrescrevem o que foi editado.

Para reimportar a wiki: `python3 -I scripts/importar-wiki.py <export> conteudo/ && python3 -I scripts/montar-conteudo.py conteudo/`.

## Como o login funciona

1. O portal grava o cookie `updown_sso` em `.updown.com.br`.
2. A cada requisição (com cache de 20 s) este servidor pergunta ao portal, pela rede interna,
   `GET http://127.0.0.1:8790/sso/quem?sistema=treinamentos,treinamentos-editor` repassando o cookie.
3. O portal responde usuário, setores e quais dos dois acessos ele tem. Desativar o usuário ou derrubar
   as sessões no portal corta o acesso aqui também.

## Instalar (servidor .13)

Passo a passo em [`deploy/servidor-13.md`](deploy/servidor-13.md). Resumo:

```bash
sudo bash deploy/instalar.sh     # /opt/treinamentos-updown, serviço treinamentos-updown em 127.0.0.1:8791
```

## Desenvolvimento

```bash
npm run dev     # http://127.0.0.1:8791 sem portal (DEV_USUARIO=luis.felipe, administrador)
npm test        # login pelo portal, setores, busca, editor, envio de mídia, progresso
```

Sem dependências npm (Node.js 18+). Fontes Sora e Inter incluídas (SIL OFL).

## Segurança

- HTML dos blocos de texto passa por lista de tags permitidas no servidor (sem scripts, eventos ou `javascript:`).
- Mídias só podem apontar para arquivos enviados (`/midia/…`); vídeos externos só YouTube/Vimeo/HTTPS.
- HTML enviado (interativos/animações) é servido com `Content-Security-Policy: sandbox`, isolado da sessão.
- Escritas exigem o cabeçalho `X-Treinamentos` (CSRF); CSP restritiva no app.
