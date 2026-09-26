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
