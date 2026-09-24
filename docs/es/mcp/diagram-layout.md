# Motor de disposición automática de diagramas

Dibujar diagramas bonitos con modelos de lenguaje suele ser complicado: los LLMs no tienen una percepción espacial nativa de los píxeles, lo que a menudo produce cajas superpuestas, flechas que cruzan las formas y textos cortados.

Heeey lo resuelve con un motor de disposición determinista integrado en el servidor (`diagramLayout.ts`), basado en el algoritmo por capas de Sugiyama mediante **Dagre**.

---

## 🏗️ Cómo funciona el algoritmo

Cuando el agente llama a la herramienta `create_diagram` o `layout_board`:

```
[Nodos y conexiones sencillos]
         │
         ▼
1. Medición del texto y ajuste automático:
   - Mide las dimensiones reales del texto según la fuente Excalifont.
   - Aplica ajuste automático de palabras (word wrap) con un ancho ideal.
   - Amplía rectángulos, elipses y rombos para que el texto quepa con margen interior (padding).
         │
         ▼
2. Algoritmo por capas (Sugiyama mediante Dagre):
   - Asigna los nodos a capas consecutivas según la dirección del flujo (TB, LR, BT, RL).
   - Minimiza los cruces de flechas (crossing reduction).
   - Reparte espacios uniformes (nodeSpacing: 50px, rankSpacing: 70px).
         │
         ▼
3. Trazado inteligente de flechas y polilíneas:
   - Las conexiones se doblan suavemente alrededor de las formas para evitar colisiones.
   - Recorta los extremos (`trimEnds`) para que las puntas de flecha no toquen el borde de las cajas.
   - Vincula magnéticamente el inicio y el final a los nodos correspondientes.
         │
         ▼
[Escena de Excalidraw lista y difundida en directo]
```

---

## 🧭 Direcciones de flujo admitidas (`direction`)

El parámetro `direction` define la orientación general del diagrama:

| Dirección | Nombre | Uso habitual |
|---|---|---|
| `'TB'` (por defecto) | *Top to Bottom* (de arriba abajo) | Diagramas de flujo verticales, organigramas, árboles de decisión. |
| `'LR'` | *Left to Right* (de izquierda a derecha) | Pipelines de CI/CD, flujos de datos, recorridos de usuario. |
| `'BT'` | *Bottom to Top* (de abajo arriba) | Modelados de capas inferiores a superiores. |
| `'RL'` | *Right to Left* (de derecha a izquierda) | Diagramas en sentido inverso o flujos de retorno. |

---

## 🎨 Paleta de colores de los nodos

El motor tiene una paleta de 6 tonos pastel tomados de la estética nativa de Excalidraw:

| Color (`color`) | Color del trazo (`strokeColor`) | Color de fondo (`backgroundColor`) | Significado sugerido |
|---|---|---|---|
| `'blue'` | `#1971c2` | `#a5d8ff` | Servicios, bases de datos, nodos neutros |
| `'green'` | `#2f9e44` | `#b2f2bb` | Éxito, nodos finales, aprobación |
| `'yellow'` | `#f08c00` | `#ffec99` | Decisiones, avisos, colas, procesamiento |
| `'red'` | `#e03131` | `#ffc9c9` | Errores, fallos, zonas críticas |
| `'violet'` | `#6741d9` | `#d0bfff` | Usuarios, clientes externos, gateways |
| `'gray'` | `#495057` | `#e9ecef` | Componentes secundarios, infraestructura |

---

## 📍 Colocación junto al contenido existente (`originBeside`)

Si le pides al agente que añada un diagrama a una pizarra que **ya tiene dibujos** (pasando el parámetro `board_id`):

- El motor calcula la caja delimitadora (*bounding box*) de todos los elementos visibles de la pizarra.
- Coloca el nuevo diagrama automáticamente **a la derecha del contenido existente**, con un margen de seguridad de `160px`.
- ¡Así ningún dibujo existente queda sobrescrito ni tapado!
