# Automatic Diagram Layout Engine

Drawing good-looking diagrams with language models is usually hard: LLMs have no native spatial sense of pixels, which often leads to overlapping boxes, arrows crossing shapes and clipped text.

Heeey solves this with a deterministic layout engine built into the server (`diagramLayout.ts`), based on Sugiyama's layered algorithm via **Dagre**.

---

## 🏗️ How the Algorithm Works

When the agent calls the `create_diagram` or `layout_board` tool:

```
[Simple Nodes & Edges]
         │
         ▼
1. Text Measurement & Auto-Wrap:
   - Measures the text's real dimensions based on the Excalifont font.
   - Wraps words automatically at an ideal width.
   - Grows rectangles, ellipses and diamonds to fit the text with inner padding.
         │
         ▼
2. Layered Algorithm (Sugiyama via Dagre):
   - Assigns nodes to sequential layers following the flow direction (TB, LR, BT, RL).
   - Minimizes arrow crossings (crossing reduction).
   - Spreads out even spacing (nodeSpacing: 50px, rankSpacing: 70px).
         │
         ▼
3. Smart Arrow Routing & Polylines:
   - Edges bend smoothly around shapes to avoid collisions.
   - Trims the ends (`trimEnds`) so arrowheads don't touch the edges of the boxes.
   - Binds the start and end magnetically to the matching nodes.
         │
         ▼
[Excalidraw Scene Ready & Broadcast Live]
```

---

## 🧭 Supported Flow Directions (`direction`)

The `direction` parameter sets the diagram's overall orientation:

| Direction | Name | Typical use |
|---|---|---|
| `'TB'` (default) | *Top to Bottom* | Vertical flowcharts, org charts, decision trees. |
| `'LR'` | *Left to Right* | CI/CD pipelines, data pipelines, user journeys. |
| `'BT'` | *Bottom to Top* | Modeling from lower to upper layers. |
| `'RL'` | *Right to Left* | Reverse-direction diagrams or return flows. |

---

## 🎨 Node Color Palette

The engine has a palette of 6 pastel tones taken from Excalidraw's native look:

| Color (`color`) | Stroke color (`strokeColor`) | Background color (`backgroundColor`) | Suggested meaning |
|---|---|---|---|
| `'blue'` | `#1971c2` | `#a5d8ff` | Services, databases, neutral nodes |
| `'green'` | `#2f9e44` | `#b2f2bb` | Success, end nodes, approval |
| `'yellow'` | `#f08c00` | `#ffec99` | Decisions, warnings, queues, processing |
| `'red'` | `#e03131` | `#ffc9c9` | Errors, failures, critical zones |
| `'violet'` | `#6741d9` | `#d0bfff` | Users, external clients, gateways |
| `'gray'` | `#495057` | `#e9ecef` | Secondary components, infrastructure |

---

## 📍 Placing Next to Existing Content (`originBeside`)

If you ask the agent to add a diagram to a board that **already has drawings** (by passing the `board_id` parameter):

- The engine computes the bounding box of every live element currently on the board.
- It places the new diagram automatically **to the right of the existing content**, with a safety margin of `160px`.
- That way, no existing drawing is overwritten or covered!
