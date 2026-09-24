# Rate & Operational Limits

To keep things stable, fast and fair across every user and integration, Heeey sets operational limits for the REST API (`/api/v1`) and the MCP server (`/api/mcp`).

---

## 🛑 Structural Data Limits

| Scope | Limit | Error code | Details |
|---|---|---|---|
| **Elements per call (`elements`)** | Max **5,000 elements** | `400 Bad Request` (`invalid_request`) | Checked by the `api_check_elements` database function. Prevents oversized payloads that would overload the canvas in connected clients' browsers. |
| **Nodes per diagram (`create_diagram`)** | Max **300 nodes** | `400 Bad Request` (`invalid_request`) | The Dagre layout engine lays out up to 300 nodes quickly, with collision-free arrow routing. |
| **Active API keys per user** | Max **20 keys** | `400 Bad Request` (`invalid_request`) | Each account can keep up to 20 active keys at once. Revoke old keys before creating new ones if you hit the quota. |
| **Maximum image size** | **1,600 px** (width/height) | Automatic resize | Dragged or pasted images are resized on the client before being uploaded to Supabase Storage (`board-media`). |
| **Target size for optimized media** | **< 150 KB** per image | Automatic compression | The pipeline converts to WebP (quality 0.8), keeping high fidelity with very low bandwidth use. |
| **Execution timeout (Edge)** | **25 seconds** | `504 Gateway Timeout` | The edge functions (`api/v1.ts` and `api/mcp.ts`) run on the Vercel Edge Runtime and typically respond in under 100ms. |

---

## 🚦 Concurrency & Network Limits

1. **Concurrent requests**:
   - The serverless architecture on Vercel Edge scales automatically to handle peaks of concurrent requests.
   - Concurrent updates (`PATCH /boards/:id` or MCP calls) are serialized by PostgreSQL transactions with row locks (`for update`), preventing state corruption.

2. **Supabase database quotas**:
   - The API functions connect straight to PostgreSQL through authenticated RPC calls.
   - If the database connection pool is saturated, the API responds with a `500 Server Error` status.

---

## 💡 Recommendations & Best Practices

### 1. Batch Element Updates
Instead of sending 50 separate requests with one element each through `PATCH /api/v1/boards/:id`, send a single array with all 50 elements. This cuts network overhead and triggers only one real-time broadcast to collaborators.

### 2. Retry with Exponential Backoff
If your integration gets a temporary network error or a 500/504 status, retry with a growing delay:

```typescript
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 500) {
  try {
    const res = await fetch(url, options);
    if (res.status >= 500 && retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
}
```

### 3. Use `originBeside` and Reuse Nodes
When generating diagrams on existing boards through MCP, reuse existing node IDs to update them in place, or let the layout engine work out the spacing without overloading the canvas's memory.
