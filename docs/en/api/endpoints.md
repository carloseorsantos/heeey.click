# Full REST API Endpoint Reference

This page documents every endpoint available in the Heeey REST API v1 (`https://heeey.click/api/v1`).

Every request (except `GET /api/v1`) requires authentication through the header:
```http
Authorization: Bearer hk_...
```

---

## 📌 Endpoint Index

- [GET /api/v1](#get-apiv1) — API catalog
- [GET /api/v1/projects](#get-apiv1projects) — List the teams and projects the key reaches
- [GET /api/v1/boards](#get-apiv1boards) — List boards
- [POST /api/v1/boards](#post-apiv1boards) — Create a board
- [GET /api/v1/boards/:id](#get-apiv1boardsid) — Get a board and its full scene
- [PATCH /api/v1/boards/:id](#patch-apiv1boardsid) — Update a board
- [DELETE /api/v1/boards/:id](#delete-apiv1boardsid) — Move a board to the trash
- [POST /api/v1/boards/:id/move](#post-apiv1boardsidmove) — Move a board to a folder
- [GET /api/v1/search](#get-apiv1search) — Search boards by text
- [GET /api/v1/folders](#get-apiv1folders) — List folders
- [POST /api/v1/folders](#post-apiv1folders) — Create a folder

---

## 🔍 Endpoint Details

### `GET /api/v1`
Returns general information about the API, authentication instructions and the supported routes.

**Example response (200 OK):**
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
Lists the boards owned by the API key's user, most recently edited first.

**Query parameters:**
- `project_id` *(optional, UUID)*: Only boards in this project.
- `team_id` *(optional, UUID)*: Only boards of this team.
- `folder_id` *(optional, UUID)*: Only boards inside this folder.
- `include_trashed` *(optional, boolean)*: When `true`, includes boards in the trash. Default: `false`.
- `limit` *(optional, integer)*: Maximum number of results (default: `50`, max: `200`).
- `offset` *(optional, integer)*: Pagination offset (default: `0`).

**Example response (200 OK):**
```json
{
  "boards": [
    {
      "id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
      "title": "Microservices Architecture",
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
Creates a new board with a title and optional elements.

**Request body (JSON):**
- `title` *(optional, string)*: Board title (when omitted, the system's default title is used).
- `project_id` *(optional, UUID)*: Target project. When omitted, the folder's project is used, or the default project of your personal team (or of the first team the key reaches). Boards created through the API start **restricted**.
- `folder_id` *(optional, UUID)*: Target folder. When omitted or `null`, the board is created at the top level.
- `elements` *(optional, array)*: A list of native Excalidraw elements or short-form specs (`ElementSpec`).

**Example request:**
```bash
curl -X POST https://heeey.click/api/v1/boards \
  -H "Authorization: Bearer hk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "CI/CD Pipeline",
    "elements": [
      { "id": "git", "type": "rectangle", "x": 50, "y": 100, "label": "Git Push" },
      { "id": "build", "type": "rectangle", "x": 280, "y": 100, "label": "Build Docker" },
      { "type": "arrow", "start": { "id": "git" }, "end": { "id": "build" } }
    ]
  }'
```

**Example response (201 Created):**
```json
{
  "board": {
    "id": "c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234",
    "title": "CI/CD Pipeline",
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
Returns the board's metadata and the full array of every element drawn in the scene.

**Example response (200 OK):**
```json
{
  "board": {
    "id": "c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234",
    "title": "CI/CD Pipeline",
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
Changes properties of an existing board. Element updates are broadcast in real time to collaborators who have the board open.

**Request body (JSON):**
- `title` *(optional, string)*: New title.
- `elements` *(optional, array)*: Elements to add or update. Elements whose `id` already exists on the board are updated (*upsert*); new IDs are inserted.
- `delete_element_ids` *(optional, array of strings)*: IDs of the elements to remove. If you remove a shape with bound inner text, the bound text is removed with it.

**Example request:**
```json
{
  "title": "CI/CD Pipeline (Production)",
  "elements": [
    { "id": "deploy", "type": "rectangle", "x": 510, "y": 100, "label": "Deploy K8s", "backgroundColor": "#b2f2bb" },
    { "type": "arrow", "start": { "id": "build" }, "end": { "id": "deploy" } }
  ]
}
```

**Example response (200 OK):**
```json
{
  "board": {
    "id": "c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234",
    "title": "CI/CD Pipeline (Production)",
    "url": "https://heeey.click/b/c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234"
  }
}
```

---

### `DELETE /api/v1/boards/:id`
Moves the board to the trash (*soft delete*). It can be restored later from the Heeey interface.

**Example response (200 OK):**
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
Moves the board to a specific folder or back to the top level.

**Request body (JSON):**
- `folder_id` *(UUID or null)*: The target folder ID, or `null` to move it to the top level.

**Example request:**
```json
{
  "folder_id": "8bb38d33-9fb4-4c4f-a7f4-ea30fb5b8822"
}
```

---

### `GET /api/v1/search?q=`
Searches every board in the account. It looks at both the **title** and the **text and labels drawn on the boards**, ignoring accents and case.

**Query parameters:**
- `q` *(required, string)*: Search term (at least 1 character).
- `limit` *(optional, integer)*: Maximum number of results (default: `20`).

See also the [Pagination](pagination.md) guide.

**Example response (200 OK):**
```json
{
  "results": [
    {
      "id": "c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234",
      "title": "CI/CD Pipeline",
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
Lists the teams and projects the key reaches, with your access in each one (`manage`, `edit` or `view`). Use the `id` as `project_id` when creating or listing boards and folders.

**Example Response (200 OK):**
```json
{
  "projects": [
    {
      "id": "0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8",
      "name": "General",
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
Returns every folder the user created, including `parent_id` for building the tree (`parent_id: null` means top level).

**Example response (200 OK):**
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
Creates a new folder at the top level or nested inside an existing folder.

**Request body (JSON):**
- `name` *(required, string)*: Folder name (1 to 60 characters).
- `parent_id` *(optional, UUID or null)*: ID of the parent folder, for nesting.
- `project_id` *(optional, UUID)*: Only folders of this project (when listing), or the project of the new folder (when creating).

**Example response (201 Created):**
```json
{
  "folder": {
    "id": "3cc44e22-6dc3-5b2f-0e32-gc32cd229944",
    "name": "Frontend",
    "parent_id": null
  }
}
```
