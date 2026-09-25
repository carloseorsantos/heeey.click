# Referência Completa de Endpoints da API REST

Esta página documenta todos os endpoints disponíveis na API REST v1 do Heeey (`https://heeey.click/api/v1`).

Todas as requisições (exceto `GET /api/v1`) requerem autenticação através do cabeçalho:
```http
Authorization: Bearer hk_...
```

---

## 📌 Índice de Endpoints

- [GET /api/v1](#get-apiv1) — Catálogo da API
- [GET /api/v1/projects](#get-apiv1projects) — Listar times e projetos que a chave alcança
- [GET /api/v1/boards](#get-apiv1boards) — Listar quadros
- [POST /api/v1/boards](#post-apiv1boards) — Criar quadro
- [GET /api/v1/boards/:id](#get-apiv1boardsid) — Obter quadro e cena completa
- [PATCH /api/v1/boards/:id](#patch-apiv1boardsid) — Atualizar quadro
- [DELETE /api/v1/boards/:id](#delete-apiv1boardsid) — Enviar quadro para a lixeira
- [POST /api/v1/boards/:id/move](#post-apiv1boardsidmove) — Mover quadro para pasta
- [GET /api/v1/search](#get-apiv1search) — Buscar quadros por texto
- [GET /api/v1/folders](#get-apiv1folders) — Listar pastas
- [POST /api/v1/folders](#post-apiv1folders) — Criar pasta

---

## 🔍 Detalhes dos Endpoints

### `GET /api/v1`
Retorna informações gerais sobre a API, instruções de autenticação e rotas suportadas.

**Exemplo de Resposta (200 OK):**
```json
{
  "name": "heeey.click API",
  "version": "v1",
  "auth": "Authorization: Bearer <chave de API criada em heeey.click>",
  "endpoints": [
    "GET    /api/v1/projects  (times e projetos que a chave alcança)",
    "GET    /api/v1/boards?project_id=&team_id=&folder_id=&include_trashed=&limit=&offset=",
    "POST   /api/v1/boards { title, elements?, project_id?, folder_id? }",
    "GET    /api/v1/boards/:id",
    "PATCH  /api/v1/boards/:id { title?, elements?, delete_element_ids? }",
    "DELETE /api/v1/boards/:id  (move para a lixeira)",
    "POST   /api/v1/boards/:id/move { folder_id }",
    "GET    /api/v1/search?q=",
    "GET    /api/v1/folders?project_id=",
    "POST   /api/v1/folders { name, parent_id?, project_id? }"
  ]
}
```

---

### `GET /api/v1/boards`
Lista os quadros pertencentes ao usuário da chave de API, ordenados pelos editados mais recentemente.

**Parâmetros de Consulta (Query Params):**
- `project_id` *(opcional, UUID)*: Filtra apenas quadros deste projeto.
- `team_id` *(opcional, UUID)*: Filtra apenas quadros deste time.
- `folder_id` *(opcional, UUID)*: Filtra apenas quadros localizados dentro desta pasta.
- `include_trashed` *(opcional, boolean)*: Quando `true`, inclui quadros que estão na lixeira. Padrão: `false`.
- `limit` *(opcional, integer)*: Quantidade máxima de resultados (padrão: `50`, máx: `200`).
- `offset` *(opcional, integer)*: Deslocamento para paginação (padrão: `0`).

**Exemplo de Resposta (200 OK):**
```json
{
  "boards": [
    {
      "id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
      "title": "Arquitetura de Microsserviços",
      "folder_id": "8bb38d33-9fb4-4c4f-a7f4-ea30fb5b8822",
      "access_level": "edit",
      "created_at": "2026-09-20T14:30:00Z",
      "updated_at": "2026-09-23T01:15:00Z",
      "deleted_at": null,
      "element_count": 42,
      "url": "https://heeey.click/b/e67e3a1e-8e89-4089-a5f1-382a39281a92"
    }
  ]
}
```

---

### `POST /api/v1/boards`
Cria um novo quadro com título e elementos opcionais.

**Corpo da Requisição (JSON):**
- `title` *(opcional, string)*: Título do quadro (se omitido, recebe o título padrão do sistema).
- `project_id` *(opcional, UUID)*: Projeto de destino. Se omitido, usa o projeto da pasta ou o projeto padrão do seu time pessoal (ou do primeiro time que a chave alcança). Quadros criados pela API nascem **restritos**.
- `folder_id` *(opcional, UUID)*: Pasta de destino. Se omitido ou `null`, o quadro é criado na raiz.
- `elements` *(opcional, array)*: Lista de elementos nativos do Excalidraw ou especificações resumidas (`ElementSpec`).

**Exemplo de Requisição:**
```bash
curl -X POST https://heeey.click/api/v1/boards \
  -H "Authorization: Bearer hk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Pipeline de CI/CD",
    "elements": [
      { "id": "git", "type": "rectangle", "x": 50, "y": 100, "label": "Git Push" },
      { "id": "build", "type": "rectangle", "x": 280, "y": 100, "label": "Build Docker" },
      { "type": "arrow", "start": { "id": "git" }, "end": { "id": "build" } }
    ]
  }'
```

**Exemplo de Resposta (201 Created):**
```json
{
  "board": {
    "id": "c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234",
    "title": "Pipeline de CI/CD",
    "folder_id": null,
    "access_level": "edit",
    "created_at": "2026-09-23T02:00:00Z",
    "updated_at": "2026-09-23T02:00:00Z",
    "deleted_at": null,
    "element_count": 4,
    "url": "https://heeey.click/b/c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234"
  }
}
```

---

### `GET /api/v1/boards/:id`
Retorna os metadados do quadro e o array completo com todos os elementos desenhados na cena.

**Exemplo de Resposta (200 OK):**
```json
{
  "board": {
    "id": "c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234",
    "title": "Pipeline de CI/CD",
    "elements": [
      {
        "id": "git",
        "type": "rectangle",
        "x": 50,
        "y": 100,
        "width": 180,
        "height": 80,
        "strokeColor": "#1e1e1e",
        "backgroundColor": "transparent",
        "boundElements": [{ "type": "text", "id": "git-label" }]
      }
    ],
    "app_state": { "viewBackgroundColor": "#ffffff" },
    "files": {},
    "access_level": "edit",
    "created_at": "2026-09-23T02:00:00Z",
    "updated_at": "2026-09-23T02:00:00Z",
    "deleted_at": null,
    "url": "https://heeey.click/b/c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234"
  }
}
```

---

### `PATCH /api/v1/boards/:id`
Altera propriedades de um quadro existente. Atualizações de elementos transmitem broadcast em tempo real para colaboradores com a tela aberta.

**Corpo da Requisição (JSON):**
- `title` *(opcional, string)*: Novo título.
- `elements` *(opcional, array)*: Elementos a adicionar ou atualizar. Elementos cujo `id` já existe na lousa serão atualizados (*upsert*); novos IDs serão inseridos.
- `delete_element_ids` *(opcional, array de strings)*: Lista de IDs de elementos a remover. Se você remover uma forma com texto interno acoplado, o texto vinculado é removido em conjunto.

**Exemplo de Requisição:**
```json
{
  "title": "Pipeline de CI/CD (Produção)",
  "elements": [
    { "id": "deploy", "type": "rectangle", "x": 510, "y": 100, "label": "Deploy K8s", "backgroundColor": "#b2f2bb" },
    { "type": "arrow", "start": { "id": "build" }, "end": { "id": "deploy" } }
  ]
}
```

**Exemplo de Resposta (200 OK):**
```json
{
  "board": {
    "id": "c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234",
    "title": "Pipeline de CI/CD (Produção)",
    "url": "https://heeey.click/b/c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234"
  }
}
```

---

### `DELETE /api/v1/boards/:id`
Move o quadro para a lixeira (*soft delete*). O quadro pode ser restaurado posteriormente na interface do Heeey.

**Exemplo de Resposta (200 OK):**
```json
{
  "board": {
    "id": "c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234",
    "deleted_at": "2026-09-23T02:05:00Z",
    "url": "https://heeey.click/b/c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234"
  }
}
```

---

### `POST /api/v1/boards/:id/move`
Move o quadro para uma pasta específica ou devolve para a raiz.

**Corpo da Requisição (JSON):**
- `folder_id` *(UUID ou null)*: O ID da pasta de destino, ou `null` para mover para o nível raiz.

**Exemplo de Requisição:**
```json
{
  "folder_id": "8bb38d33-9fb4-4c4f-a7f4-ea30fb5b8822"
}
```

---

### `GET /api/v1/search?q=`
Pesquisa por termos em todos os quadros da conta. A busca pesquisa tanto no **título** quanto no **texto e rótulos desenhados dentro das lousas**, ignorando acentos e maiúsculas.

**Parâmetros de Consulta (Query Params):**
- `q` *(obrigatório, string)*: Termo de busca (mínimo 1 caractere).
- `limit` *(opcional, integer)*: Limite de resultados (padrão: `20`).

Consulte também o guia de [Paginação](pagination.md).

**Exemplo de Resposta (200 OK):**
```json
{
  "results": [
    {
      "id": "c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234",
      "title": "Pipeline de CI/CD",
      "folder_id": "8bb38d33-9fb4-4c4f-a7f4-ea30fb5b8822",
      "updated_at": "2026-09-23T02:00:00Z",
      "text": "Git Push · Build Docker · Deploy K8s",
      "url": "https://heeey.click/b/c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234"
    }
  ]
}
```

---

### `GET /api/v1/projects`
Lista os times e projetos que a chave alcança, com o seu acesso em cada um (`manage`, `edit` ou `view`). Use o `id` como `project_id` ao criar ou listar quadros e pastas.

**Exemplo de Resposta (200 OK):**
```json
{
  "projects": [
    {
      "id": "0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8",
      "name": "Geral",
      "visibility": "team",
      "is_default": true,
      "team_id": "7d0f5b1e-2c3a-4e8b-9f10-1a2b3c4d5e6f",
      "team_name": "Acme Design",
      "team_is_personal": false,
      "access": "edit"
    }
  ]
}
```

---

### `GET /api/v1/folders`
Retorna a lista de todas as pastas criadas pelo usuário, incluindo `parent_id` para montagem de árvore (onde `parent_id: null` indica raiz).

**Exemplo de Resposta (200 OK):**
```json
{
  "folders": [
    {
      "id": "8bb38d33-9fb4-4c4f-a7f4-ea30fb5b8822",
      "name": "DevOps",
      "parent_id": null
    },
    {
      "id": "2da33d11-5cb2-4a1e-9d21-fb21bc118833",
      "name": "Kubernetes",
      "parent_id": "8bb38d33-9fb4-4c4f-a7f4-ea30fb5b8822"
    }
  ]
}
```

---

### `POST /api/v1/folders`
Cria uma nova pasta na raiz ou aninhada dentro de outra pasta existente.

**Corpo da Requisição (JSON):**
- `name` *(obrigatório, string)*: Nome da pasta (1 a 60 caracteres).
- `parent_id` *(opcional, UUID ou null)*: ID da pasta pai para aninhamento.
- `project_id` *(opcional, UUID)*: Filtra apenas pastas deste projeto (na listagem) ou define o projeto da nova pasta (na criação).

**Exemplo de Resposta (201 Created):**
```json
{
  "folder": {
    "id": "3cc44e22-6dc3-5b2f-0e32-gc32cd229944",
    "name": "Frontend",
    "parent_id": null
  }
}
```

