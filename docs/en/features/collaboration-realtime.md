# Collaboration & Real Time (Multiplayer)

Heeey uses the **Supabase Realtime** infrastructure to deliver a low-latency, highly resilient multiplayer experience, combining **Broadcast** and **Presence** channels with periodic database sync.

---

## ⚡ How Sync Works

Real-time collaboration runs on the room channel:
```
heeey:room:{boardId}
```

No element has to go through slow queues or polling. When a collaborator moves the cursor or changes elements:

```
[Client A] --(Broadcast over WebSocket)--> [Supabase Realtime] --(Fan-out)--> [Client B, Client C, ...]
```

### 1. Element Broadcast (`canvas-update`)
- While a user draws or moves elements, the changes are sent through the `canvas-update` event.
- The payload includes the changed elements, the scene's background color metadata and a timestamp.
- **Version reconciliation**: Every element has version-control fields (`version`, `versionNonce`). The local client compares incoming elements with those on the canvas and only applies updates with a strictly higher version number, or that break ties deterministically.

### 2. Presence & Cursor Sync (`cursor-update` & Presence)
- Mouse and laser pointer positions are sent at high frequency without cluttering the drawing history.
- Each participant has:
  - A name shown on the cursor.
  - A unique avatar color and cursor halo (derived consistently from Heeey's 12-tone palette).
  - The laser pointer state when active.
  - Currently selected elements highlighted in real time.
- When a tab is closed or the connection drops, Supabase Presence removes the cursor automatically after a few seconds.

---

## 🔒 Access Levels and Permissions

Every board has an `access_level` field:

| Access level | Database value | Description |
|---|---|---|
| **Can edit** | `'edit'` | Any visitor with the link can interact, draw and add notes. |
| **View only** | `'view'` | Visitors see changes and teammates' cursors in real time, but the canvas is locked against local edits. The board owner always keeps full edit rights. |

### Changing the Access Level:
1. In the board header, open the **Share** dialog.
2. Switch between **"Can edit"** and **"View only"**.
3. The change reaches every connected visitor immediately through a `meta-update` message.

---

## 🛡️ Autosave & Local Persistence

Heeey uses a layered hybrid strategy:
1. **Immediate local cache (`localStorage`)**: Every local change is written to browser storage instantly. If the connection drops, nothing is lost.
2. **Debounced autosave to the database (`PostgreSQL`)**: Consolidated changes are sent to Supabase with a smart debounce (about 1.5 seconds of inactivity after the last stroke).
3. **Sync status indicator**:
   - 🟢 **Saved**: The cloud state matches what's on screen.
   - 🟡 **Saving…**: Pending changes are being sent to the database.
   - 🟠 **Offline**: Connection lost; changes are kept safely in the local cache.
   - 🔴 **Error**: A temporary network failure; a new attempt runs automatically.

---

## 👤 Customizing Collaborators

Guests can customize how they appear at any time:
- Click your identifying avatar in the top-right corner.
- Choose a nickname and pick your favorite color from the palette.
- Your choice is remembered in the browser and applied automatically to every board you visit next.
