# Version History & Restore

Heeey includes built-in point-in-time version control that protects your team's work against unwanted edits, accidental messes or data loss.

---

## 🕒 How Snapshots Work

The database records board snapshots in the `board_versions` table in two situations:

1. **Automatic snapshots (`reason: 'auto'`)**:
   - Triggered in the background by the server whenever the board is being actively edited.
   - The server keeps a minimum interval of **10 minutes** between consecutive automatic snapshots to avoid excess data during long sessions.
2. **Pre-restore snapshots (`reason: 'before_restore'`)**:
   - Before any older version is restored, the board's current state is archived in the history right away.
   - This means restoring a version is **never destructive**; you can always undo the restore and go back to the exact moment before it.

---

## 🗄️ Retention Policy

- **Capacity**: Up to the **30** most recent versions per board.
- **Time limit**: Versions older than **30 days** are cleaned up automatically by database triggers.
- When the 31st version is saved, the SQL trigger transparently removes that board's oldest version.

---

## 🔄 Conflict-Free Reconciliation Algorithm (`buildRestoredElements`)

A common problem in collaborative apps when restoring old versions is the conflict with collaborators who keep drawing: old elements with a low version number would be ignored by connected clients.

Heeey solves this with a deterministic bumping algorithm:

```typescript
export function buildRestoredElements(
  currentElements: readonly any[],
  versionElements: readonly any[],
  now: number = Date.now(),
  randomNonce: () => number = () => Math.floor(Math.random() * 2 ** 31)
): any[] {
  // 1. Every element of the historical version gets a 'version' number
  // strictly higher than the one currently on the canvas.
  // 2. Elements that exist on the current canvas but did NOT exist in the restored version
  // are marked isDeleted: true with a bumped version.
}
```

### Why It Works:
- **Immediate propagation**: The restored version wins Excalidraw's reconciliation in every connected browser right away.
- **No leftovers**: Drawings made after the historical point disappear cleanly from the canvas.
- **Real-time broadcast**: A `canvas-update` message goes out on the Supabase channel, updating every participant's screen live.

---

## 🖥️ Opening the History

1. With the board open, click the clock icon (**Version history**) in the top header.
2. The list of restore points appears with date, time, element count and a visual thumbnail.
3. Click a version to inspect it.
4. Click **"Restore this version"**. The canvas updates instantly.
