# Central de Jogos: futebol, filmes e séries

Projeto pessoal. Mostra na tela os jogos de futebol do dia, com campeonato, escudos, horário de Brasília e logos dos canais onde vão passar.

## No celular (ou em qualquer lugar): site online

**https://micaelmushura-hobby.github.io/central-de-jogos/**

- Abra o link e toque em **Jogos de hoje**. Dica: no Chrome do celular, use "Adicionar à tela inicial" para ter um ícone.
- O GitHub Actions refaz a busca **a cada 30 minutos**, sem precisar do computador ligado. Ele lê CBF, ESPN, Olhar Digital e Lance!, e publica os jogos de hoje e de amanhã.
- O placar ao vivo é atualizado a cada minuto, direto da ESPN.
- O `index.html` enviado pelo WhatsApp também funciona: ele busca os dados nesse site.
- Para forçar uma atualização: no GitHub, abra **Actions → Atualizar site → Run workflow**.
- O GitHub pausa atualizações automáticas de repositórios sem alterações por 60 dias. Se isso acontecer, ele avisa por e-mail. Para reativar, abra **Actions → Atualizar site → Enable workflow**.

## No computador: busca na hora

1. Na pasta **Jogos**, dê dois cliques em **`Abrir Central de Jogos.bat`**.
   - Abre uma janela minimizada "Central de Jogos". É o programa que faz as buscas. **Deixe-a aberta** enquanto usa a página e feche quando terminar.
   - O Chrome abre sozinho em `http://127.0.0.1:8765/`.
2. Clique em **Jogos de hoje** e aguarde cerca de 20 segundos.
3. A lista aparece na própria página:
   - agrupada por campeonato, com o logo do campeonato;
   - escudo dos times;
   - horário de Brasília;
   - logos dos canais, ou "Transmissão não confirmada".
   - Jogos em andamento mostram **AO VIVO** com o placar; os encerrados ficam esmaecidos.
   - Use o campo de filtro para achar um time, campeonato ou canal (ex.: `premiere`), e o botão **Por horário** para ver manhã, tarde e noite.

**Nada é salvo no computador** ao consultar os jogos: a lista só aparece na tela.

Outros botões:
- **Jogos de uma data**: escolha a data no campo "Data".
- **Jogos de um time ou campeonato**: escreva, por exemplo, `Vasco` ou `Premier League`.

Depois que o programa estiver ligado, abrir o `index.html` direto também leva para a versão automática. Se ele estiver desligado, a página avisa e os botões montam um pedido para copiar e colar no Claude Code.

**Requisitos:** Node.js (já instalado) e Google Chrome ou Microsoft Edge (já instalados). Não usa chave de API, senha nem conta paga.

## De onde vêm as informações

| O quê | Fonte |
|---|---|
| Jogos, horário e estádio das Séries A e B | **CBF**, tabela oficial (lida com o Chrome em segundo plano) |
| Horário, escudos, cores e estádio dos demais jogos | **ESPN** (dados públicos do calendário) |
| Canais de TV e streaming no Brasil | Guia diário do **Olhar Digital** |
| Segunda conferência do horário | Guia diário do **Lance!** |
| Logos dos canais | **Wikimedia Commons** (domínio público ou CC), em `assets/logos/canais/fontes.json` |

- **"Hoje" é sempre a data de Brasília** (America/Sao_Paulo), e o programa busca o dia inteiro. Se você pedir às 8h, os jogos das 21h também aparecem, porque ele consulta o dia anterior e o seguinte em UTC e filtra pelo horário de Brasília.
- **Divergências:** quando as fontes discordam no horário, o jogo mostra "⚠ Divergência" com cada versão. Quando há horário da CBF, ele prevalece.
- **Transmissão:**
  - Os canais vêm de um guia. O banner mostra os logos e a `lista.html` indica a fonte.
  - Sem guia, aparece "Transmissão não confirmada". Isso acontece com jogos de outros dias, porque os guias saem no próprio dia, por volta das 8h.
  - Os canais não são conferidos nos sites das emissoras: vêm só do guia do Olhar Digital.
- **Não há geração de imagem por IA.** Os banners são montados com HTML/CSS e fotos reais de licença livre.
- **Escudos:** obtidos da ESPN. São marcas dos clubes. As artes trazem "Arte não oficial" e são para **uso pessoal**.

### Banners em PNG (opcional, pelo chat)

A página não gera mais imagens. Se algum dia você quiser um banner 9:16 de um jogo, peça no chat do Claude Code, por exemplo `/futebol-filmes-series crie o banner de Vasco x Flamengo`. Só nesse caso os arquivos vão para `saidas/`. Para usar uma foto sua de fundo, coloque-a em `assets/fundos/` com o nome do time (ex.: `vasco.jpg`).

## Filmes, séries e outros pedidos (pelo Claude Code)

Recomendações de filmes e séries precisam de pesquisa feita pelo Claude Code:
1. Na página, preencha gênero, plataforma ou título e clique no botão.
2. Clique em **Copiar pedido** e cole no chat do Claude Code no VS Code, com a pasta Jogos aberta.

Você também pode pedir direto no chat: `/futebol-filmes-series me recomenda uma série de suspense`.

## Preferências

Ficam em `dados/preferencias.md`, um arquivo que você pode editar. O Claude Code só registra o que você confirmar. Não há treinamento do modelo: a memória é esse arquivo.

## Estrutura

```
Jogos/
├── Abrir Central de Jogos.bat   ← dois cliques para usar
├── index.html                   ← a página com os botões
├── servidor/                    ← programa local (Node.js, sem dependências)
│   ├── servidor.js              ← páginas e API em 127.0.0.1:8765 (só no seu computador)
│   ├── busca.js                 ← lê CBF, ESPN, Olhar Digital e Lance!
│   ├── banner.js                ← modelos dos banners 9:16
│   ├── render.js                ← Chrome em segundo plano: PNG e leitura da CBF
│   ├── fotos.js                 ← fotos de estádio (Wikimedia, licença livre)
│   ├── canais.js                ← reconhece os canais e liga cada um ao seu logo
│   └── baixar-logos-canais.js   ← baixa ou atualiza os logos dos canais
├── assets/                      ← fontes (Oswald e Inter, OFL), logos, fotos e fundos
├── dados/preferencias.md
├── saidas/                      ← resultados (um arquivo ou pasta novo por pedido)
└── .claude/skills/futebol-filmes-series/   ← skill do Claude Code
```

## Limitações conhecidas

- Os guias de TV (Olhar Digital e Lance!) são sites de notícia. Se mudarem o formato, a leitura dos canais pode falhar. A página avisa quando uma fonte não abre.
- Jogos sem escudo na ESPN, como alguns times estrangeiros do futebol feminino, aparecem com a sigla dentro de um círculo.
- O Wikimedia limita consultas seguidas. Se a foto de um estádio não vier, o programa tenta de novo no próximo pedido.
- Para atualizar os logos dos canais: `node servidor/baixar-logos-canais.js`.
