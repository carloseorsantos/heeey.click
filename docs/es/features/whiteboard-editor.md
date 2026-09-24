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
