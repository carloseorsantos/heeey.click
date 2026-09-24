# Connecting AI Agents to Heeey via MCP

This guide shows step by step how to connect Heeey's MCP server to the most popular AI clients: **Claude Code**, **Claude Desktop** and **Cursor**.

---

## 🔑 Prerequisite: Get an API Key

1. Go to [heeey.click](https://heeey.click) and sign in to your account (Magic Link).
2. Open the **API keys** dialog (key icon on the dashboard).
3. Create a key with **Read and Write** scope (`read`, `write`).
4. Copy the generated value (starting with `hk_...`).

---

## 1. Claude Code (CLI)

Claude Code supports HTTP MCP servers straight from the terminal with a single command:

```bash
claude mcp add --transport http heeey https://heeey.click/api/mcp --header "Authorization: Bearer hk_YOUR_KEY_HERE"
```

To check the connection:
```bash
claude mcp list
```

You'll see the `heeey` server connected, with tools such as `create_diagram`, `list_boards`, etc.

---

## 2. Claude Desktop

To use Heeey in Anthropic's desktop app:

1. Open the Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
2. Add the Heeey configuration to the `mcpServers` section:

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
        "Authorization: Bearer hk_YOUR_KEY_HERE"
      ]
    }
  }
}
```
*(Note: Claude Desktop natively requires SSE/HTTP clients through a local adapter, or a direct connection if your installed version supports it.)*

3. Restart Claude Desktop. The tools icon (hammer) shows the active Heeey functions.

---

## 3. Cursor IDE

In Cursor, you can register the MCP server in the settings:

1. Open **Settings** > **Cursor Settings** > **Features** > **MCP Servers**.
2. Click **Add New MCP Server**.
3. Fill in the fields:
   - **Name**: `heeey`
   - **Type**: `command` (or `sse`/`http`, depending on your version)
   - **Command**:
     ```bash
     npx -y mcp-remote-client https://heeey.click/api/mcp --header "Authorization: Bearer hk_YOUR_KEY_HERE"
     ```
4. Save and reload the editor.

---

## 💡 Example Prompts for Your Agent

Once the agent is connected, try natural requests like:

> *"Create a flowchart on Heeey showing the lifecycle of an HTTP request going through Nginx, an API Gateway, the users microservice and PostgreSQL. Use pleasant colors."*

> *"List my recent boards on Heeey and summarize what's drawn on the 'Backend Architecture' board."*

> *"The 'Checkout Flow' board is a bit messy. Use the layout_board tool to arrange it left to right."*
