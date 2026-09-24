# Conectar agentes de IA a Heeey mediante MCP

Esta guía explica paso a paso cómo conectar el servidor MCP de Heeey a los clientes de IA más populares: **Claude Code**, **Claude Desktop** y **Cursor**.

---

## 🔑 Requisito previo: obtén una clave de API

1. Entra en [heeey.click](https://heeey.click) e inicia sesión en tu cuenta (Magic Link).
2. Abre el diálogo **Claves de API** (icono de la llave en el panel).
3. Crea una clave con alcance de **lectura y escritura** (`read`, `write`).
4. Copia el valor generado (empieza por `hk_...`).

---

## 1. Claude Code (CLI)

Claude Code admite servidores MCP HTTP directamente desde la terminal con un solo comando:

```bash
claude mcp add --transport http heeey https://heeey.click/api/mcp --header "Authorization: Bearer hk_TU_CLAVE_AQUI"
```

Para comprobar la conexión:
```bash
claude mcp list
```

Verás el servidor `heeey` conectado, con herramientas como `create_diagram`, `list_boards`, etc.

---

## 2. Claude Desktop

Para usar Heeey en la aplicación de escritorio de Anthropic:

1. Abre el archivo de configuración de Claude Desktop:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
2. Añade la configuración de Heeey en la sección `mcpServers`:

```json
{
  "mcpServers": {
    "heeey": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote-client",
        "https://heeey.click/api/mcp",
        "--header",
        "Authorization: Bearer hk_TU_CLAVE_AQUI"
      ]
    }
  }
}
```
*(Nota: Claude Desktop requiere de forma nativa clientes SSE/HTTP mediante un adaptador local, o una conexión directa si tu versión instalada lo admite).*

3. Reinicia Claude Desktop. El icono de herramientas (martillo) mostrará las funciones de Heeey activas.

---

## 3. Cursor

En Cursor puedes registrar el servidor MCP en los ajustes:

1. Abre **Settings** > **Cursor Settings** > **Features** > **MCP Servers**.
2. Haz clic en **Add New MCP Server**.
3. Rellena los campos:
   - **Name**: `heeey`
   - **Type**: `command` (o `sse`/`http`, según tu versión)
   - **Command**:
     ```bash
     npx -y mcp-remote-client https://heeey.click/api/mcp --header "Authorization: Bearer hk_TU_CLAVE_AQUI"
     ```
4. Guarda y recarga el editor.

---

## 💡 Ejemplos de prompts para tu agente

Cuando el agente esté conectado, prueba peticiones naturales como:

> *«Crea en Heeey un diagrama de flujo con el ciclo de vida de una petición HTTP que pasa por Nginx, un API Gateway, el microservicio de usuarios y PostgreSQL. Usa colores agradables».*

> *«Lista mis pizarras recientes en Heeey y resume lo que hay dibujado en la pizarra "Arquitectura backend"».*

> *«La pizarra "Flujo de compra" está un poco desordenada. Usa la herramienta layout_board para organizarla de izquierda a derecha».*
