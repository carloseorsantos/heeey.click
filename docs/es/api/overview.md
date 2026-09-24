# Visión general de la API REST v1

La API pública de **Heeey** (`/api/v1`) te permite crear, leer, actualizar, mover y buscar pizarras y carpetas de forma programática.

La API está pensada para ser ligera y cómoda para desarrolladores y agentes autónomos, y se ejecuta directamente en el edge (*Edge Runtime* en Vercel).

---

## 🌐 Datos de integración

- **URL base de producción**: `https://heeey.click/api/v1`
- **Entorno local**: `http://localhost:5173/api/v1`
- **Formato de datos**: JSON UTF-8
- **Autenticación**: token Bearer en la cabecera HTTP `Authorization`
- **CORS**: habilitado para todos los orígenes (`*`), lo que permite peticiones directas desde herramientas del navegador, webhooks y CLIs.

---

## ⚡ Principios de diseño de la API

1. **Seguridad en la base de datos (cero secretos en el edge)**:
   - La función edge (`apiHandler.ts`) no guarda claves maestras ni secretos de superusuario.
   - Cada petición se autentica directamente en PostgreSQL mediante un hash criptográfico SHA-256 (`api_authenticate`). El contexto del usuario (`auth.uid()`) se aplica a nivel de transacción, de modo que las políticas de Row Level Security (RLS) protegen cada operación.
2. **Actualización en tiempo real (live broadcast)**:
   - Cada vez que cambias o añades elementos a una pizarra con `POST` o `PATCH`, el servidor envía un mensaje de broadcast de Supabase Realtime por el canal `heeey:room:{boardId}`.
   - ¡Quien tenga la pizarra abierta en el navegador verá aparecer los nuevos elementos en directo sin recargar la página!
3. **Enlaces listos para usar (`url`)**:
   - Todas las respuestas de pizarras incluyen la propiedad `url` ya formateada (p. ej. `https://heeey.click/b/550e8400-e29b-41d4-a716-446655440000`), para que scripts y bots puedan entregar el enlace directo al usuario final.
4. **Formato abreviado de elementos (Element Skeleton)**:
   - No necesitas construir objetos enormes con decenas de propiedades internas de Excalidraw. La API acepta especificaciones sencillas (`label`, `shape`, `start`, `end`) y genera automáticamente los elementos completos.

---

## 🧭 Resumen de recursos de la API

| Recurso | Método | Ruta | Descripción |
|---|---|---|---|
| **Índice de la API** | `GET` | `/api/v1` | Devuelve el catálogo de rutas y formatos aceptados. |
| **Pizarras** | `GET` | `/api/v1/boards` | Lista las pizarras del usuario (con paginación y filtro por carpeta). |
| **Crear pizarra** | `POST` | `/api/v1/boards` | Crea una pizarra nueva, con o sin elementos iniciales. |
| **Obtener pizarra** | `GET` | `/api/v1/boards/:id` | Devuelve los metadatos y todos los elementos de la escena. |
| **Actualizar pizarra** | `PATCH` | `/api/v1/boards/:id` | Actualiza el título, añade o modifica elementos o los elimina por ID. |
| **Papelera** | `DELETE` | `/api/v1/boards/:id` | Mueve la pizarra a la papelera (*soft delete*). |
| **Mover pizarra** | `POST` | `/api/v1/boards/:id/move` | Coloca la pizarra en una carpeta (o en el nivel superior con `null`). |
| **Búsqueda global** | `GET` | `/api/v1/search?q=` | Búsqueda de texto completo en títulos y en el texto dibujado en las pizarras. |
| **Listar carpetas** | `GET` | `/api/v1/folders` | Lista todas las carpetas del usuario. |
| **Crear carpeta** | `POST` | `/api/v1/folders` | Crea una carpeta en el nivel superior o dentro de otra carpeta. |
