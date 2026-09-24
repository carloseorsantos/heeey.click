# Getting Started with the API

> Create your first board in Heeey programmatically in under 3 minutes.

The **Heeey** REST API v1 lets you create, query, update and organize whiteboards and diagrams straight from code, automation scripts, webhooks or autonomous agents.

---

## ⚡ Step 1: Create Your API Key

Every API call is authenticated with a **Personal API Key** tied to your account:

1. Go to [heeey.click](https://heeey.click) and sign in to your account (via Magic Link).
2. On the dashboard, click the key icon (**API keys**) in the top header.
3. Click **"New key"**:
   - Give the key a name (e.g. `test-script`).
   - Select the **Read** (`read`) and **Write** (`write`) scopes.
4. Copy the generated key (`hk_...`). It is shown only once.

---

## 🚀 Step 2: Create Your First Board

Send a `POST` request to `/api/v1/boards` with the board title and some basic shapes.

You can use the short element format (**Element Spec**), passing only the type, coordinates and text (`label`):

```bash
curl -X POST https://heeey.click/api/v1/boards \
  -H "Authorization: Bearer hk_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "First Flow via API",
    "elements": [
      {
        "id": "step-1",
        "type": "rectangle",
        "x": 100,
        "y": 150,
        "label": "Process Start",
        "backgroundColor": "#a5d8ff",
        "strokeColor": "#1971c2"
      },
      {
        "id": "step-2",
        "type": "diamond",
        "x": 380,
        "y": 135,
        "label": "Approved?",
        "backgroundColor": "#ffec99",
        "strokeColor": "#f08c00"
      },
      {
        "type": "arrow",
        "start": { "id": "step-1" },
        "end": { "id": "step-2" },
        "label": "submits"
      }
    ]
  }'
```

### Successful Response (`201 Created`):
```json
{
  "board": {
    "id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "title": "First Flow via API",
    "folder_id": null,
    "access_level": "edit",
    "created_at": "2026-09-23T14:00:00Z",
    "updated_at": "2026-09-23T14:00:00Z",
    "deleted_at": null,
    "element_count": 5,
    "url": "https://heeey.click/b/e67e3a1e-8e89-4089-a5f1-382a39281a92"
  }
}
```

> **Tip**: Copy the link returned in `url` and open it in your browser to see the board drawn with its colors and magnetic bindings perfectly in place!

---

## 👁️ Step 3: Read the Board's Data

To read the current state of the board you created:

```bash
curl -X GET https://heeey.click/api/v1/boards/e67e3a1e-8e89-4089-a5f1-382a39281a92 \
  -H "Authorization: Bearer hk_YOUR_KEY_HERE"
```

The response contains the board's metadata and the full `elements` array with every renderable Excalidraw vector object.

---

## 🔴 Step 4: Live Update

Leave the board open in a browser tab and run the `PATCH` call below to add a new step to the flow:

```bash
curl -X PATCH https://heeey.click/api/v1/boards/e67e3a1e-8e89-4089-a5f1-382a39281a92 \
  -H "Authorization: Bearer hk_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "elements": [
      {
        "id": "step-3",
        "type": "rectangle",
        "x": 650,
        "y": 150,
        "label": "Shipped to Production",
        "backgroundColor": "#b2f2bb",
        "strokeColor": "#2f9e44"
      },
      {
        "type": "arrow",
        "start": { "id": "step-2" },
        "end": { "id": "step-3" },
        "label": "yes"
      }
    ]
  }'
```

Look at the browser tab: the new block and arrow appear on screen instantly, without reloading the page! Heeey broadcasts the changes over the Supabase Realtime channel automatically.

---

## 📚 Next Steps

- Learn the detailed format for shapes, labels and arrows in the [Scene Content Schema](scene-content-schema.md).
- See every available method in the [Endpoint Reference](endpoints.md).
- Learn how to page through results in [Pagination](pagination.md).
- Check payload size limits in [Rate & Operational Limits](rate-limiting.md).
