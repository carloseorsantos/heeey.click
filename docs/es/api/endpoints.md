# Referencia completa de endpoints de la API REST

Esta página documenta todos los endpoints disponibles en la API REST v1 de Heeey (`https://heeey.click/api/v1`).

Todas las peticiones (excepto `GET /api/v1`) requieren autenticación mediante la cabecera:
```http
Authorization: Bearer hk_...
```

---

## 📌 Índice de endpoints

- [GET /api/v1](#get-apiv1) — Catálogo de la API
- [GET /api/v1/projects](#get-apiv1projects) — Listar los equipos y proyectos a los que llega la clave
- [GET /api/v1/boards](#get-apiv1boards) — Listar pizarras
- [POST /api/v1/boards](#post-apiv1boards) — Crear una pizarra
- [GET /api/v1/boards/:id](#get-apiv1boardsid) — Obtener una pizarra y su escena completa
- [PATCH /api/v1/boards/:id](#patch-apiv1boardsid) — Actualizar una pizarra
- [DELETE /api/v1/boards/:id](#delete-apiv1boardsid) — Enviar una pizarra a la papelera
- [POST /api/v1/boards/:id/move](#post-apiv1boardsidmove) — Mover una pizarra a una carpeta
- [GET /api/v1/search](#get-apiv1search) — Buscar pizarras por texto
- [GET /api/v1/folders](#get-apiv1folders) — Listar carpetas
- [POST /api/v1/folders](#post-apiv1folders) — Crear una carpeta

---

## 🔍 Detalles de los endpoints

### `GET /api/v1`
Devuelve información general sobre la API, instrucciones de autenticación y las rutas disponibles.

**Ejemplo de respuesta (200 OK):**
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
Lista las pizarras del usuario de la clave de API, de la editada más recientemente a la más antigua.

**Parámetros de consulta (query params):**
- `project_id` *(opcional, UUID)*: solo las pizarras de este proyecto.
- `team_id` *(opcional, UUID)*: solo las pizarras de este equipo.
- `folder_id` *(opcional, UUID)*: solo las pizarras que están dentro de esta carpeta.
- `include_trashed` *(opcional, boolean)*: si es `true`, incluye las pizarras de la papelera. Por defecto: `false`.
- `limit` *(opcional, integer)*: número máximo de resultados (por defecto: `50`, máx.: `200`).
- `offset` *(opcional, integer)*: desplazamiento para la paginación (por defecto: `0`).

**Ejemplo de respuesta (200 OK):**
```json
{
  "boards": [
    {
      "id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
      "title": "Arquitectura de microservicios",
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
Crea una pizarra nueva con un título y elementos opcionales.

**Cuerpo de la petición (JSON):**
- `title` *(opcional, string)*: título de la pizarra (si se omite, se usa el título por defecto del sistema).
- `project_id` *(opcional, UUID)*: proyecto de destino. Si se omite, se usa el proyecto de la carpeta o el proyecto predeterminado de tu equipo personal (o del primer equipo al que llega la clave). Las pizarras creadas por la API empiezan **restringidas**.
- `folder_id` *(opcional, UUID)*: carpeta de destino. Si se omite o es `null`, la pizarra se crea en el nivel superior.
- `elements` *(opcional, array)*: lista de elementos nativos de Excalidraw o de especificaciones abreviadas (`ElementSpec`).

**Ejemplo de petición:**
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

**Ejemplo de respuesta (201 Created):**
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
Devuelve los metadatos de la pizarra y el array completo con todos los elementos dibujados en la escena.

**Ejemplo de respuesta (200 OK):**
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
Cambia propiedades de una pizarra existente. Las actualizaciones de elementos se difunden en tiempo real a los colaboradores que tienen la pizarra abierta.

**Cuerpo de la petición (JSON):**
- `title` *(opcional, string)*: nuevo título.
- `elements` *(opcional, array)*: elementos que se añaden o actualizan. Los elementos cuyo `id` ya existe en la pizarra se actualizan (*upsert*); los ID nuevos se insertan.
- `delete_element_ids` *(opcional, array de strings)*: ID de los elementos que se eliminan. Si eliminas una forma con texto interior vinculado, el texto vinculado se elimina con ella.

**Ejemplo de petición:**
```json
{
  "title": "Pipeline de CI/CD (Producción)",
  "elements": [
    { "id": "deploy", "type": "rectangle", "x": 510, "y": 100, "label": "Deploy K8s", "backgroundColor": "#b2f2bb" },
    { "type": "arrow", "start": { "id": "build" }, "end": { "id": "deploy" } }
  ]
}
```

**Ejemplo de respuesta (200 OK):**
```json
{
  "board": {
    "id": "c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234",
    "title": "Pipeline de CI/CD (Producción)",
    "url": "https://heeey.click/b/c1f10e4a-939e-4e89-9a2d-4f1b8a9d1234"
  }
}
```

---

### `DELETE /api/v1/boards/:id`
Mueve la pizarra a la papelera (*soft delete*). Se puede restaurar más tarde desde la interfaz de Heeey.

**Ejemplo de respuesta (200 OK):**
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
Mueve la pizarra a una carpeta concreta o la devuelve al nivel superior.

**Cuerpo de la petición (JSON):**
- `folder_id` *(UUID o null)*: el ID de la carpeta de destino, o `null` para moverla al nivel superior.

**Ejemplo de petición:**
```json
{
  "folder_id": "8bb38d33-9fb4-4c4f-a7f4-ea30fb5b8822"
}
```

---

### `GET /api/v1/search?q=`
Busca términos en todas las pizarras de la cuenta. Busca tanto en el **título** como en el **texto y las etiquetas dibujadas en las pizarras**, sin distinguir acentos ni mayúsculas.

**Parámetros de consulta (query params):**
- `q` *(obligatorio, string)*: término de búsqueda (mínimo 1 carácter).
- `limit` *(opcional, integer)*: número máximo de resultados (por defecto: `20`).

Consulta también la guía de [Paginación](pagination.md).

**Ejemplo de respuesta (200 OK):**
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
Lista los equipos y proyectos a los que llega la clave, con tu acceso en cada uno (`manage`, `edit` o `view`). Usa el `id` como `project_id` al crear o listar pizarras y carpetas.

**Ejemplo de respuesta (200 OK):**
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
Devuelve todas las carpetas creadas por el usuario, con `parent_id` para construir el árbol (`parent_id: null` indica el nivel superior).

**Ejemplo de respuesta (200 OK):**
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
Crea una carpeta nueva en el nivel superior o anidada dentro de otra carpeta existente.

**Cuerpo de la petición (JSON):**
- `name` *(obligatorio, string)*: nombre de la carpeta (de 1 a 60 caracteres).
- `parent_id` *(opcional, UUID o null)*: ID de la carpeta padre, para anidarla.
- `project_id` *(opcional, UUID)*: solo las carpetas de este proyecto (al listar), o el proyecto de la nueva carpeta (al crear).

**Ejemplo de respuesta (201 Created):**
```json
{
  "folder": {
    "id": "3cc44e22-6dc3-5b2f-0e32-gc32cd229944",
    "name": "Frontend",
    "parent_id": null
  }
}
```
