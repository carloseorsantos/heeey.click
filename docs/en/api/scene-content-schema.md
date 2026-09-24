# Scene Content Schema (Element Spec)

Heeey is designed so that neither you nor AI models have to build verbose objects with the dozens of internal properties of Excalidraw's native format. The API and the MCP tools accept a lean spec (**Element Spec**) and automatically fill in positions, fonts, bounding boxes and magnetic bindings.

Full native Excalidraw elements are still 100% supported and pass straight through the converter.

---

## 🧩 The Short Format (Element Spec)

Any element in the `elements` array can be described with these essential fields:

```typescript
interface ElementSpec {
  /** Stable element identifier (optional; generated automatically when omitted) */
  id?: string;
  /** Shape or stroke type */
  type: 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'arrow' | 'line' | 'frame';
  /** Canvas coordinates in pixels */
  x?: number;
  y?: number;
  /** Dimensions (optional; computed from the label when omitted) */
  width?: number;
  height?: number;
  /** Label shown inside the shape or on the arrow */
  label?: string | { text: string; fontSize?: number };
  /** Direct text content (required for type: "text") */
  text?: string;
  fontSize?: number;
  /** Colors in CSS format (#hex, rgb, etc.) */
  strokeColor?: string;
  backgroundColor?: string;
  /** Connected arrow ends (pointing to the id of the source/target shape) */
  start?: { id: string };
  end?: { id: string };
  /** Relative points for manual arrows and lines: [[0, 0], [200, 50]] */
  points?: [number, number][];
}
```

---

## 🎨 Practical Examples by Element Type

### 1. Shapes with Centered Inner Text (`rectangle`, `ellipse`, `diamond`)
Just pass the `label` property. The server creates the shape and a bound text element (`boundElements` and `containerId`) perfectly centered:

```json
{
  "id": "node-auth",
  "type": "rectangle",
  "x": 100,
  "y": 150,
  "label": "Authentication Service",
  "backgroundColor": "#a5d8ff",
  "strokeColor": "#1971c2"
}
```

For a conditional decision in a flowchart:
```json
{
  "id": "node-check",
  "type": "diamond",
  "x": 380,
  "y": 130,
  "label": "Valid Token?",
  "backgroundColor": "#ffec99"
}
```

### 2. Connected, Magnetic Arrows (`arrow`)
To link two shapes, use the `start` and `end` properties with the matching IDs. Heeey works out the shapes' centers, points the arrow and applies the right edge spacing (`gap: 8px`):

```json
{
  "id": "arrow-auth-check",
  "type": "arrow",
  "start": { "id": "node-auth" },
  "end": { "id": "node-check" },
  "label": "validates token"
}
```

> **Tip**: Arrows can connect to shapes sent in the same request or to shapes that **were already on the board**!

### 3. Standalone Text (`text`)
For headings, titles or free-form notes:

```json
{
  "type": "text",
  "x": 100,
  "y": 50,
  "text": "System Architecture v2",
  "fontSize": 24,
  "strokeColor": "#1e1e1e"
}
```

### 4. Frames / Grouping Panels (`frame`)
To mark out functional areas or sections of a diagram:

```json
{
  "id": "frame-backend",
  "type": "frame",
  "x": 50,
  "y": 80,
  "width": 600,
  "height": 400,
  "label": "Secure Zone / VPC"
}
```

---

## 🧠 Defaults Applied Automatically

When cosmetic fields are left out of the spec, Heeey applies consistent defaults:

- **Font**: Family 5 (`Excalifont`, Excalidraw's default hand-drawn font).
- **Default shape sizes**:
  - `rectangle`: 180 × 80 px (grows with the text).
  - `ellipse`: 140 × 100 px.
  - `diamond`: 180 × 110 px.
- **Default colors**:
  - `strokeColor`: `#1e1e1e`
  - `backgroundColor`: `transparent`
  - `fillStyle`: `solid`
  - `roughness`: `1` (the signature hand-drawn style)
  - `opacity`: `100`

---

## 🔄 Compact View (`describeElements`)

When reading with formats optimized for language models (as the MCP tools do), Heeey runs the reverse process:
- Labels bound to shapes are folded back into the host shape's `label` property.
- Arrows show `start: { id }` and `end: { id }`.
- Floating-point coordinates are rounded to integers.
- This compaction saves up to 80% of the tokens used in the LLM's context window.
