# Catálogo Completo de Ferramentas MCP do Heeey

Esta página descreve a especificação técnica detalhada de todas as **14 ferramentas MCP** disponibilizadas pelo servidor do Heeey em `https://heeey.click/api/mcp`.


Quadros ficam em **projetos** dentro de **times**. Use `list_projects` para saber onde a chave pode criar quadros; `list_boards`, `create_board`, `create_diagram`, `list_folders` e `create_folder` aceitam `project_id`. Quadros criados pelo MCP nascem restritos (só o time/projeto e quem for convidado abrem).

---

## 🗂️ Tabela de Referência Rápida

| Ferramenta | Escopo | Anotação MCP | Finalidade Principal |
|---|---|---|---|
| [`list_projects`](#14-list_projects) | `read` | `readOnlyHint: true` | Lista times e projetos que a chave alcança, com o seu acesso. |
| [`list_boards`](#1-list_boards) | `read` | `readOnlyHint: true` | Lista os quadros da conta do usuário. |
| [`search_boards`](#2-search_boards) | `read` | `readOnlyHint: true` | Busca full-text em títulos e texto desenhado no canvas. |
| [`get_board`](#3-get_board) | `read` | `readOnlyHint: true` | Lê metadados e elementos (compacto ou detalhado). |
| [`create_board`](#4-create_board) | `write` | — | Cria um novo quadro vazio ou com elementos. |
| [`add_elements`](#5-add_elements) | `write` | — | Insere novos elementos ou atualiza existentes reusando IDs. |
| [`delete_elements`](#6-delete_elements) | `write` | `destructiveHint: true` | Remove elementos por ID (rótulos de texto vão juntos). |
| [`rename_board`](#7-rename_board) | `write` | `idempotentHint: true` | Altera o título de exibição de um quadro. |
| [`trash_board`](#8-trash_board) | `write` | `destructiveHint: true`, `idempotentHint: true` | Envia um quadro para a lixeira (reversível). |
| [`create_diagram`](#9-create_diagram) | `write` | — | Desenha diagramas em camadas com layout automático Dagre. |
| [`layout_board`](#10-layout_board) | `write` | `idempotentHint: true` | Reorganiza e alinha um quadro existente automaticamente. |
| [`list_folders`](#11-list_folders) | `read` | `readOnlyHint: true` | Lista todas as pastas criadas na conta. |
| [`create_folder`](#12-create_folder) | `write` | — | Cria uma pasta na raiz ou dentro de outra pasta. |
| [`move_board`](#13-move_board) | `write` | `idempotentHint: true` | Move um quadro para uma pasta ou de volta à raiz. |

---

## 🛠️ Especificação Individual de Ferramentas

### 1. `list_boards`
> Lista os quadros pertencentes ao usuário, ordenados a partir dos editados mais recentemente.

- **Anotações**: `readOnlyHint: true`
- **Parâmetros de Entrada (`inputSchema`)**:
  - `folder_id` *(string, opcional, UUID)*: Filtra apenas quadros localizados dentro desta pasta.
  - `limit` *(integer, opcional)*: Quantidade máxima de quadros (padrão: `50`, mín: `1`, máx: `200`).
- **Retorno**:
  - `boards`: Lista de resumos de quadros, incluindo `id`, `title`, `folder_id`, `access_level`, `created_at`, `updated_at`, `deleted_at`, `element_count` e `url`.

**Exemplo de Chamada:**
```json
{
  "name": "list_boards",
  "arguments": {
    "limit": 10
  }
}
```

---

### 2. `search_boards`
> Busca full-text insensível a acentos sobre títulos de quadros e o texto escrito nas formas e setas do canvas.

- **Anotações**: `readOnlyHint: true`
- **Parâmetros de Entrada (`inputSchema`)**:
  - `query` *(string, obrigatório)*: Termo ou frase de busca (ex.: `"microserviços"`, `"login"`).
- **Retorno**:
  - `results`: Lista de quadros encontrados ordenados por relevância, contendo `id`, `title`, `folder_id`, `updated_at`, `text` (trecho de até 500 caracteres do conteúdo coincidente) e `url`.

**Exemplo de Chamada:**
```json
{
  "name": "search_boards",
  "arguments": {
    "query": "autenticação"
  }
}
```

---

### 3. `get_board`
> Lê os dados e elementos de uma lousa. Suporta visão compacta inteligente para economizar tokens de contexto do modelo.

- **Anotações**: `readOnlyHint: true`
- **Parâmetros de Entrada (`inputSchema`)**:
  - `board_id` *(string, obrigatório, UUID)*: ID do quadro a consultar.
  - `detail` *(string, enum: `["compact", "full"]`, padrão: `"compact"`)*:
    - `"compact"`: Formas combinadas com seus textos internos (`label`), setas indicando quais nós conectam (`start`, `end`) e coordenadas simplificadas. Recomendado para agentes de IA.
    - `"full"`: Lista bruta contendo todos os elementos nativos do Excalidraw.
- **Retorno**:
  - `board`: Metadados do quadro com `url`.
  - `elements`: Elementos no formato compacto ou completo solicitado.

**Exemplo de Chamada:**
```json
{
  "name": "get_board",
  "arguments": {
    "board_id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "detail": "compact"
  }
}
```

---

### 4. `create_board`
> Cria um novo quadro no Heeey, opcionalmente com elementos iniciais. Retorna o quadro com sua URL pronta para abertura.

- **Parâmetros de Entrada (`inputSchema`)**:
  - `title` *(string, obrigatório)*: Título do novo quadro.
  - `folder_id` *(string, opcional, UUID)*: Pasta de destino. Se omitido, é criado na raiz.
  - `elements` *(array de `ElementSpec`, opcional)*: Formas ou setas a incluir na criação.
- **Retorno**:
  - `board`: Quadro criado contendo `id`, `title`, datas, contagem de elementos e `url`.

**Exemplo de Chamada:**
```json
{
  "name": "create_board",
  "arguments": {
    "title": "Arquitetura de Dados",
    "elements": [
      { "id": "db", "type": "rectangle", "x": 100, "y": 100, "label": "PostgreSQL", "backgroundColor": "#a5d8ff" }
    ]
  }
}
```

---

### 5. `add_elements`
> Adiciona elementos a uma lousa existente ou atualiza formas existentes reusando seus IDs. Pessoas com o quadro aberto veem a alteração ao vivo.

- **Parâmetros de Entrada (`inputSchema`)**:
  - `board_id` *(string, obrigatório, UUID)*: ID do quadro.
  - `elements` *(array de `ElementSpec`, obrigatório, mín 1 item)*: Formas, textos ou setas a inserir/atualizar.
- **Retorno**:
  - `board`: Metadados atualizados do quadro com `url`.

**Exemplo de Chamada:**
```json
{
  "name": "add_elements",
  "arguments": {
    "board_id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "elements": [
      { "id": "cache", "type": "rectangle", "x": 350, "y": 100, "label": "Redis Cache", "backgroundColor": "#ffc9c9" },
      { "type": "arrow", "start": { "id": "db" }, "end": { "id": "cache" }, "label": "sync" }
    ]
  }
}
```

---

### 6. `delete_elements`
> Remove elementos de um quadro pelos seus IDs. Textos vinculados a formas deletadas são removidos automaticamente em cascata.

- **Anotações**: `destructiveHint: true`
- **Parâmetros de Entrada (`inputSchema`)**:
  - `board_id` *(string, obrigatório, UUID)*: ID do quadro.
  - `element_ids` *(array de strings, obrigatório, mín 1 item)*: Lista de IDs de elementos a remover.
- **Retorno**:
  - `board`: Metadados atualizados do quadro com `url`.

**Exemplo de Chamada:**
```json
{
  "name": "delete_elements",
  "arguments": {
    "board_id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "element_ids": ["cache"]
  }
}
```

---

### 7. `rename_board`
> Altera o título de exibição de um quadro.

- **Anotações**: `idempotentHint: true`
- **Parâmetros de Entrada (`inputSchema`)**:
  - `board_id` *(string, obrigatório, UUID)*: ID do quadro.
  - `title` *(string, obrigatório)*: Novo título para a lousa.
- **Retorno**:
  - `board`: Metadados atualizados do quadro com `url`.

**Exemplo de Chamada:**
```json
{
  "name": "rename_board",
  "arguments": {
    "board_id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "title": "Arquitetura de Dados v2"
  }
}
```

---

### 8. `trash_board`
> Move um quadro para a lixeira do usuário (*soft delete*). O quadro pode ser recuperado pela interface a qualquer momento.

- **Anotações**: `destructiveHint: true`, `idempotentHint: true`
- **Parâmetros de Entrada (`inputSchema`)**:
  - `board_id` *(string, obrigatório, UUID)*: ID do quadro.
- **Retorno**:
  - `board`: Metadados do quadro com `deleted_at` preenchido.

**Exemplo de Chamada:**
```json
{
  "name": "trash_board",
  "arguments": {
    "board_id": "e67e3a1e-8e89-4089-a5f1-382a39281a92"
  }
}
```

---

### 9. `create_diagram`
> **A ferramenta mais poderosa para agentes de IA**. Desenha fluxogramas, arquiteturas, pipelines e árvores com dimensionamento automático pelo texto e algoritmo em camadas de Sugiyama (Dagre).

- **Parâmetros de Entrada (`inputSchema`)**:
  - `title` *(string, obrigatório quando `board_id` não for informado)*: Título da nova lousa.
  - `board_id` *(string, opcional, UUID)*: Se informado, desenha o diagrama **ao lado do conteúdo existente** desta lousa (`originBeside`).
  - `folder_id` *(string, opcional, UUID)*: Pasta de destino para a nova lousa.
  - `direction` *(enum: `["TB", "LR", "BT", "RL"]`, padrão: `"TB"`)*: Orientação do fluxo.
  - `nodes` *(array de objetos, obrigatório, 1 a 300 itens)*:
    - `id` *(string, obrigatório)*: Identificador estável do nó.
    - `label` *(string, obrigatório)*: Texto contido no nó (quebra automática de linhas inclusa).
    - `shape` *(enum: `["rectangle", "ellipse", "diamond"]`, padrão: `"rectangle"`)*: Formato geométrico.
    - `color` *(enum: `["blue", "green", "yellow", "red", "violet", "gray"]`)*: Paleta de preenchimento e traço Excalidraw.
  - `edges` *(array de objetos, opcional)*:
    - `from` *(string, obrigatório)*: ID do nó de origem.
    - `to` *(string, obrigatório)*: ID do nó de destino.
    - `label` *(string, opcional)*: Texto centralizado na seta.
- **Retorno**:
  - `board`: Metadados do quadro com `url`.

**Exemplo de Chamada:**
```json
{
  "name": "create_diagram",
  "arguments": {
    "title": "Pipeline de CI/CD",
    "direction": "LR",
    "nodes": [
      { "id": "git", "label": "Git Push", "shape": "rectangle", "color": "blue" },
      { "id": "ci", "label": "Testes Automatizados", "shape": "diamond", "color": "yellow" },
      { "id": "deploy", "label": "Deploy Produção", "shape": "rectangle", "color": "green" }
    ],
    "edges": [
      { "from": "git", "to": "ci", "label": "gatilho" },
      { "from": "ci", "to": "deploy", "label": "sucesso" }
    ]
  }
}
```

---

### 10. `layout_board`
> Reorganiza uma lousa existente desordenada, redistribuindo caixas e setas conectadas em camadas regulares sem afetar outros elementos soltos.

- **Anotações**: `idempotentHint: true`
- **Parâmetros de Entrada (`inputSchema`)**:
  - `board_id` *(string, obrigatório, UUID)*: ID do quadro.
  - `direction` *(enum: `["TB", "LR", "BT", "RL"]`, opcional, padrão: `"TB"`)*: Nova orientação do layout.
- **Retorno**:
  - `board`: Metadados da lousa com `url`.
  - `moved`: Quantidade de formas e setas reposicionadas.

**Exemplo de Chamada:**
```json
{
  "name": "layout_board",
  "arguments": {
    "board_id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "direction": "LR"
  }
}
```

---

### 11. `list_folders`
> Lista todas as pastas criadas pelo usuário, permitindo navegar na hierarquia organizacional.

- **Anotações**: `readOnlyHint: true`
- **Parâmetros de Entrada (`inputSchema`)**:
  - Objeto vazio `{}`.
- **Retorno**:
  - `folders`: Lista de pastas, onde cada item possui `id`, `name` e `parent_id` (`null` para pastas no nível raiz).

**Exemplo de Chamada:**
```json
{
  "name": "list_folders",
  "arguments": {}
}
```

---

### 12. `create_folder`
> Cria uma nova pasta organizadora de quadros, com suporte a aninhamento recursivo.

- **Parâmetros de Entrada (`inputSchema`)**:
  - `name` *(string, obrigatório)*: Nome da pasta.
  - `parent_id` *(string, opcional, UUID)*: ID da pasta pai (para criar uma subpasta). Se omitido, a pasta é criada na raiz.
- **Retorno**:
  - `folder`: Objeto contendo `id`, `name` e `parent_id`.

**Exemplo de Chamada:**
```json
{
  "name": "create_folder",
  "arguments": {
    "name": "Infraestrutura Cloud",
    "parent_id": null
  }
}
```

---

### 13. `move_board`
> Move um quadro para uma pasta de destino, ou devolve o quadro para a raiz do painel.

- **Anotações**: `idempotentHint: true`
- **Parâmetros de Entrada (`inputSchema`)**:
  - `board_id` *(string, obrigatório, UUID)*: ID do quadro.
  - `folder_id` *(string ou null, opcional)*: ID da pasta de destino, ou `null` para mover o quadro de volta para a raiz.
- **Retorno**:
  - `board`: Metadados do quadro atualizado com `url`.

**Exemplo de Chamada:**
```json
{
  "name": "move_board",
  "arguments": {
    "board_id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "folder_id": "8bb38d33-9fb4-4c4f-a7f4-ea30fb5b8822"
  }
}
```

---

### 14. `list_projects`
> Lista os times e projetos que a chave alcança, com o acesso do usuário em cada projeto (`manage`, `edit` ou `view`).

- **Anotações**: `readOnlyHint: true`
- **Parâmetros de Entrada (`inputSchema`)**:
  - Objeto vazio `{}`.
- **Retorno**:
  - `projects`: Lista com `id`, `name`, `visibility` (`team` ou `private`), `is_default`, `team_id`, `team_name` e `access`.

**Exemplo de Chamada:**
```json
{
  "name": "list_projects",
  "arguments": {}
}
```
