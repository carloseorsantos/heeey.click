# API Error Handling

The Heeey API follows traditional REST conventions, using standard HTTP status codes to signal whether a request succeeded or failed.

---

## 📋 Standard Error Format

Every error response returns the same JSON shape:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "elements deve ser uma lista de objetos com type."
  }
}
```

Where:
- **`code`**: A stable programmatic identifier for the error class (suitable for `switch/case` checks in your code).
- **`message`**: A human-readable description of the specific reason for the failure.

> **Note**: Error messages are currently returned in Portuguese. Branch on `code`, which never changes, rather than on `message`.

---

## 🚦 HTTP Status Codes

| HTTP status | Code (`code`) | Cause / description |
|---|---|---|
| **`400 Bad Request`** | `invalid_request` or `invalid_json` | Missing required parameters, malformed JSON, invalid UUIDs or an unknown element type. |
| **`401 Unauthorized`** | `unauthorized` | Missing `Authorization` header, or a malformed, revoked or unknown key. |
| **`403 Forbidden`** | `forbidden` | The API key doesn't have enough scope (e.g. a read-only key trying to `POST`, `PATCH` or `DELETE`). |
| **`404 Not Found`** | `not_found` | The requested board, folder or route doesn't exist or doesn't belong to the account tied to the key. |
| **`409 Conflict`** | `conflict` | The resource is in a conflicting state (e.g. trying to edit or add elements to a board that is already in the trash). |
| **`500 Internal Server Error`** | `server_error` | An unexpected error in database processing or in the edge function. |

---

## 🛡️ Common Error Response Examples

### 1. Missing or Invalid Key (401)
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": {
    "code": "unauthorized",
    "message": "Envie sua chave de API em Authorization: Bearer <chave>."
  }
}
```

### 2. Insufficient Scope (403)
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": {
    "code": "forbidden",
    "message": "Esta chave de API não tem permissão de escrita."
  }
}
```

### 3. Changing a Board in the Trash (409)
```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "error": {
    "code": "conflict",
    "message": "Quadro na lixeira é somente leitura."
  }
}
```

### 4. Invalid Payload (400)
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "invalid_request",
    "message": "id deve ser um UUID."
  }
}
```
