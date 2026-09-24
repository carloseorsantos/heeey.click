# Images & Media Optimization

Pasting or dragging heavy screenshots and photos straight onto an interactive whiteboard can drastically hurt rendering performance and bandwidth for every collaborator. Heeey has a specialized, automated client-side media processing pipeline.

---

## ⚡ Automatic Optimization Pipeline

Whenever an image is **pasted** (`Ctrl+V` / `Cmd+V`) or **dragged** (*drag & drop*) onto the canvas:

```
[Original Image]
       │
       ▼ (Intercepted in the browser)
[Proportional Resize: max 1600px]
       │
       ▼ (Canvas 2D compression)
[Conversion to WebP / Quality 0.8 (Target < 150 KB)]
       │
       ├───► Success ────► Async upload to Supabase Storage: board-media/{boardId}/{fileId}.webp
       │
       └───► Fallback ───► Keeps a base64 DataURL locally when offline or when storage is unavailable
```

---

## 📊 Sizing and Compression Rules

1. **Size limit (`MAX_IMAGE_DIMENSION`)**:
   - No image is added to the board with a width or height above **1600px**. The original aspect ratio is strictly preserved.
2. **WebP compression**:
   - Images are encoded natively as **WebP** at quality `0.8`, usually producing files under **150 KB** (70% to 90% smaller than raw PNGs from Retina screens).
   - If the browser can't export WebP from the Canvas element, the pipeline falls back to **JPEG** with a white background fill (so transparent areas don't turn black).
3. **Smart placement on the canvas**:
   - The image is centered in the user's current viewport (`viewportCoordsToSceneCoords`).
   - Very wide images get a default initial display scale (max 600px) so they don't cover elements already on the canvas.

---

## 🗄️ Storage in Supabase (`board-media`)

- Optimized images are stored in the public `board-media` bucket in Supabase Storage at:
  ```
  board-media/{boardId}/{fileId}.webp
  ```
- **Storage RLS access policies**:
  - Public read for any visitor who has the board link.
  - Upload allowed for anyone with edit permission on the board.
  - Deletion allowed only for the board owner, during permanent deletion.
- **Resilient fallback**: If the bucket isn't configured or the connection drops, Heeey stores the image as a base64 DataURL directly in the board's metadata, so the user never loses their work.
