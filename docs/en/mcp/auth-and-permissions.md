# MCP Server Authentication & Permissions

Heeey's MCP server runs over the **Streamable HTTP** transport (`https://heeey.click/api/mcp`) and authenticates every request with **Personal API Keys**.

This document explains how access is checked, how security policies are enforced in the database and how tool annotations guide safe execution by language models (LLMs).

---

## 🔑 How Authentication Works

When you set up an MCP client (such as Claude Code, Claude Desktop or Cursor), the API key must be sent in the connection's HTTP headers:

```http
POST /api/mcp HTTP/1.1
Host: heeey.click
Authorization: Bearer hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
Content-Type: application/json
Accept: application/json
```

The alternative `X-API-Key` header is also accepted:
```http
X-API-Key: hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
```

### Missing or Invalid Key
When the request has no valid credential:
- It returns HTTP status `401 Unauthorized`.
- It includes the `WWW-Authenticate: Bearer realm="heeey.click"` header.
- The body contains the standard JSON-RPC 2.0 error (the message is in Portuguese):
  ```json
  {
    "jsonrpc": "2.0",
    "id": null,
    "error": {
      "code": -32001,
      "message": "Envie sua chave de API do heeey.click em Authorization: Bearer <chave>."
    }
  }
  ```

---

## 🛡️ Scopes & Data Isolation in the Database

MCP tools don't run with global admin permissions. Each tool calls PostgreSQL functions that invoke `public.api_authenticate(p_key, required_scope)`:

1. **User context (`v_user`)**: The database finds the key's owner from the SHA-256 hash and acts strictly on that user's records.
2. **Supported scopes**:
   - **`read`**: Permission to query and read information.
   - **`write`**: Permission to create, update, draw and delete.

### Scope Required by Each MCP Tool:

| MCP tool | Minimum scope | What it does |
|---|---|---|
| `list_boards` | `read` | Lists the account's boards. |
| `search_boards` | `read` | Full-text search across titles and text. |
| `get_board` | `read` | Reads the board's elements and state. |
| `list_folders` | `read` | Lists folders. |
| `create_board` | `write` | Creates a new board. |
| `add_elements` | `write` | Adds or updates elements on the canvas. |
| `delete_elements` | `write` | Deletes specific elements from the scene. |
| `rename_board` | `write` | Changes a board's title. |
| `trash_board` | `write` | Moves the board to the trash. |
| `create_diagram` | `write` | Creates diagrams with Dagre auto-layout. |
| `layout_board` | `write` | Visually rearranges an existing board. |
| `create_folder` | `write` | Creates a new folder. |
| `move_board` | `write` | Puts a board inside a folder. |

> If a key with only the `read` scope tries to call a write tool (such as `create_diagram`), the call changes nothing and returns the tool error message `"Esta chave de API não tem permissão de escrita."` ("This API key doesn't have write permission.").

---

## 🚦 Tool Annotations

The MCP protocol lets servers tell AI clients about each tool's safety characteristics. Heeey uses three key annotations in its catalog:

### 1. `readOnlyHint: true`
- **Tools**: `list_boards`, `search_boards`, `get_board`, `list_folders`.
- **Effect on the agent**: The call changes no state. Autonomous agents can run these freely in the background to inspect and plan before drawing.

### 2. `destructiveHint: true`
- **Tools**: `delete_elements`, `trash_board`.
- **Effect on the agent**: Data will be removed or archived. AI clients usually ask the human user for explicit confirmation before running tools with this annotation.

### 3. `idempotentHint: true`
- **Tools**: `rename_board`, `trash_board`, `layout_board`, `move_board`.
- **Effect on the agent**: Sending the same call several times produces the same end result, so retries are safe after transient connection failures.

---

## ⚙️ Protocol vs. Tool Errors

Heeey's MCP server clearly separates the two levels of error:

### 1. JSON-RPC 2.0 Protocol Errors
Network failures, invalid request format or unimplemented methods are answered at the protocol level:
- `-32700`: Malformed JSON (*Parse error*).
- `-32600`: The object doesn't follow the JSON-RPC 2.0 spec (*Invalid Request*).
- `-32601`: Unknown method (*Method not found*).
- `-32602`: Unknown tool name or missing arguments.
- `-32001`: Missing authentication or revoked key.

### 2. Tool Execution Errors (`isError: true`)
When the request is valid but the operation fails in Heeey (for example trying to edit a board that is already in the trash, passing a nonexistent UUID or violating permissions), the server returns a successful JSON-RPC response containing the tool's error payload:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Quadro na lixeira é somente leitura."
      }
    ],
    "isError": true
  }
}
```

This matters for AI agents: instead of breaking the client's connection, the LLM reads the error's explanation and can reason about it and fix its plan (e.g. restore the board before drawing, or pick another valid board).
