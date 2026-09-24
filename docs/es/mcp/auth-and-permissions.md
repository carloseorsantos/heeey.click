# Autenticación y permisos en el servidor MCP

El servidor MCP de Heeey funciona sobre el transporte **Streamable HTTP** (`https://heeey.click/api/mcp`) y autentica cada petición mediante **claves personales de API** (*Personal API Keys*).

Este documento explica cómo se valida el acceso, cómo se aplican las políticas de seguridad en la base de datos y cómo las anotaciones de las herramientas orientan una ejecución segura por parte de los modelos de lenguaje (LLMs).

---

## 🔑 Cómo funciona la autenticación

Al configurar un cliente MCP (como Claude Code, Claude Desktop o Cursor), la clave de API debe enviarse en las cabeceras HTTP de la conexión:

```http
POST /api/mcp HTTP/1.1
Host: heeey.click
Authorization: Bearer hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
Content-Type: application/json
Accept: application/json
```

También se acepta la cabecera alternativa `X-API-Key`:
```http
X-API-Key: hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
```

### Clave ausente o no válida
Si la petición no incluye una credencial válida:
- Devuelve el estado HTTP `401 Unauthorized`.
- Incluye la cabecera `WWW-Authenticate: Bearer realm="heeey.click"`.
- El cuerpo contiene el error estándar de JSON-RPC 2.0 (el mensaje está en portugués):
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

## 🛡️ Alcances y aislamiento de datos en la base de datos

Las herramientas MCP no se ejecutan con permisos de administración globales. Cada herramienta llama a funciones de PostgreSQL que invocan `public.api_authenticate(p_key, required_scope)`:

1. **Contexto del usuario (`v_user`)**: la base de datos identifica al dueño de la clave a partir del hash SHA-256 y actúa estrictamente sobre los registros de ese usuario.
2. **Alcances admitidos**:
   - **`read`**: permiso para consultar y leer información.
   - **`write`**: permiso para crear, actualizar, dibujar y eliminar.

### Alcance necesario para cada herramienta MCP:

| Herramienta MCP | Alcance mínimo | Qué hace |
|---|---|---|
| `list_boards` | `read` | Lista las pizarras de la cuenta. |
| `search_boards` | `read` | Búsqueda de texto completo en títulos y textos. |
| `get_board` | `read` | Lee los elementos y el estado de la pizarra. |
| `list_folders` | `read` | Lista las carpetas. |
| `create_board` | `write` | Crea una pizarra nueva. |
| `add_elements` | `write` | Añade o actualiza elementos en el lienzo. |
| `delete_elements` | `write` | Elimina elementos concretos de la escena. |
| `rename_board` | `write` | Cambia el título de una pizarra. |
| `trash_board` | `write` | Envía la pizarra a la papelera. |
| `create_diagram` | `write` | Crea diagramas con disposición automática Dagre. |
| `layout_board` | `write` | Reorganiza visualmente una pizarra existente. |
| `create_folder` | `write` | Crea una carpeta nueva. |
| `move_board` | `write` | Coloca una pizarra dentro de una carpeta. |

> Si una clave que solo tiene el alcance `read` intenta usar una herramienta de escritura (como `create_diagram`), la llamada no cambia nada y devuelve el mensaje de error de la herramienta `"Esta chave de API não tem permissão de escrita."` («Esta clave de API no tiene permiso de escritura»).

---

## 🚦 Anotaciones de las herramientas (Tool Annotations)

El protocolo MCP permite indicar a los clientes de IA las características de seguridad de cada herramienta. Heeey usa tres anotaciones fundamentales en su catálogo:

### 1. `readOnlyHint: true`
- **Herramientas**: `list_boards`, `search_boards`, `get_board`, `list_folders`.
- **Efecto en el agente**: la llamada no cambia ningún estado. Los agentes autónomos pueden ejecutarlas libremente en segundo plano para inspeccionar y planificar antes de dibujar.

### 2. `destructiveHint: true`
- **Herramientas**: `delete_elements`, `trash_board`.
- **Efecto en el agente**: indica que se van a eliminar o archivar datos. Los clientes de IA suelen pedir confirmación explícita a la persona antes de ejecutar herramientas con esta anotación.

### 3. `idempotentHint: true`
- **Herramientas**: `rename_board`, `trash_board`, `layout_board`, `move_board`.
- **Efecto en el agente**: repetir la misma llamada varias veces produce el mismo resultado final, así que los reintentos son seguros tras fallos de conexión pasajeros.

---

## ⚙️ Errores de protocolo frente a errores de herramienta

El servidor MCP de Heeey distingue con precisión los dos niveles de error:

### 1. Errores del protocolo JSON-RPC 2.0
Los fallos de red, el formato de petición no válido o los métodos no implementados se responden a nivel de protocolo:
- `-32700`: JSON mal formado (*Parse error*).
- `-32600`: el objeto no cumple la especificación JSON-RPC 2.0 (*Invalid Request*).
- `-32601`: método desconocido (*Method not found*).
- `-32602`: nombre de herramienta desconocido o faltan argumentos.
- `-32001`: falta la autenticación o la clave está revocada.

### 2. Errores de ejecución de herramientas (`isError: true`)
Cuando la petición es válida pero la operación falla en Heeey (por ejemplo, al intentar editar una pizarra que ya está en la papelera, pasar un UUID inexistente o saltarse los permisos), el servidor devuelve una respuesta JSON-RPC correcta que contiene el payload de error de la herramienta:

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

Esto es clave para los agentes de IA: en lugar de cortar la conexión del cliente, el LLM lee la explicación del error y puede razonar y corregir su plan (p. ej. restaurar la pizarra antes de dibujar o elegir otra pizarra válida).
