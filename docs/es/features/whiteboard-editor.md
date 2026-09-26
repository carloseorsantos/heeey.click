# Pizarra y herramientas de dibujo

Heeey está construido en torno a la versión oficial del componente `@excalidraw/excalidraw` (0.18.x) y ofrece un lienzo vectorial infinito con su conocida estética orgánica y dibujada a mano (*hand-drawn*).

---

## 🎨 Herramientas y formas principales

La barra de herramientas superior permite crear y editar elementos vectoriales de forma nativa:

| Herramienta | Atajo | Descripción |
|---|---|---|
| **Selección** | `V` o `1` | Mueve, redimensiona, agrupa y gira elementos existentes. |
| **Rectángulo** | `R` o `2` | Dibuja bloques, tarjetas y paneles con esquinas rectas o redondeadas. |
| **Rombo** | `D` o `3` | Ideal para decisiones en diagramas de flujo y nodos condicionales. |
| **Elipse / círculo** | `E` o `4` | Para inicios y finales de flujos, anotaciones circulares y nodos de redes. |
| **Flecha conectada** | `A` o `5` | Se engancha magnéticamente a los bordes de las formas y se ajusta sola cuando la forma se mueve. |
| **Línea** | `L` o `6` | Segmentos rectos o polilíneas para separadores y gráficos. |
| **Dibujo libre (lápiz)** | `P` o `7` | Escritura a mano alzada que responde a la velocidad del trazo. |
| **Texto** | `T` o `8` | Texto suelto o texto vinculado a formas (*bound text container*). |
| **Imagen** | `9` | Inserta imágenes (optimizadas automáticamente a WebP). |
| **Goma** | `E` o `0` | Borra elementos al hacer clic o arrastrar sobre ellos. |
| **Puntero láser** | `K` | Un puntero láser temporal que todos los participantes de la sesión ven en tiempo real. |
| **Marco (Frame)** | `F` | Agrupa elementos de forma lógica para exportarlos juntos o presentar. |

---

## 🔤 Texto vinculado a formas (Bound Text)

El texto contenido es una de las funciones más prácticas de Heeey:
- Al hacer doble clic en cualquier forma cerrada (rectángulo, elipse, rombo), el texto que escribas se centra automáticamente dentro de ella.
- Si el elemento se mueve o se redimensiona, el texto acompaña a la forma.
- Al eliminar una forma, el texto vinculado a ella se elimina automáticamente, para que no queden elementos huérfanos en el lienzo.
- A nivel técnico, Excalidraw crea un elemento de tipo `text` con `containerId` apuntando al `id` de la forma, y la forma registra el `id` del texto en su array `boundElements`.

---

## 📐 Conexión inteligente de flechas

Las flechas de Heeey se enganchan de verdad a las formas:
- Al dibujar una flecha hacia una forma, sus puntos de anclaje se iluminan.
- Al conectarla, la flecha rellena sus propiedades `startBinding` y `endBinding` con `{ elementId, focus, gap }`.
- Si cambias de sitio la forma conectada, la flecha recalcula su curvatura y su ángulo para mantener la conexión.
- También se admiten etiquetas en las flechas, centradas en el punto medio del trazo.

---

## 🌓 Modos claro y oscuro

Heeey sigue la preferencia del sistema del usuario o el cambio manual:
- Cambia el tema con el botón del panel o desde el menú de preferencias.
- En modo oscuro, el lienzo invierte suavemente los colores de fondo y los trazos oscuros ganan contraste para verlos cómodamente de noche.
- La paleta de exportación respeta las preferencias de fondo configuradas en el lienzo.

---

## 💾 Exportación y descarga

Puedes exportar tus diagramas en cualquier momento, sin marcas de agua:
- **PNG**: imagen de mapa de bits de alta resolución, ideal para presentaciones y para compartir en Slack/Discord.
- **SVG**: gráfico vectorial escalable sin límite, ideal para insertarlo en la web o abrirlo en herramientas como Figma o Illustrator.
- El diálogo de exportación permite incluir el fondo del lienzo o generar un archivo con transparencia.

### 🤖 Exportar para IA (Markdown)

En el menú ☰ del lienzo, **Exportar para IA** genera un archivo Markdown con todo el contenido de la pizarra, para enviarlo o pegarlo en cualquier conversación con una IA (ChatGPT, Claude, Gemini, etc.):
- El diálogo muestra una vista previa del texto, con los botones **Descargar .md** y **Copiar al portapapeles**.
- El archivo incluye el título de la pizarra, los textos, las formas con etiqueta (rombos y elipses identificados), los marcos como secciones, las conexiones en formato `A → B` (con la etiqueta de la flecha) y los enlaces. Las imágenes aparecen como `[imagen]`.
- El texto dibujado sobre una forma cuenta como su etiqueta, y las flechas con la punta tocando una forma cuentan como conexión, aunque no estén vinculadas.
- Los elementos siguen el orden de lectura (de arriba abajo, de izquierda a derecha). Se omiten coordenadas, colores e IDs.
- Usa el estado actual del lienzo, también está disponible en modo lectura y funciona solo en el navegador.
- Para que la IA lea y edite las pizarras directamente, sin exportar nada, conecta el [servidor MCP](../mcp/getting-started.md).

---

## 💡 Consejos en la pizarra

Pequeños globos junto al botón ☰ presentan funciones que quizá todavía no conoces. El primer consejo anuncia **Exportar para IA**; pueden llegar otros después, con el mismo funcionamiento:
- Aparece 10 segundos después de abrir la pizarra (aunque estés usando el lienzo), solo en pizarras con contenido, y nunca junto con otros avisos (bienvenida de invitado, papelera, aviso de enlace), diálogos abiertos o el menú ☰ abierto. También aparece en modo lectura.
- Aparece como máximo una vez al día (en tu zona horaria) y deja de aparecer para siempre cuando usas la función (con el botón **Probar** del globo o desde el elemento del menú), cierras el consejo con la X (o con Esc, con el foco en el globo), o ya lo has visto en 3 días distintos.
- No roba el foco, respeta la preferencia de movimiento reducido y se anuncia a los lectores de pantalla. Un Esc pensado para otra cosa (salir de la edición de un texto, quitar una selección) solo aparta el globo, sin contar como cerrado.

**Dónde se guarda el estado:**
- **Con cuenta**: en la tabla `user_hints` de Supabase, con una fila por persona y consejo (en cuántos días apareció, cuándo apareció por primera y por última vez, cuándo se cerró o se usó). Cada persona solo lee sus propias filas, las escrituras pasan por las funciones `record_hint_event` e `import_guest_hint` (en los eventos nuevos, el servidor guarda las horas y cuenta los días), cada cuenta tiene como máximo 50 consejos y las filas se borran junto con la cuenta. Una copia queda en el `localStorage` (`heeey_hints_<id de la cuenta>`) para cuando el servidor no responde.
- **Invitado**: solo en el `localStorage` del navegador (`heeey_hints`), sin enviar nada al servidor. Al iniciar sesión, el estado se lleva a la cuenta: si la cuenta aún no tiene registro del consejo, se importa; si ya lo tiene, solo se añaden «cerrado» y «usado». La copia del invitado sigue en el navegador después de iniciar sesión, para que el consejo no vuelva al cerrar sesión.
- **Métricas**: los eventos `hint_shown`, `hint_dismissed` y `hint_used` van a PostHog (cuando está activo en el despliegue) solo con el nombre del consejo y el origen (sin IDs de pizarras ni contenido), vinculados al mismo identificador aleatorio que los demás eventos, nunca al correo.
