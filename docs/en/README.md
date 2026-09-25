# Heeey Documentation (heeey.click)

> An interactive, real-time collaborative whiteboard with cloud persistence, a public REST API and an MCP server for AI agents.

Welcome to the official **Heeey** documentation. Inspired by the architecture and documentation of the Excalidraw ecosystem (`https://plus.excalidraw.com/docs`), it covers every feature, drawing tool, multiplayer collaboration, the REST API v1, the MCP (*Model Context Protocol*) server and Heeey's data model.

---

## 🧭 Quick Navigation

### 🎨 [Features & Whiteboard](features/whiteboard-editor.md)
Explore the vector canvas built on `@excalidraw/excalidraw` 0.18, light/dark themes, drawing tools, shapes, bound text, smart arrows and shortcuts.

### 👥 [Collaboration & Real Time](features/collaboration-realtime.md)
Learn how multiplayer works over Supabase Realtime (Broadcast and Presence), live cursors, collaborator names/colors, view vs. edit mode and shareable links.

### 📁 [Organization & Dashboard](features/folders-and-organization.md)
Learn about board management, nested folders, global search with text highlighting, templates (Brainstorming, Flowchart, Wireframe) and a trash that protects against accidental deletion.

### 🕒 [Version History](features/version-history.md)
See how automatic snapshots every 10 minutes, 30-day retention and pre-restore snapshots let you recover earlier states without losing anything.

### 🌍 [Internationalization (i18n)](features/i18n.md)
Native support for Portuguese (`pt-BR`), English (`en-US`) and Spanish (`es-ES`) in the app, on the website pages and in this documentation, with browser language detection, ICU plurals and Excalidraw language sync.

### 🧩 [Personal Libraries](features/libraries.md)
Cloud persistence of reusable component libraries for signed-in users, a local cache for guests and automatic migration on first sign-in.

### 🖼️ [Media & Image Optimization](features/media-and-images.md)
An automatic client-side WebP/JPEG compression pipeline (max 1600px, ~150KB), async upload to Supabase Storage (`board-media`) and a graceful offline fallback.

### 🔍 [Global Canvas Search](features/search.md)
Full-text search in PostgreSQL with `unaccent` and GIN indexes, across titles and every piece of text drawn on your boards, with highlighted snippets.

### 🔌 [REST API v1](api/overview.md)
Automate creating, reading and editing boards and folders. Personal key authentication (`hk_...`), short-form element specs, pagination and real-time broadcast.

### 🤖 [MCP Server for AI](mcp/overview.md)
Connect Claude Code, Claude Desktop, Cursor and other AI agents over Streamable HTTP (`/api/mcp`). Create diagrams with automatic layered layout (Dagre / Sugiyama) and organize boards programmatically.

---

## ⚡ What Is Heeey?

Heeey is a modern visual collaboration web app built for speed, simplicity and openness:

- **Whiteboard core**: Uses the official `@excalidraw/excalidraw` 0.18.x engine, keeping the hand-drawn look, full-fidelity SVG/PNG export and complete support for element libraries.
- **Ultra-fast multiplayer**: Realtime Broadcast and Presence on the `heeey:room:{boardId}` channel, for minimal latency on canvas changes and live cursors.
- **Hassle-free sign-in**: Hybrid access — guests can create boards instantly; registered users sign in without passwords through a Magic Link (Email OTP) and inherit their guest boards automatically.
- **Programmable & agent-friendly**: The whole platform has first-class support for automation through the REST API and the MCP protocol, so LLM agents can read, understand, generate and organize complex diagrams in seconds.
- **Fully internationalized**: Native, test-verified support for Portuguese (`pt-BR`), English (`en-US`) and Spanish (`es-ES`).

---

## 📖 Full Document Index

1. **Overview & Getting Started**:
   - [General Quick Start (Getting Started)](getting-started.md)
2. **Whiteboard & App Features**:
   - [Canvas & Drawing Tools](features/whiteboard-editor.md)
   - [Collaboration & Real Time](features/collaboration-realtime.md)
   - [Teams, Projects & Sharing](features/teams-and-sharing.md)
   - [Folders, Organization & Trash](features/folders-and-organization.md)
   - [Version History & Restore](features/version-history.md)
   - [Internationalization (i18n)](features/i18n.md)
   - [Component Libraries](features/libraries.md)
   - [Images & Media Optimization](features/media-and-images.md)
   - [Global Search in Canvas Text](features/search.md)
3. **Public REST API (`/api/v1`)**:
   - [API Overview](api/overview.md)
   - [API Quick Start](api/getting-started.md)
   - [Authentication & Key Scopes](api/authentication.md)
   - [Paginating Results](api/pagination.md)
   - [Rate & Operational Limits](api/rate-limiting.md)
   - [Error Handling](api/error-handling.md)
   - [Scene Content Schema (Element Spec)](api/scene-content-schema.md)
   - [Full Endpoint Reference](api/endpoints.md)
4. **MCP Server (Model Context Protocol)**:
   - [MCP Overview](mcp/overview.md)
   - [Setting Up Agents (Claude Code, Desktop, Cursor)](mcp/getting-started.md)
   - [MCP Authentication & Permissions](mcp/auth-and-permissions.md)
   - [Full Catalog of the 14 MCP Tools](mcp/tools.md)
   - [Automatic Diagram Layout Engine](mcp/diagram-layout.md)
5. **Discovery by Agents & Language Models**:
   - [Short Index for LLMs (`llms.txt`)](llms.txt)
   - [Full Text Dump for LLMs (`llms-full.txt`)](llms-full.txt)
