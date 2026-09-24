# Full Catalog of Heeey MCP Tools

This page gives the detailed technical spec of all **13 MCP tools** provided by the Heeey server at `https://heeey.click/api/mcp`.

---

## 🗂️ Quick Reference Table

| Tool | Scope | MCP annotation | Main purpose |
|---|---|---|---|
| [`list_boards`](#1-list_boards) | `read` | `readOnlyHint: true` | Lists the boards in the user's account. |
| [`search_boards`](#2-search_boards) | `read` | `readOnlyHint: true` | Full-text search across titles and text drawn on the canvas. |
| [`get_board`](#3-get_board) | `read` | `readOnlyHint: true` | Reads metadata and elements (compact or detailed). |
| [`create_board`](#4-create_board) | `write` | — | Creates a new board, empty or with elements. |
| [`add_elements`](#5-add_elements) | `write` | — | Adds new elements or updates existing ones by reusing IDs. |
| [`delete_elements`](#6-delete_elements) | `write` | `destructiveHint: true` | Removes elements by ID (their text labels go with them). |
| [`rename_board`](#7-rename_board) | `write` | `idempotentHint: true` | Changes a board's display title. |
| [`trash_board`](#8-trash_board) | `write` | `destructiveHint: true`, `idempotentHint: true` | Moves a board to the trash (reversible). |
| [`create_diagram`](#9-create_diagram) | `write` | — | Draws layered diagrams with automatic Dagre layout. |
| [`layout_board`](#10-layout_board) | `write` | `idempotentHint: true` | Rearranges and aligns an existing board automatically. |
| [`list_folders`](#11-list_folders) | `read` | `readOnlyHint: true` | Lists every folder in the account. |
| [`create_folder`](#12-create_folder) | `write` | — | Creates a folder at the top level or inside another folder. |
| [`move_board`](#13-move_board) | `write` | `idempotentHint: true` | Moves a board to a folder or back to the top level. |

---

## 🛠️ Tool-by-Tool Specification

### 1. `list_boards`
> Lists the user's boards, most recently edited first.

- **Annotations**: `readOnlyHint: true`
- **Input parameters (`inputSchema`)**:
  - `folder_id` *(string, optional, UUID)*: Only boards inside this folder.
  - `limit` *(integer, optional)*: Maximum number of boards (default: `50`, min: `1`, max: `200`).
- **Returns**:
  - `boards`: A list of board summaries, including `id`, `title`, `folder_id`, `access_level`, `created_at`, `updated_at`, `deleted_at`, `element_count` and `url`.

**Example call:**
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
> Accent-insensitive full-text search over board titles and the text written in shapes and arrows on the canvas.

- **Annotations**: `readOnlyHint: true`
- **Input parameters (`inputSchema`)**:
  - `query` *(string, required)*: Search term or phrase (e.g. `"microservices"`, `"login"`).
- **Returns**:
  - `results`: Matching boards ordered by relevance, with `id`, `title`, `folder_id`, `updated_at`, `text` (a snippet of up to 500 characters of the matching content) and `url`.

**Example call:**
```json
{
  "name": "search_boards",
  "arguments": {
    "query": "authentication"
  }
}
```

---

### 3. `get_board`
> Reads a board's data and elements. Supports a smart compact view that saves the model's context tokens.

- **Annotations**: `readOnlyHint: true`
- **Input parameters (`inputSchema`)**:
  - `board_id` *(string, required, UUID)*: ID of the board to read.
  - `detail` *(string, enum: `["compact", "full"]`, default: `"compact"`)*:
    - `"compact"`: Shapes combined with their inner text (`label`), arrows showing which nodes they connect (`start`, `end`) and simplified coordinates. Recommended for AI agents.
    - `"full"`: The raw list of every native Excalidraw element.
- **Returns**:
  - `board`: Board metadata with `url`.
  - `elements`: Elements in the requested compact or full format.

**Example call:**
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
> Creates a new board in Heeey, optionally with initial elements. Returns the board with a URL ready to open.

- **Input parameters (`inputSchema`)**:
  - `title` *(string, required)*: Title of the new board.
  - `folder_id` *(string, optional, UUID)*: Target folder. When omitted, the board is created at the top level.
  - `elements` *(array of `ElementSpec`, optional)*: Shapes or arrows to include at creation.
- **Returns**:
  - `board`: The created board with `id`, `title`, dates, element count and `url`.

**Example call:**
```json
{
  "name": "create_board",
  "arguments": {
    "title": "Data Architecture",
    "elements": [
      { "id": "db", "type": "rectangle", "x": 100, "y": 100, "label": "PostgreSQL", "backgroundColor": "#a5d8ff" }
    ]
  }
}
```

---

### 5. `add_elements`
> Adds elements to an existing board, or updates existing shapes by reusing their IDs. People with the board open see the change live.

- **Input parameters (`inputSchema`)**:
  - `board_id` *(string, required, UUID)*: Board ID.
  - `elements` *(array of `ElementSpec`, required, at least 1 item)*: Shapes, text or arrows to add/update.
- **Returns**:
  - `board`: Updated board metadata with `url`.

**Example call:**
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
> Removes elements from a board by ID. Text bound to deleted shapes is removed automatically along with them.

- **Annotations**: `destructiveHint: true`
- **Input parameters (`inputSchema`)**:
  - `board_id` *(string, required, UUID)*: Board ID.
  - `element_ids` *(array of strings, required, at least 1 item)*: IDs of the elements to remove.
- **Returns**:
  - `board`: Updated board metadata with `url`.

**Example call:**
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
> Changes a board's display title.

- **Annotations**: `idempotentHint: true`
- **Input parameters (`inputSchema`)**:
  - `board_id` *(string, required, UUID)*: Board ID.
  - `title` *(string, required)*: New title for the board.
- **Returns**:
  - `board`: Updated board metadata with `url`.

**Example call:**
```json
{
  "name": "rename_board",
  "arguments": {
    "board_id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "title": "Data Architecture v2"
  }
}
```

---

### 8. `trash_board`
> Moves a board to the user's trash (*soft delete*). It can be recovered from the interface at any time.

- **Annotations**: `destructiveHint: true`, `idempotentHint: true`
- **Input parameters (`inputSchema`)**:
  - `board_id` *(string, required, UUID)*: Board ID.
- **Returns**:
  - `board`: Board metadata with `deleted_at` filled in.

**Example call:**
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
> **The most powerful tool for AI agents**. Draws flowcharts, architectures, pipelines and trees, sizing each node to its text and laying them out with Sugiyama's layered algorithm (Dagre).

- **Input parameters (`inputSchema`)**:
  - `title` *(string, required when `board_id` is not given)*: Title of the new board.
  - `board_id` *(string, optional, UUID)*: When given, draws the diagram **next to the existing content** of this board (`originBeside`).
  - `folder_id` *(string, optional, UUID)*: Target folder for the new board.
  - `direction` *(enum: `["TB", "LR", "BT", "RL"]`, default: `"TB"`)*: Flow orientation.
  - `nodes` *(array of objects, required, 1 to 300 items)*:
    - `id` *(string, required)*: Stable node identifier.
    - `label` *(string, required)*: Text inside the node (line wrapping included).
    - `shape` *(enum: `["rectangle", "ellipse", "diamond"]`, default: `"rectangle"`)*: Geometric shape.
    - `color` *(enum: `["blue", "green", "yellow", "red", "violet", "gray"]`)*: Excalidraw fill and stroke palette.
  - `edges` *(array of objects, optional)*:
    - `from` *(string, required)*: Source node ID.
    - `to` *(string, required)*: Target node ID.
    - `label` *(string, optional)*: Text centered on the arrow.
- **Returns**:
  - `board`: Board metadata with `url`.

**Example call:**
```json
{
  "name": "create_diagram",
  "arguments": {
    "title": "CI/CD Pipeline",
    "direction": "LR",
    "nodes": [
      { "id": "git", "label": "Git Push", "shape": "rectangle", "color": "blue" },
      { "id": "ci", "label": "Automated Tests", "shape": "diamond", "color": "yellow" },
      { "id": "deploy", "label": "Production Deploy", "shape": "rectangle", "color": "green" }
    ],
    "edges": [
      { "from": "git", "to": "ci", "label": "trigger" },
      { "from": "ci", "to": "deploy", "label": "success" }
    ]
  }
}
```

---

### 10. `layout_board`
> Rearranges a messy existing board, redistributing boxes and connected arrows into regular layers without touching other loose elements.

- **Annotations**: `idempotentHint: true`
- **Input parameters (`inputSchema`)**:
  - `board_id` *(string, required, UUID)*: Board ID.
  - `direction` *(enum: `["TB", "LR", "BT", "RL"]`, optional, default: `"TB"`)*: New layout orientation.
- **Returns**:
  - `board`: Board metadata with `url`.
  - `moved`: Number of shapes and arrows repositioned.

**Example call:**
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
> Lists every folder the user created, so the agent can navigate the folder hierarchy.

- **Annotations**: `readOnlyHint: true`
- **Input parameters (`inputSchema`)**:
  - Empty object `{}`.
- **Returns**:
  - `folders`: A list of folders, each with `id`, `name` and `parent_id` (`null` for top-level folders).

**Example call:**
```json
{
  "name": "list_folders",
  "arguments": {}
}
```

---

### 12. `create_folder`
> Creates a new folder for organizing boards, with support for nesting.

- **Input parameters (`inputSchema`)**:
  - `name` *(string, required)*: Folder name.
  - `parent_id` *(string, optional, UUID)*: ID of the parent folder (to create a subfolder). When omitted, the folder is created at the top level.
- **Returns**:
  - `folder`: An object with `id`, `name` and `parent_id`.

**Example call:**
```json
{
  "name": "create_folder",
  "arguments": {
    "name": "Cloud Infrastructure",
    "parent_id": null
  }
}
```

---

### 13. `move_board`
> Moves a board to a target folder, or back to the top level of the dashboard.

- **Annotations**: `idempotentHint: true`
- **Input parameters (`inputSchema`)**:
  - `board_id` *(string, required, UUID)*: Board ID.
  - `folder_id` *(string or null, optional)*: Target folder ID, or `null` to move the board back to the top level.
- **Returns**:
  - `board`: Updated board metadata with `url`.

**Example call:**
```json
{
  "name": "move_board",
  "arguments": {
    "board_id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "folder_id": "8bb38d33-9fb4-4c4f-a7f4-ea30fb5b8822"
  }
}
```
