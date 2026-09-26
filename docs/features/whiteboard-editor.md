# Lousa & Ferramentas de Desenho

O Heeey é construído em torno da versão oficial do componente `@excalidraw/excalidraw` (0.18.x), oferecendo um canvas infinito vetorial com a renomada estética orgânica e feita à mão (*hand-drawn*).

---

## 🎨 Principais Ferramentas e Formas

A barra superior de ferramentas oferece suporte nativo para criação e manipulação vetorial:

| Ferramenta | Tecla de Atalho | Descrição |
|---|---|---|
| **Seleção** | `V` ou `1` | Move, redimensiona, agrupa e rotaciona elementos existentes. |
| **Retângulo** | `R` ou `2` | Desenha blocos, cartões e painéis com cantos retos ou arredondados. |
| **Losango (Diamond)** | `D` ou `3` | Ideal para decisões em fluxogramas e nós condicionais. |
| **Elipse / Círculo** | `E` ou `4` | Usado para inícios/fins de fluxos, anotações circulares e nós de redes. |
| **Seta Conectada** | `A` ou `5` | Conecta-se magneticamente às bordas das formas. Ajusta-se dinamicamente quando a forma é movida. |
| **Linha** | `L` ou `6` | Segmentos retos ou polilinhas para divisões e gráficos. |
| **Desenho Livre (Pen)** | `P` or `7` | Escrita à mão livre com sensibilidade à velocidade do traço. |
| **Texto** | `T` ou `8` | Texto avulso ou texto vinculado a formas (*bound text container*). |
| **Imagem** | `9` | Insere imagens (com otimização automática para WebP). |
| **Borracha** | `E` ou `0` | Apaga elementos ao clicar ou arrastar por cima. |
| **Laser Pointer** | `K` | Apontador laser temporário visível em tempo real para todos os participantes da sessão. |
| **Moldura (Frame)** | `F` | Agrupa logicamente elementos para exportação em lote ou apresentação. |

---

## 🔤 Texto Vinculado a Formas (Bound Text)

Uma das maiores facilidades no Heeey é o texto contido:
- Ao dar duplo clique em qualquer forma fechada (retângulo, elipse, losango), o texto digitado é automaticamente centralizado dentro do objeto.
- Se o elemento for movido ou redimensionado, o texto acompanha a forma.
- Ao deletar uma forma, o texto interno vinculado a ela é removido automaticamente, evitando elementos órfãos no canvas.
- No nível técnico, o Excalidraw cria um elemento de tipo `text` com `containerId` apontando para o `id` da forma, e a forma registra o `id` do texto em seu array `boundElements`.

---

## 📐 Conexão Inteligente de Setas

As setas no Heeey fornecem vínculo magnético real:
- Ao desenhar uma seta em direção a uma forma, os pontos de ancoragem se iluminam.
- Ao conectar, a seta preenche suas propriedades `startBinding` e `endBinding` com `{ elementId, focus, gap }`.
- Caso você reposicione a forma conectada, a seta recalcula sua curvatura e ângulo para manter a conexão intacta.
- Rótulos em setas (`arrow label`) também são suportados, centralizando-se no ponto médio do traço.

---

## 🌓 Modos Claro e Escuro (Dark Mode)

O Heeey adapta-se perfeitamente à preferência de sistema do usuário ou à alternância manual:
- O tema pode ser alterado no botão de alternância no Dashboard ou através do menu de preferências.
- No modo escuro, o canvas inverte suavemente as cores de fundo e os traços escuros ganham contraste para visualização noturna confortável.
- A paleta de exportação respeita as preferências de fundo configuradas no canvas.

---

## 💾 Exportação e Download

Você pode exportar seus diagramas em qualquer momento sem marcas d'água:
- **PNG**: Bitmap de alta resolução, ideal para apresentações e compartilhamento no Slack/Discord.
- **SVG**: Gráfico vetorial infinito e escalável, ideal para incorporar na web ou abrir em softwares como Figma ou Illustrator.
- O diálogo de exportação permite escolher se deseja incluir o fundo da tela ou gerar um arquivo com transparência.

### 🤖 Exportar para IA (Markdown)

No menu ☰ do canvas, **Exportar para IA** gera um arquivo Markdown com todo o conteúdo da lousa, para enviar ou colar em qualquer conversa com uma IA (ChatGPT, Claude, Gemini etc.):
- O modal mostra uma prévia do texto, com os botões **Baixar .md** e **Copiar para a área de transferência**.
- O arquivo traz o título da lousa, os textos, as formas com rótulo (losangos e elipses identificados), os frames como seções, as conexões no formato `A → B` (com o rótulo da seta) e os links. Imagens aparecem como `[imagem]`.
- Textos desenhados sobre uma forma contam como rótulo dela, e setas com a ponta encostada numa forma contam como conexão, mesmo sem vínculo.
- Os itens seguem a ordem de leitura (de cima para baixo, da esquerda para a direita). Coordenadas, cores e IDs ficam de fora.
- Usa o estado atual do canvas, está disponível também no modo leitura e roda só no navegador.
- Para a IA ler e editar as lousas direto, sem exportar, conecte o [servidor MCP](../mcp/getting-started.md).
