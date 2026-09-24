# Catálogo completo de herramientas MCP de Heeey

Esta página describe la especificación técnica detallada de las **13 herramientas MCP** que ofrece el servidor de Heeey en `https://heeey.click/api/mcp`.

---

## 🗂️ Tabla de referencia rápida

| Herramienta | Alcance | Anotación MCP | Finalidad principal |
|---|---|---|---|
| [`list_boards`](#1-list_boards) | `read` | `readOnlyHint: true` | Lista las pizarras de la cuenta del usuario. |
| [`search_boards`](#2-search_boards) | `read` | `readOnlyHint: true` | Búsqueda de texto completo en títulos y en el texto dibujado en el lienzo. |
| [`get_board`](#3-get_board) | `read` | `readOnlyHint: true` | Lee metadatos y elementos (compacto o detallado). |
| [`create_board`](#4-create_board) | `write` | — | Crea una pizarra nueva, vacía o con elementos. |
| [`add_elements`](#5-add_elements) | `write` | — | Añade elementos nuevos o actualiza los existentes reutilizando sus ID. |
| [`delete_elements`](#6-delete_elements) | `write` | `destructiveHint: true` | Elimina elementos por ID (sus etiquetas de texto se eliminan con ellos). |
| [`rename_board`](#7-rename_board) | `write` | `idempotentHint: true` | Cambia el título visible de una pizarra. |
| [`trash_board`](#8-trash_board) | `write` | `destructiveHint: true`, `idempotentHint: true` | Envía una pizarra a la papelera (reversible). |
| [`create_diagram`](#9-create_diagram) | `write` | — | Dibuja diagramas por capas con disposición automática Dagre. |
| [`layout_board`](#10-layout_board) | `write` | `idempotentHint: true` | Reorganiza y alinea automáticamente una pizarra existente. |
| [`list_folders`](#11-list_folders) | `read` | `readOnlyHint: true` | Lista todas las carpetas de la cuenta. |
| [`create_folder`](#12-create_folder) | `write` | — | Crea una carpeta en el nivel superior o dentro de otra carpeta. |
| [`move_board`](#13-move_board) | `write` | `idempotentHint: true` | Mueve una pizarra a una carpeta o de vuelta al nivel superior. |

---

## 🛠️ Especificación de cada herramienta

### 1. `list_boards`
> Lista las pizarras del usuario, de la editada más recientemente a la más antigua.

- **Anotaciones**: `readOnlyHint: true`
- **Parámetros de entrada (`inputSchema`)**:
  - `folder_id` *(string, opcional, UUID)*: solo las pizarras que están dentro de esta carpeta.
  - `limit` *(integer, opcional)*: número máximo de pizarras (por defecto: `50`, mín.: `1`, máx.: `200`).
- **Devuelve**:
  - `boards`: lista de resúmenes de pizarras con `id`, `title`, `folder_id`, `access_level`, `created_at`, `updated_at`, `deleted_at`, `element_count` y `url`.

**Ejemplo de llamada:**
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
> Búsqueda de texto completo, sin distinguir acentos, en los títulos de las pizarras y en el texto escrito en las formas y flechas del lienzo.

- **Anotaciones**: `readOnlyHint: true`
- **Parámetros de entrada (`inputSchema`)**:
  - `query` *(string, obligatorio)*: término o frase de búsqueda (p. ej. `"microservicios"`, `"login"`).
- **Devuelve**:
  - `results`: pizarras encontradas ordenadas por relevancia, con `id`, `title`, `folder_id`, `updated_at`, `text` (fragmento de hasta 500 caracteres del contenido coincidente) y `url`.

**Ejemplo de llamada:**
```json
{
  "name": "search_boards",
  "arguments": {
    "query": "autenticación"
  }
}
```

---

### 3. `get_board`
> Lee los datos y los elementos de una pizarra. Admite una vista compacta inteligente que ahorra tokens de contexto del modelo.

- **Anotaciones**: `readOnlyHint: true`
- **Parámetros de entrada (`inputSchema`)**:
  - `board_id` *(string, obligatorio, UUID)*: ID de la pizarra que se consulta.
  - `detail` *(string, enum: `["compact", "full"]`, por defecto: `"compact"`)*:
    - `"compact"`: formas combinadas con su texto interior (`label`), flechas que indican qué nodos conectan (`start`, `end`) y coordenadas simplificadas. Recomendado para agentes de IA.
    - `"full"`: lista en bruto con todos los elementos nativos de Excalidraw.
- **Devuelve**:
  - `board`: metadatos de la pizarra con `url`.
  - `elements`: elementos en el formato compacto o completo solicitado.

**Ejemplo de llamada:**
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
> Crea una pizarra nueva en Heeey, opcionalmente con elementos iniciales. Devuelve la pizarra con su URL lista para abrir.

- **Parámetros de entrada (`inputSchema`)**:
  - `title` *(string, obligatorio)*: título de la nueva pizarra.
  - `folder_id` *(string, opcional, UUID)*: carpeta de destino. Si se omite, se crea en el nivel superior.
  - `elements` *(array de `ElementSpec`, opcional)*: formas o flechas que se incluyen al crearla.
- **Devuelve**:
  - `board`: la pizarra creada con `id`, `title`, fechas, número de elementos y `url`.

**Ejemplo de llamada:**
```json
{
  "name": "create_board",
  "arguments": {
    "title": "Arquitectura de datos",
    "elements": [
      { "id": "db", "type": "rectangle", "x": 100, "y": 100, "label": "PostgreSQL", "backgroundColor": "#a5d8ff" }
    ]
  }
}
```

---

### 5. `add_elements`
> Añade elementos a una pizarra existente o actualiza formas existentes reutilizando sus ID. Quien tenga la pizarra abierta ve el cambio en directo.

- **Parámetros de entrada (`inputSchema`)**:
  - `board_id` *(string, obligatorio, UUID)*: ID de la pizarra.
  - `elements` *(array de `ElementSpec`, obligatorio, mínimo 1 elemento)*: formas, textos o flechas que se añaden o actualizan.
- **Devuelve**:
  - `board`: metadatos actualizados de la pizarra con `url`.

**Ejemplo de llamada:**
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
> Elimina elementos de una pizarra por sus ID. Los textos vinculados a las formas eliminadas se borran automáticamente con ellas.

- **Anotaciones**: `destructiveHint: true`
- **Parámetros de entrada (`inputSchema`)**:
  - `board_id` *(string, obligatorio, UUID)*: ID de la pizarra.
  - `element_ids` *(array de strings, obligatorio, mínimo 1 elemento)*: ID de los elementos que se eliminan.
- **Devuelve**:
  - `board`: metadatos actualizados de la pizarra con `url`.

**Ejemplo de llamada:**
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
> Cambia el título visible de una pizarra.

- **Anotaciones**: `idempotentHint: true`
- **Parámetros de entrada (`inputSchema`)**:
  - `board_id` *(string, obligatorio, UUID)*: ID de la pizarra.
  - `title` *(string, obligatorio)*: nuevo título de la pizarra.
- **Devuelve**:
  - `board`: metadatos actualizados de la pizarra con `url`.

**Ejemplo de llamada:**
```json
{
  "name": "rename_board",
  "arguments": {
    "board_id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "title": "Arquitectura de datos v2"
  }
}
```

---

### 8. `trash_board`
> Envía una pizarra a la papelera del usuario (*soft delete*). Se puede recuperar desde la interfaz en cualquier momento.

- **Anotaciones**: `destructiveHint: true`, `idempotentHint: true`
- **Parámetros de entrada (`inputSchema`)**:
  - `board_id` *(string, obligatorio, UUID)*: ID de la pizarra.
- **Devuelve**:
  - `board`: metadatos de la pizarra con `deleted_at` rellenado.

**Ejemplo de llamada:**
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
> **La herramienta más potente para agentes de IA**. Dibuja diagramas de flujo, arquitecturas, pipelines y árboles, ajustando el tamaño de cada nodo a su texto y colocándolos con el algoritmo por capas de Sugiyama (Dagre).

- **Parámetros de entrada (`inputSchema`)**:
  - `title` *(string, obligatorio cuando no se indica `board_id`)*: título de la nueva pizarra.
  - `board_id` *(string, opcional, UUID)*: si se indica, dibuja el diagrama **junto al contenido existente** de esta pizarra (`originBeside`).
  - `folder_id` *(string, opcional, UUID)*: carpeta de destino de la nueva pizarra.
  - `direction` *(enum: `["TB", "LR", "BT", "RL"]`, por defecto: `"TB"`)*: orientación del flujo.
  - `nodes` *(array de objetos, obligatorio, de 1 a 300 elementos)*:
    - `id` *(string, obligatorio)*: identificador estable del nodo.
    - `label` *(string, obligatorio)*: texto dentro del nodo (con ajuste automático de líneas).
    - `shape` *(enum: `["rectangle", "ellipse", "diamond"]`, por defecto: `"rectangle"`)*: forma geométrica.
    - `color` *(enum: `["blue", "green", "yellow", "red", "violet", "gray"]`)*: paleta de relleno y trazo de Excalidraw.
  - `edges` *(array de objetos, opcional)*:
    - `from` *(string, obligatorio)*: ID del nodo de origen.
    - `to` *(string, obligatorio)*: ID del nodo de destino.
    - `label` *(string, opcional)*: texto centrado en la flecha.
- **Devuelve**:
  - `board`: metadatos de la pizarra con `url`.

**Ejemplo de llamada:**
```json
{
  "name": "create_diagram",
  "arguments": {
    "title": "Pipeline de CI/CD",
    "direction": "LR",
    "nodes": [
      { "id": "git", "label": "Git Push", "shape": "rectangle", "color": "blue" },
      { "id": "ci", "label": "Pruebas automáticas", "shape": "diamond", "color": "yellow" },
      { "id": "deploy", "label": "Despliegue a producción", "shape": "rectangle", "color": "green" }
    ],
    "edges": [
      { "from": "git", "to": "ci", "label": "disparador" },
      { "from": "ci", "to": "deploy", "label": "éxito" }
    ]
  }
}
```

---

### 10. `layout_board`
> Reorganiza una pizarra existente desordenada, redistribuyendo las cajas y las flechas conectadas en capas regulares sin tocar otros elementos sueltos.

- **Anotaciones**: `idempotentHint: true`
- **Parámetros de entrada (`inputSchema`)**:
  - `board_id` *(string, obligatorio, UUID)*: ID de la pizarra.
  - `direction` *(enum: `["TB", "LR", "BT", "RL"]`, opcional, por defecto: `"TB"`)*: nueva orientación de la disposición.
- **Devuelve**:
  - `board`: metadatos de la pizarra con `url`.
  - `moved`: número de formas y flechas recolocadas.

**Ejemplo de llamada:**
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
> Lista todas las carpetas creadas por el usuario, para recorrer la jerarquía de carpetas.

- **Anotaciones**: `readOnlyHint: true`
- **Parámetros de entrada (`inputSchema`)**:
  - Objeto vacío `{}`.
- **Devuelve**:
  - `folders`: lista de carpetas, cada una con `id`, `name` y `parent_id` (`null` para las carpetas del nivel superior).

**Ejemplo de llamada:**
```json
{
  "name": "list_folders",
  "arguments": {}
}
```

---

### 12. `create_folder`
> Crea una carpeta nueva para organizar pizarras, con soporte para anidarlas.

- **Parámetros de entrada (`inputSchema`)**:
  - `name` *(string, obligatorio)*: nombre de la carpeta.
  - `parent_id` *(string, opcional, UUID)*: ID de la carpeta padre (para crear una subcarpeta). Si se omite, la carpeta se crea en el nivel superior.
- **Devuelve**:
  - `folder`: objeto con `id`, `name` y `parent_id`.

**Ejemplo de llamada:**
```json
{
  "name": "create_folder",
  "arguments": {
    "name": "Infraestructura en la nube",
    "parent_id": null
  }
}
```

---

### 13. `move_board`
> Mueve una pizarra a una carpeta de destino o la devuelve al nivel superior del panel.

- **Anotaciones**: `idempotentHint: true`
- **Parámetros de entrada (`inputSchema`)**:
  - `board_id` *(string, obligatorio, UUID)*: ID de la pizarra.
  - `folder_id` *(string o null, opcional)*: ID de la carpeta de destino, o `null` para devolver la pizarra al nivel superior.
- **Devuelve**:
  - `board`: metadatos actualizados de la pizarra con `url`.

**Ejemplo de llamada:**
```json
{
  "name": "move_board",
  "arguments": {
    "board_id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "folder_id": "8bb38d33-9fb4-4c4f-a7f4-ea30fb5b8822"
  }
}
```
