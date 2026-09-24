# Búsqueda global en el texto del lienzo

Heeey tiene una búsqueda rápida de texto completo (*full-text search*) que encuentra pizarras no solo por el título, sino por **cualquier texto o etiqueta escrita dentro del lienzo**.

---

## 🔍 Cómo funciona la búsqueda

Puedes buscar:
- En el **panel**: desde la barra de búsqueda superior o con el atajo.
- Dentro de una **pizarra**: desde el diálogo de búsqueda de pizarras (`BoardSearchModal`), para cambiar de pizarra sin volver al panel.

---

## 🧠 Características técnicas

1. **Sin distinguir acentos ni mayúsculas**:
   - Gracias a la extensión `unaccent` de PostgreSQL y a la normalización NFD, buscar `reunion`, `Reunión`, `REUNIÓN` o `reunión` devuelve exactamente los mismos resultados.
2. **Indexación automática del texto del lienzo (`tsvector` y GIN)**:
   - Cada vez que se guarda una pizarra, un disparador de la base de datos extrae todos los elementos de tipo `text` (incluidas las etiquetas de formas y flechas).
   - El título recibe el peso **A** (máxima relevancia) y el contenido de los elementos, el peso **B**.
   - Un índice GIN (`idx_boards_search`) responde en milisegundos incluso con grandes volúmenes de datos.
3. **Búsqueda local y remota**:
   - **Remota**: los usuarios con sesión iniciada buscan en el servidor mediante la función RPC `search_boards`.
   - **Local**: los invitados buscan en las pizarras guardadas en la caché del navegador mediante la función `searchLoadedBoards`.
4. **Fragmentos de vista previa con resaltado**:
   - El resultado no muestra solo el nombre de la pizarra: recorta un fragmento de contexto de hasta 40 caracteres alrededor de la primera coincidencia, conserva los acentos originales y resalta el término encontrado.
5. **Búsqueda semántica con Jev (Vercel AI Gateway)**:
   - Cuando la búsqueda por palabras devuelve menos de 3 resultados, la app llama a `POST /api/ai-search` para encontrar pizarras **relacionadas por su significado** (p. ej. `planificación T3` encuentra «Hoja de ruta julio–septiembre»). Estos resultados aparecen con la etiqueta **Relacionadas**.
   - La función lee hasta 40 pizarras recientes del usuario mediante la RPC `search_candidates` (título + 600 caracteres del lienzo, con la sesión del propio usuario) y hace **una sola** llamada al modelo `typesafe-ai/jev` en el endpoint `/v1/evaluate` del AI Gateway, con una pregunta de sí o no por pizarra. Se incluyen las pizarras con una probabilidad superior a 0,5, hasta 8 resultados.
   - Retención cero de datos: define `AI_GATEWAY_ZDR=true` para que el gateway rechace los proveedores que guardan datos. Requiere el plan Pro o Enterprise de Vercel; en Hobby, activarlo hace que todas las llamadas fallen con un 403.
   - **Credenciales**: en producción la función usa el token OIDC del proyecto en Vercel (sin clave). En local, ejecuta `vercel link` y `vercel env pull` (el token OIDC dura 12 h) o define `AI_GATEWAY_API_KEY`. Sin credenciales, la búsqueda semántica se desactiva sin avisar y la búsqueda por palabras sigue funcionando con normalidad.
   - `vite dev` no sirve las funciones de `api/`; para probar en local, usa `vercel dev`.
