# REST API v1 Overview

The public **Heeey** API (`/api/v1`) lets you create, read, update, move and search boards and folders programmatically.

The API is designed to be lightweight and friendly to developers and autonomous agents, and it runs directly at the edge (*Edge Runtime* on Vercel).

---

## 🌐 Integration Details

- **Production base URL**: `https://heeey.click/api/v1`
- **Local environment**: `http://localhost:5173/api/v1`
- **Data format**: UTF-8 JSON
- **Authentication**: Bearer token in the `Authorization` HTTP header
- **CORS**: Enabled for all origins (`*`), supporting direct requests from browser-based tools, webhooks and CLIs.

---

## ⚡ API Design Principles

1. **Security in the database (zero secrets at the edge)**:
   - The edge function (`apiHandler.ts`) stores no master keys or superuser secrets.
   - Every request is authenticated directly in PostgreSQL via a SHA-256 cryptographic hash (`api_authenticate`). The user context (`auth.uid()`) is applied at the transaction level, so Row Level Security (RLS) policies protect every operation.
2. **Real-time updates (live broadcast)**:
   - Whenever you change or add elements to a board through `POST` or `PATCH`, the server sends a Supabase Realtime broadcast on the `heeey:room:{boardId}` channel.
   - Anyone with the board open in the browser sees the new elements appear live on screen without reloading the page!
3. **Ready-to-use links (`url`)**:
   - Every board response includes a formatted `url` property (e.g. `https://heeey.click/b/550e8400-e29b-41d4-a716-446655440000`), so scripts and bots can hand the direct link to the end user.
4. **Short-form elements (Element Skeleton)**:
   - You don't need to build huge objects with dozens of internal Excalidraw properties. The API accepts lean specs (`label`, `shape`, `start`, `end`) and generates the full elements automatically.

---

## 🧭 API Resource Summary

| Resource | Method | Route | Description |
|---|---|---|---|
| **API index** | `GET` | `/api/v1` | Returns the catalog of routes and accepted formats. |
| **Boards** | `GET` | `/api/v1/boards` | Lists the user's boards (with pagination and a folder filter). |
| **Create board** | `POST` | `/api/v1/boards` | Creates a new board, with or without initial elements. |
| **Get board** | `GET` | `/api/v1/boards/:id` | Returns metadata and every element in the scene. |
| **Update board** | `PATCH` | `/api/v1/boards/:id` | Updates the title, adds/changes elements or deletes them by ID. |
| **Trash** | `DELETE` | `/api/v1/boards/:id` | Moves the board to the trash (*soft delete*). |
| **Move board** | `POST` | `/api/v1/boards/:id/move` | Puts the board in a folder (or at the top level with `null`). |
| **Global search** | `GET` | `/api/v1/search?q=` | Full-text search across titles and text drawn on boards. |
| **List folders** | `GET` | `/api/v1/folders` | Lists all of the user's folders. |
| **Create folder** | `POST` | `/api/v1/folders` | Creates a folder at the top level or inside another folder. |
