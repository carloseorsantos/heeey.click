# Pastas, Organização & Lixeira

O Dashboard do Heeey oferece uma experiência completa para estruturar, classificar e proteger seus quadros de trabalho.

---

## 📁 Pastas Hierárquicas

Para manter projetos, equipes ou matérias organizadas, você pode criar árvores de pastas com profundidade ilimitada:

- **Criação de Pastas**: No Dashboard, clique em **"Nova Pasta"**, digite o nome e escolha se ela ficará na raiz ou dentro de uma pasta existente.
- **Navegação com Breadcrumbs**: Caminho visual completo (ex.: `Início > Design System > Componentes Web`) que permite saltar para qualquer nível intermediário com um clique.
- **Mover Quadros**:
  - No menu de três pontos de qualquer cartão de quadro, selecione **"Mover para pasta"**.
  - A árvore completa é apresentada, permitindo realocar o quadro para qualquer pasta ou de volta à raiz.
- **Exclusão de Pastas**:
  - Ao excluir uma pasta que contém subpastas, todas as subpastas são removidas recursivamente.
  - **Segurança de Conteúdo**: Os quadros que estavam dentro da pasta excluída **não são apagados**; eles retornam com segurança para o nível raiz do seu painel (`folder_id = null`).

---

## 🗑️ Lixeira (Soft Delete) & Proteção contra Exclusão Acidental

O Heeey adota um modelo de exclusão em duas etapas:

### 1. Enviar para a Lixeira
- Mover um quadro para a lixeira atualiza o campo `deleted_at = now()`.
- O quadro desaparece imediatamente das listagens ativas, das pastas e das buscas padrão.
- Se o quadro estiver aberto por alguém durante o descarte, ele entra automaticamente em modo somente leitura com um banner informativo superior.

### 2. Restauração
- A qualquer momento, acesse a aba **"Lixeira"** no Dashboard.
- Clique no botão de restauração do cartão para devolver o quadro à sua pasta original.
- Um toast de desfazer (*Undo*) também é exibido logo após qualquer exclusão acidental.

### 3. Exclusão Permanente
- Apenas o proprietário autenticado pode solicitar a exclusão definitiva de um quadro na lixeira.
- A exclusão definitiva remove:
  - O registro do quadro na tabela `boards`.
  - Todas as imagens associadas no bucket `board-media` do Supabase Storage.
  - Todas as versões históricas em `board_versions`.
- Quadros que ficam mais de **30 dias** na lixeira são excluídos definitivamente de forma automática, uma vez por dia (Vercel Cron em `/api/cron/purge`, que chama `public.purge_expired_data()`).

---

## 🖼️ Miniaturas Inteligentes (Thumbnails)

Para que o Dashboard carregue instantaneamente mesmo com dezenas de quadros complexos:
- Enquanto você desenha, uma miniatura rasterizada em **WebP** (`maxWidthOrHeight = 480px`, qualidade 0.7) é renderizada em segundo plano no cliente a cada 20 segundos de atividade.
- A string codificada em base64 é salva na coluna `thumbnail` da tabela `boards`.
- O Dashboard baixa apenas os metadados e as miniaturas compactas (`fetchBoardSummaries`), sem precisar fazer download dos elementos brutos de dezenas de cenas completas.
- No modo escuro do Dashboard, um filtro visual CSS inverte harmoniosamente as miniaturas claras sem exigir processamento gráfico adicional.

---

## 📑 Modelos Iniciais (Templates)

Ao criar um novo quadro, você pode partir de templates prontos:

1. **Brainstorming**:
   - Quadros temáticos com post-its coloridos agrupados por ideias, desafios e próximos passos.
2. **Fluxograma**:
   - Nós de processo pré-conectados com blocos de início, término e losango de decisão.
3. **Wireframe**:
   - Elementos estruturais de interface: barra de navegação, caixas de conteúdo e botões interativos.
