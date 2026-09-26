# Whiteboard & Drawing Tools

Heeey is built around the official `@excalidraw/excalidraw` component (0.18.x), offering an infinite vector canvas with its well-known organic, hand-drawn look.

---

## 🎨 Main Tools and Shapes

The top toolbar provides native support for creating and editing vector elements:

| Tool | Shortcut | Description |
|---|---|---|
| **Selection** | `V` or `1` | Move, resize, group and rotate existing elements. |
| **Rectangle** | `R` or `2` | Draw blocks, cards and panels with sharp or rounded corners. |
| **Diamond** | `D` or `3` | Ideal for flowchart decisions and conditional nodes. |
| **Ellipse / Circle** | `E` or `4` | Used for flow start/end points, circular annotations and network nodes. |
| **Bound Arrow** | `A` or `5` | Snaps magnetically to shape edges and adjusts dynamically when the shape moves. |
| **Line** | `L` or `6` | Straight segments or polylines for dividers and charts. |
| **Freedraw (Pen)** | `P` or `7` | Freehand writing that responds to stroke speed. |
| **Text** | `T` or `8` | Standalone text or text bound to shapes (*bound text container*). |
| **Image** | `9` | Insert images (automatically optimized to WebP). |
| **Eraser** | `E` or `0` | Erase elements by clicking or dragging over them. |
| **Laser Pointer** | `K` | A temporary laser pointer that every participant in the session sees in real time. |
| **Frame** | `F` | Groups elements logically for batch export or presenting. |

---

## 🔤 Text Bound to Shapes (Bound Text)

Contained text is one of the handiest features in Heeey:
- Double-click any closed shape (rectangle, ellipse, diamond) and the text you type is automatically centered inside it.
- If the element is moved or resized, the text follows the shape.
- When you delete a shape, the text bound to it is removed automatically, so no orphan elements are left on the canvas.
- Technically, Excalidraw creates a `text` element whose `containerId` points to the shape's `id`, and the shape records the text's `id` in its `boundElements` array.

---

## 📐 Smart Arrow Binding

Arrows in Heeey truly snap to shapes:
- When you draw an arrow toward a shape, its anchor points light up.
- Once connected, the arrow fills its `startBinding` and `endBinding` properties with `{ elementId, focus, gap }`.
- If you move the connected shape, the arrow recalculates its curve and angle to keep the connection intact.
- Arrow labels are supported too, centered on the midpoint of the stroke.

---

## 🌓 Light and Dark Modes

Heeey follows the user's system preference or a manual toggle:
- Change the theme with the toggle on the dashboard or in the preferences menu.
- In dark mode, the canvas smoothly inverts background colors and dark strokes gain contrast for comfortable viewing at night.
- The export palette respects the background preferences set on the canvas.

---

## 💾 Export and Download

You can export your diagrams at any time, with no watermarks:
- **PNG**: A high-resolution bitmap, ideal for presentations and sharing on Slack/Discord.
- **SVG**: An infinitely scalable vector graphic, ideal for embedding on the web or opening in tools like Figma or Illustrator.
- The export dialog lets you include the canvas background or produce a file with transparency.

### 🤖 Export for AI (Markdown)

In the canvas ☰ menu, **Export for AI** creates a Markdown file with all the content of the board, to send or paste into any chat with an AI (ChatGPT, Claude, Gemini, etc.):
- The dialog shows a preview of the text, with **Download .md** and **Copy to clipboard** buttons.
- The file has the board title, texts, labeled shapes (diamonds and ellipses are named), frames as sections, connections as `A → B` (with the arrow label) and links. Images show up as `[image]`.
- Text drawn over a shape counts as its label, and arrows whose end touches a shape count as a connection, even when not bound.
- Items follow reading order (top to bottom, left to right). Coordinates, colors and IDs are left out.
- It uses the current state of the canvas, is also available in view mode and runs only in the browser.
- To let the AI read and edit boards directly, with nothing to export, connect the [MCP server](../mcp/getting-started.md).

---

## 💡 Board hints

Small bubbles next to the ☰ button introduce features you may not know yet. The first hint announces **Export for AI**; more may come later, working the same way:
- It shows up after 10 seconds without interacting with the canvas, only on boards with content, and never together with other notices (guest welcome, trash, link notice), open dialogs or the open ☰ menu. It also shows in view mode.
- It shows at most once a day (in your local time) and stops for good when you use the feature (from the bubble's **Try it** button or from the menu item), close the hint with X or Esc, or have seen it on 3 different days.
- It doesn't steal focus, closes with Esc, respects the reduced motion preference and is announced to screen readers as a status.

**Where the state lives:**
- **Signed in**: in the Supabase `user_hints` table, with one row per person and hint (on how many days it was shown, when it was first and last shown, when it was closed or used). Each person only reads their own rows, writes go through the `record_hint_event` and `import_guest_hint` functions (for new events, the server records the times and counts the days), each account has at most 50 hints and the rows are deleted along with the account. A copy stays in `localStorage` (`heeey_hints_<account id>`) for when the server doesn't respond.
- **Guest**: only in the browser's `localStorage` (`heeey_hints`), with nothing sent to the server. When you sign in, the state comes along: if the account has no record of the hint yet, it is imported; if it does, only "closed" and "used" are added. The guest copy stays in the browser after signing in, so the hint doesn't come back when you sign out.
- **Metrics**: the `hint_shown`, `hint_dismissed` and `hint_used` events go to PostHog (when enabled for the deploy) with only the hint name and the source (no board IDs or content), tied to the same random identifier as other events, never to your email.
