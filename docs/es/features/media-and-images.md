# Imágenes y optimización de medios

Pegar o arrastrar capturas de pantalla y fotos pesadas directamente en una pizarra interactiva puede empeorar mucho el rendimiento de dibujo y el consumo de ancho de banda de todos los colaboradores. Heeey tiene un proceso especializado y automático de tratamiento de medios en el cliente.

---

## ⚡ Proceso de optimización automática

Cada vez que se **pega** (`Ctrl+V` / `Cmd+V`) o se **arrastra** (*drag & drop*) una imagen al lienzo:

```
[Imagen original]
       │
       ▼ (Interceptada en el navegador)
[Redimensionado proporcional: máx. 1600px]
       │
       ▼ (Compresión con Canvas 2D)
[Conversión a WebP / Calidad 0.8 (Objetivo < 150 KB)]
       │
       ├───► Éxito ─────► Subida asíncrona a Supabase Storage: board-media/{boardId}/{fileId}.webp
       │
       └───► Alternativa ► Conserva un DataURL en base64 localmente si no hay conexión o el almacenamiento no está disponible
```

---

## 📊 Reglas de tamaño y compresión

1. **Límite de tamaño (`MAX_IMAGE_DIMENSION`)**:
   - Ninguna imagen se añade a la pizarra con un ancho o alto superior a **1600px**. Se mantiene estrictamente la proporción original.
2. **Compresión a WebP**:
   - Las imágenes se codifican de forma nativa en **WebP** con calidad `0.8`, lo que suele dar archivos de menos de **150 KB** (entre un 70 % y un 90 % menos que los PNG en bruto de pantallas Retina).
   - Si el navegador no puede exportar WebP desde el elemento Canvas, el proceso recurre automáticamente a **JPEG** con un fondo blanco (para que las zonas transparentes no se vuelvan negras).
3. **Colocación inteligente en el lienzo**:
   - La imagen se inserta centrada en la vista actual del usuario (`viewportCoordsToSceneCoords`).
   - Las imágenes muy anchas reciben una escala inicial de visualización por defecto (máx. 600px) para no tapar los elementos ya dibujados.

---

## 🗄️ Almacenamiento en Supabase (`board-media`)

- Las imágenes optimizadas se guardan en el bucket público `board-media` de Supabase Storage en la ruta:
  ```
  board-media/{boardId}/{fileId}.webp
  ```
- **Políticas de acceso RLS del almacenamiento**:
  - Lectura pública para cualquier visitante que tenga el enlace de la pizarra.
  - Subida permitida a cualquiera con permiso de edición en la pizarra.
  - Eliminación permitida solo a la persona propietaria de la pizarra, durante la eliminación definitiva.
- **Alternativa resistente**: si el bucket no está configurado o se cae la conexión, Heeey guarda la imagen como DataURL en base64 directamente en los metadatos de la pizarra, para que el usuario nunca pierda su trabajo.
