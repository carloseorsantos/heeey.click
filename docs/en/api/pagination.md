# API Pagination

When listing large collections (such as boards or search results), Heeey uses the standard **Offset & Limit** pagination model.

---

## 🧭 Pagination Parameters

Endpoints that support pagination accept these query parameters:

| Parameter | Type | Default | Minimum | Maximum | Description |
|---|---|---|---|---|---|
| `limit` | `integer` | `50` | `1` | `200` | Maximum number of records to return in the current page. |
| `offset` | `integer` | `0` | `0` | — | Number of records to skip from the start of the ordering. |

> **Security Note**: If you send a `limit` above 200 or below 1, the Heeey database automatically clamps it to the allowed range (`least(greatest(limit, 1), 200)`) without returning an error.

---

## 📋 Endpoints That Support Pagination

### 1. `GET /api/v1/boards`
Lists the boards owned by the API key's user, newest edit first (`updated_at desc`).

```http
GET /api/v1/boards?limit=25&offset=50 HTTP/1.1
Host: heeey.click
Authorization: Bearer hk_...
```

**Filters you can combine with pagination:**
- `folder_id=<uuid>`: Pages only through boards in the given folder.
- `include_trashed=true`: Includes boards in the trash.

### 2. `GET /api/v1/search`
Text search across titles and content drawn on the canvas. Accepts:
- `limit`: Maximum number of results (default: `20`).
- Results are ordered by relevance score (`rank desc`).

```http
GET /api/v1/search?q=kubernetes&limit=10 HTTP/1.1
Host: heeey.click
Authorization: Bearer hk_...
```

---

## 💻 Implementation Examples

### Example 1: cURL

To fetch the first 3 pages of 50 boards:

```bash
# Page 1 (boards 0 to 49)
curl "https://heeey.click/api/v1/boards?limit=50&offset=0" \
  -H "Authorization: Bearer hk_..."

# Page 2 (boards 50 to 99)
curl "https://heeey.click/api/v1/boards?limit=50&offset=50" \
  -H "Authorization: Bearer hk_..."

# Page 3 (boards 100 to 149)
curl "https://heeey.click/api/v1/boards?limit=50&offset=100" \
  -H "Authorization: Bearer hk_..."
```

---

### Example 2: TypeScript / JavaScript (Iterating Over Every Page)

```typescript
interface BoardSummary {
  id: string;
  title: string;
  url: string;
  updated_at: string;
}

async function fetchAllBoards(apiKey: string): Promise<BoardSummary[]> {
  const allBoards: BoardSummary[] = [];
  const pageSize = 100;
  let offset = 0;

  while (true) {
    const response = await fetch(
      `https://heeey.click/api/v1/boards?limit=${pageSize}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const boards: BoardSummary[] = data.boards || [];
    allBoards.push(...boards);

    // A page with fewer items than the limit means we've reached the end
    if (boards.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allBoards;
}
```

---

### Example 3: Python

```python
import requests

API_KEY = "hk_..."
BASE_URL = "https://heeey.click/api/v1/boards"

def get_all_boards():
    boards = []
    limit = 50
    offset = 0

    while True:
        resp = requests.get(
            BASE_URL,
            headers={"Authorization": f"Bearer {API_KEY}"},
            params={"limit": limit, "offset": offset}
        )
        resp.raise_for_status()
        batch = resp.json().get("boards", [])
        boards.extend(batch)

        if len(batch) < limit:
            break
        offset += limit

    return boards
```

---

## 🎯 Best Practices

1. **Avoid huge offsets**: For accounts with thousands of boards, combine pagination with the `folder_id` filter to keep queries within small ranges.
2. **Stop condition**: The API doesn't return a total count (to keep latency minimal), so the right way to end the loop is to check whether the number of items returned in `boards` is strictly smaller than the `limit` you asked for.
