# Folders, Organization & Trash

The Heeey dashboard gives you everything you need to structure, sort and protect your boards.

---

## 📁 Nested Folders

To keep projects, teams or subjects organized, you can build folder trees of any depth:

- **Creating folders**: On the dashboard, click **"New folder"**, type a name and choose whether it goes at the top level or inside an existing folder.
- **Breadcrumb navigation**: The full visual path (e.g. `Home > Design System > Web Components`) lets you jump to any level in between with one click.
- **Moving boards**:
  - From the three-dot menu on any board card, choose **"Move to folder"**.
  - The full tree is shown, so you can move the board into any folder or back to the top level.
- **Deleting folders**:
  - Deleting a folder that contains subfolders removes all of those subfolders recursively.
  - **Your content stays safe**: Boards inside the deleted folder **are not deleted**; they go back to the top level of your dashboard (`folder_id = null`).

---

## 🗑️ Trash (Soft Delete) & Protection Against Accidental Deletion

Heeey deletes in two steps:

### 1. Moving to the Trash
- Moving a board to the trash sets `deleted_at = now()`.
- The board disappears immediately from active lists, folders and default searches.
- If someone has the board open when it's trashed, it switches to read-only mode automatically with an information banner at the top.

### 2. Restoring
- At any time, open the **"Trash"** tab on the dashboard.
- Click the restore button on the card to put the board back in its original folder.
- An *Undo* toast also appears right after any accidental deletion.

### 3. Permanent Deletion
- Only the signed-in owner can permanently delete a board from the trash.
- Permanent deletion removes:
  - The board's row in the `boards` table.
  - Every associated image in the `board-media` bucket in Supabase Storage.
  - Every historical version in `board_versions`.
- Boards left in the trash for more than **30 days** are deleted permanently and automatically, once a day (Vercel Cron at `/api/cron/purge`, which calls `public.purge_expired_data()`).

---

## 🖼️ Smart Thumbnails

So the dashboard loads instantly even with dozens of complex boards:
- While you draw, a rasterized **WebP** thumbnail (`maxWidthOrHeight = 480px`, quality 0.7) is rendered in the background on the client every 20 seconds of activity.
- The base64-encoded string is saved in the `thumbnail` column of the `boards` table.
- The dashboard only downloads metadata and the compact thumbnails (`fetchBoardSummaries`), without downloading the raw elements of dozens of full scenes.
- In the dashboard's dark mode, a CSS filter gracefully inverts light thumbnails with no extra graphics processing.

---

## 📑 Starter Templates

When creating a new board, you can start from ready-made templates:

1. **Brainstorming**:
   - Themed boards with colorful sticky notes grouped by ideas, challenges and next steps.
2. **Flowchart**:
   - Pre-connected process nodes with start and end blocks and a decision diamond.
3. **Wireframe**:
   - Structural interface elements: a navigation bar, content boxes and interactive buttons.
