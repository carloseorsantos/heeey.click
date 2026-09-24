# Component Libraries

Heeey integrates deeply with Excalidraw's library ecosystem, letting you save icons, architecture diagrams, wireframes and reusable graphic blocks to speed up your work.

---

## 📦 What Are Libraries?

In Excalidraw, a library is a collection of items made of one or more prebuilt graphic elements (for example AWS service icons, UML symbols, UI buttons or illustrations).

In Heeey you can:
- Save any selection of canvas elements straight to your personal library.
- Browse Excalidraw's official public library and install ready-made packs in one click.
- Drag items from your library straight onto any board.

---

## ☁️ Cloud Persistence vs. Local Cache

Heeey implements a custom adapter (`createLibraryAdapter` via `useHandleLibrary`):

| User context | Where items are stored | Behavior |
|---|---|---|
| **Signed-in user** | `user_libraries` table in Supabase + local cache | Automatic cloud sync. Your personal library follows you to any browser or computer. If you're temporarily offline, the local cache keeps reads and writes working without errors. |
| **Guest / not signed in** | `localStorage` (`heeey_library`) | Kept safely in the current browser on the device. |

---

## 🔄 Automatic Migration on First Sign-In

If you used Heeey as a guest and built a custom element library, you don't need to export it by hand:

- When you sign in to your account for the first time (via Magic Link), the migration adapter (`createGuestLibraryMigration`) runs.
- It automatically reads the items from `localStorage` and sends them to your account in the `user_libraries` table.
- The temporary guest cache is cleared safely and your items are now available in the cloud.
