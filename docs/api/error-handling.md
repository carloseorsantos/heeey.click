# Tratamento de Erros na API

A API do Heeey segue os padrões REST tradicionais, utilizando códigos de status HTTP convencionais para sinalizar o sucesso ou a falha de uma requisição.

---

## 📋 Formato de Erro Padrão

Todas as respostas de erro retornam um objeto JSON uniforme:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "elements deve ser uma lista de objetos com type."
  }
}
```

Onde:
- **`code`**: Identificador programático estável da classe do erro (adequado para checagens via `switch/case` em seu código).
- **`message`**: Descrição legível em linguagem natural explicando o motivo específico da falha.

---

## 🚦 Códigos de Status HTTP

| Status HTTP | Código (`code`) | Causa / Descrição |
|---|---|---|
| **`400 Bad Request`** | `invalid_request` ou `invalid_json` | Parâmetros obrigatórios ausentes, JSON malformatado, UUIDs inválidos ou tipo de elemento inexistente. |
| **`401 Unauthorized`** | `unauthorized` | Cabeçalho `Authorization` ausente, chave malformatada, chave revogada ou inexistente. |
| **`403 Forbidden`** | `forbidden` | A chave de API utilizada não possui escopo suficiente (ex.: chave somente leitura tentando fazer `POST`, `PATCH` ou `DELETE`). |
| **`404 Not Found`** | `not_found` | Quadro, pasta ou rota requisitada não existe ou não pertence à conta associada à chave. |
| **`409 Conflict`** | `conflict` | Conflito de estado do recurso (ex.: tentativa de editar ou adicionar elementos em um quadro que já está na lixeira). |
| **`500 Internal Server Error`** | `server_error` | Erro não previsto no processamento de banco ou na função de borda. |

---

## 🛡️ Exemplos de Respostas de Erro Comuns

### 1. Chave Ausente ou Inválida (401)
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

### 2. Escopo Insuficiente (403)
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

### 3. Modificação em Quadro na Lixeira (409)
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

### 4. Payload Inválido (400)
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
