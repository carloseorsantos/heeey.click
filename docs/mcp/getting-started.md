# Conectando Agentes de IA ao Heeey via MCP

Este guia mostra passo a passo como conectar o servidor MCP do Heeey aos clientes de IA mais populares: **Claude Code**, **Claude Desktop** e **Cursor**.

---

## 🔑 Pré-requisito: Obter uma Chave de API

1. Acesse o [heeey.click](https://heeey.click) e entre na sua conta (Magic Link).
2. Abra o modal de **Chaves de API** (ícone de chave no Dashboard).
3. Crie uma chave com escopo de **Leitura e Escrita** (`read`, `write`).
4. Copie o valor gerado (iniciado com `hk_...`).

---

## 1. Claude Code (CLI)

O Claude Code suporta servidores MCP HTTP diretamente pelo terminal com um único comando:

```bash
claude mcp add --transport http heeey https://heeey.click/api/mcp --header "Authorization: Bearer hk_SUA_CHAVE_AQUI"
```

Para verificar a conexão:
```bash
claude mcp list
```

Você verá o servidor `heeey` conectado com ferramentas como `create_diagram`, `list_boards`, etc.

---

## 2. Claude Desktop

Para utilizar o Heeey na aplicação desktop da Anthropic:

1. Abra o arquivo de configuração do Claude Desktop:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
2. Adicione a configuração do Heeey na seção `mcpServers`:

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
        "Authorization: Bearer hk_SUA_CHAVE_AQUI"
      ]
    }
  }
}
```
*(Nota: o Claude Desktop nativamente requer clientes SSE/HTTP através de um adaptador local ou conexão direta se suportado na versão instalada).*

3. Reinicie o Claude Desktop. O ícone de ferramentas (martelo) indicará as funções do Heeey ativas.

---

## 3. Cursor IDE

No Cursor, você pode registrar o servidor MCP nas configurações:

1. Abra **Settings** > **Cursor Settings** > **Features** > **MCP Servers**.
2. Clique em **Add New MCP Server**.
3. Preencha os campos:
   - **Name**: `heeey`
   - **Type**: `command` (ou `sse`/`http` conforme sua versão)
   - **Command**:
     ```bash
     npx -y mcp-remote-client https://heeey.click/api/mcp --header "Authorization: Bearer hk_SUA_CHAVE_AQUI"
     ```
4. Salve e recarregue o editor.

---

## 💡 Exemplos de Prompts para o seu Agente

Assim que o agente estiver conectado, experimente comandos naturais como:

> *"Crie um fluxograma no Heeey ilustrando o ciclo de vida de uma requisição HTTP passando por Nginx, API Gateway, microsserviço de usuários e PostgreSQL. Use cores agradáveis."*

> *"Liste meus quadros recentes no Heeey e resuma o que está desenhado no quadro 'Arquitetura Backend'."*

> *"O quadro 'Fluxo de Compra' está meio desordenado. Use a ferramenta layout_board para organizá-lo no sentido Left-to-Right."*
