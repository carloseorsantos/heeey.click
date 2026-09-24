# Gestión de errores en la API

La API de Heeey sigue las convenciones REST tradicionales y usa códigos de estado HTTP estándar para indicar si una petición ha tenido éxito o ha fallado.

---

## 📋 Formato de error estándar

Todas las respuestas de error devuelven un objeto JSON con la misma forma:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "elements deve ser uma lista de objetos com type."
  }
}
```

Donde:
- **`code`**: identificador programático estable del tipo de error (adecuado para comprobaciones con `switch/case` en tu código).
- **`message`**: descripción legible que explica el motivo concreto del fallo.

> **Nota**: por ahora, los mensajes de error se devuelven en portugués. Usa `code`, que nunca cambia, para tomar decisiones en tu código, y no `message`.

---

## 🚦 Códigos de estado HTTP

| Estado HTTP | Código (`code`) | Causa / descripción |
|---|---|---|
| **`400 Bad Request`** | `invalid_request` o `invalid_json` | Faltan parámetros obligatorios, JSON mal formado, UUID no válidos o tipo de elemento inexistente. |
| **`401 Unauthorized`** | `unauthorized` | Falta la cabecera `Authorization`, o la clave está mal formada, revocada o no existe. |
| **`403 Forbidden`** | `forbidden` | La clave de API no tiene alcance suficiente (p. ej. una clave de solo lectura que intenta hacer `POST`, `PATCH` o `DELETE`). |
| **`404 Not Found`** | `not_found` | La pizarra, la carpeta o la ruta solicitada no existe o no pertenece a la cuenta asociada a la clave. |
| **`409 Conflict`** | `conflict` | Conflicto con el estado del recurso (p. ej. intentar editar o añadir elementos a una pizarra que ya está en la papelera). |
| **`500 Internal Server Error`** | `server_error` | Error inesperado al procesar en la base de datos o en la función edge. |

---

## 🛡️ Ejemplos de respuestas de error habituales

### 1. Clave ausente o no válida (401)
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

### 2. Alcance insuficiente (403)
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

### 3. Modificar una pizarra de la papelera (409)
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

### 4. Payload no válido (400)
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
