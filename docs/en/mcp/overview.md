# MCP (Model Context Protocol) Server Overview

**Heeey** provides a native **Model Context Protocol (MCP)** server, the open industry standard for connecting language models (LLMs) to external data sources and tools.

With Heeey's MCP server, autonomous agents (such as Claude Code, Claude Desktop, Cursor and others) can inspect existing whiteboards, create complex architecture diagrams, tidy up messy boards and actively collaborate with people in real time.

---

## 🚀 How MCP Works in Heeey

- **Single production endpoint**: `https://heeey.click/api/mcp`
- **Transport**: **Streamable HTTP** (POST with a JSON-RPC 2.0 payload and control headers).
- **Stateless**: Every request is authenticated independently through the database, so it scales instantly in serverless/edge environments with no daemons or dedicated WebSockets to manage for the agent.
- **Supported protocol versions**:
  - `2025-06-18`
  - `2025-03-26`
  - `2024-11-05`
- **Verified interoperability**: The server passes automated integration tests against the official `@modelcontextprotocol/sdk` SDK.

---

## 🤖 What the AI Agent Can Do

When you connect an agent to Heeey, it gets a full set of tools that can:

1. **Read scenes smartly (`get_board`)**:
   - By default, the agent gets a compact, contextual view of the scene: shapes with their inner text (`label`), arrows showing which nodes they connect (`start`, `end`) and rounded coordinates. This saves up to 80% of the LLM's context.
2. **Generate diagrams automatically (`create_diagram`)**:
   - The agent only has to list the nodes (`label`, `shape`, `color`) and the edges (`from`, `to`, `label`).
   - Heeey's internal layout engine sizes each box to its text, spreads the elements across layers with no overlaps and routes arrows around the shapes.
3. **Tidy up existing boards (`layout_board`)**:
   - Did someone draw a messy flow? The agent can call `layout_board` to align the shapes and route the arrows automatically in the direction you choose (`TB`, `LR`, `BT`, `RL`).
4. **Live, visible collaboration**:
   - When the agent adds or edits elements, the change is broadcast instantly over Supabase Realtime. The user watches the shapes appear on the canvas while chatting with the assistant!
