# Documentación de Heeey (heeey.click)

> Pizarra interactiva y colaborativa en tiempo real, con persistencia en la nube, API REST pública y servidor MCP para agentes de IA.

Te damos la bienvenida a la documentación oficial de **Heeey**. Inspirada en la arquitectura y la documentación del ecosistema Excalidraw (`https://plus.excalidraw.com/docs`), describe todas las funciones, herramientas de dibujo, la colaboración multijugador, la API REST v1, el servidor MCP (*Model Context Protocol*) y el modelo de datos de Heeey.

---

## 🧭 Navegación rápida

### 🎨 [Funciones y pizarra](features/whiteboard-editor.md)
Descubre el lienzo vectorial basado en `@excalidraw/excalidraw` 0.18, los temas claro y oscuro, las herramientas de dibujo, formas, texto vinculado, flechas inteligentes y atajos.

### 👥 [Colaboración y tiempo real](features/collaboration-realtime.md)
Entiende cómo funciona el multijugador con Supabase Realtime (Broadcast y Presence), los cursores en directo, los nombres y colores de los colaboradores, el modo lectura frente a edición y los enlaces para compartir.

### 📁 [Organización y panel](features/folders-and-organization.md)
Aprende a gestionar pizarras, carpetas anidadas, la búsqueda global con texto resaltado, las plantillas (Lluvia de ideas, Diagrama de flujo, Wireframe) y la papelera que protege contra borrados accidentales.

### 🕒 [Historial de versiones](features/version-history.md)
Descubre cómo las instantáneas automáticas cada 10 minutos, la retención de 30 días y las instantáneas previas a cada restauración permiten recuperar estados anteriores sin perder nada.

### 🌍 [Internacionalización (i18n)](features/i18n.md)
Soporte nativo para portugués (`pt-BR`), inglés (`en-US`) y español (`es-ES`) en la app, en las páginas del sitio y en esta documentación, con detección del idioma del navegador, plurales ICU y sincronización del idioma de Excalidraw.

### 🧩 [Bibliotecas personales](features/libraries.md)
Persistencia en la nube de bibliotecas de componentes reutilizables para usuarios con sesión iniciada, caché local para invitados y migración automática en el primer inicio de sesión.

### 🖼️ [Medios y optimización de imágenes](features/media-and-images.md)
Proceso automático de compresión WebP/JPEG en el cliente (máx. 1600 px, ~150 KB), subida asíncrona a Supabase Storage (`board-media`) y una alternativa elegante sin conexión.

### 🔍 [Búsqueda global en el lienzo](features/search.md)
Búsqueda de texto completo en PostgreSQL con `unaccent` e índices GIN, en los títulos y en todos los textos dibujados en las pizarras, con fragmentos resaltados.

### 🔌 [API REST v1](api/overview.md)
Automatiza la creación, lectura y edición de pizarras y carpetas. Autenticación con clave personal (`hk_...`), formato abreviado de elementos, paginación y difusión en tiempo real.

### 🤖 [Servidor MCP para IA](mcp/overview.md)
Conecta Claude Code, Claude Desktop, Cursor y otros agentes de IA mediante Streamable HTTP (`/api/mcp`). Crea diagramas con disposición automática por capas (Dagre / Sugiyama) y organiza pizarras de forma programática.

---

## ⚡ ¿Qué es Heeey?

Heeey es una aplicación web moderna de colaboración visual pensada para ser rápida, sencilla y abierta:

- **Núcleo de pizarra**: usa el motor oficial `@excalidraw/excalidraw` 0.18.x, con su estética dibujada a mano, exportación SVG/PNG con total fidelidad y soporte completo de bibliotecas de elementos.
- **Multijugador ultrarrápido**: Realtime Broadcast y Presence sobre el canal `heeey:room:{boardId}`, con una latencia mínima en los cambios del lienzo y los cursores en directo.
- **Acceso sin complicaciones**: acceso híbrido — los invitados pueden crear pizarras al instante; los usuarios registrados inician sesión sin contraseña mediante un Magic Link (Email OTP) y heredan automáticamente sus pizarras de invitado.
- **Programable y pensado para agentes**: toda la plataforma admite de primera mano la automatización mediante la API REST y el protocolo MCP, de modo que los agentes LLM pueden leer, entender, generar y organizar diagramas complejos en segundos.
- **Totalmente internacionalizado**: soporte nativo y verificado con pruebas para portugués (`pt-BR`), inglés (`en-US`) y español (`es-ES`).

---

## 📖 Índice completo de documentos

1. **Visión general y primeros pasos**:
   - [Guía rápida general (Primeros pasos)](getting-started.md)
2. **Funciones de la pizarra y de la aplicación**:
   - [Lienzo y herramientas de dibujo](features/whiteboard-editor.md)
   - [Colaboración y tiempo real](features/collaboration-realtime.md)
   - [Carpetas, organización y papelera](features/folders-and-organization.md)
   - [Historial de versiones y restauración](features/version-history.md)
   - [Internacionalización (i18n)](features/i18n.md)
   - [Bibliotecas de componentes](features/libraries.md)
   - [Imágenes y optimización de medios](features/media-and-images.md)
   - [Búsqueda global en el texto del lienzo](features/search.md)
3. **API REST pública (`/api/v1`)**:
   - [Visión general de la API](api/overview.md)
   - [Primeros pasos con la API (Inicio rápido)](api/getting-started.md)
   - [Autenticación y alcances de las claves](api/authentication.md)
   - [Paginación de resultados](api/pagination.md)
   - [Tasas y límites operativos](api/rate-limiting.md)
   - [Gestión de errores](api/error-handling.md)
   - [Esquema del contenido de la escena (Element Spec)](api/scene-content-schema.md)
   - [Referencia completa de endpoints](api/endpoints.md)
4. **Servidor MCP (Model Context Protocol)**:
   - [Visión general de MCP](mcp/overview.md)
   - [Configurar agentes (Claude Code, Desktop, Cursor)](mcp/getting-started.md)
   - [Autenticación y permisos MCP](mcp/auth-and-permissions.md)
   - [Catálogo completo de las 13 herramientas MCP](mcp/tools.md)
   - [Motor de disposición automática de diagramas](mcp/diagram-layout.md)
5. **Descubrimiento por agentes y modelos de lenguaje**:
   - [Índice resumido para LLMs (`llms.txt`)](llms.txt)
   - [Volcado de texto completo para LLMs (`llms-full.txt`)](llms-full.txt)
