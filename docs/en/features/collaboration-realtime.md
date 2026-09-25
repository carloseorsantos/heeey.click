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

Who can open a board is the sum of three layers (the highest access wins). The details are in [Teams, Projects & Sharing](teams-and-sharing.md):

1. **Team and project**: team members see the boards of projects open to the team; private projects only for people added to them (owners and admins always see them).
2. **Direct invite**: people invited by e-mail as **Viewer** or **Editor**, even from outside the team.
3. **General access (the link)**, in the `access_level` field:

| General access | Database value | Description |
|---|---|---|
| **Restricted** | `'restricted'` | Only people with access through the team, project or an invite can open the board, even with the link. Default for new boards. |
| **Anyone with the link · Viewer** | `'view'` | Anyone with the link sees changes and cursors in real time, without editing. |
| **Anyone with the link · Editor** | `'edit'` | Anyone with the link draws along, no account needed. |

Boards created without an account stay open for editing by link until they are saved to a team.

### Changing the General Access:
1. In the board header, open the **Share** dialog.
2. Under **General access**, choose **Restricted** or **Anyone with the link** (Viewer or Editor).
3. The change applies immediately; people with the board open get a `meta-update` message and read the permission again from the database.

The live room follows the same rule: people who cannot open the board cannot join the channel, and only editors change the scene.

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
