# Esquema del contenido de la escena (Element Spec)

Heeey está pensado para que ni tú ni los modelos de IA tengáis que construir objetos extensos con las decenas de propiedades internas del formato nativo de Excalidraw. La API y las herramientas MCP aceptan una especificación sencilla (**Element Spec**) y completan automáticamente posiciones, fuentes, cajas delimitadoras y conexiones magnéticas.

Los elementos nativos completos de Excalidraw siguen siendo 100 % compatibles y pasan directamente por el conversor.

---

## 🧩 El formato abreviado (Element Spec)

Cualquier elemento del array `elements` puede describirse con estos campos esenciales:

```typescript
interface ElementSpec {
  /** Identificador estable del elemento (opcional; se genera automáticamente si se omite) */
  id?: string;
  /** Tipo de forma o de trazo */
  type: 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'arrow' | 'line' | 'frame';
  /** Coordenadas en el lienzo, en píxeles */
  x?: number;
  y?: number;
  /** Dimensiones (opcionales; se calculan a partir de la etiqueta si se omiten) */
  width?: number;
  height?: number;
  /** Etiqueta que se muestra dentro de la forma o sobre la flecha */
  label?: string | { text: string; fontSize?: number };
  /** Contenido de texto directo (obligatorio para type: "text") */
  text?: string;
  fontSize?: number;
  /** Colores en formato CSS (#hex, rgb, etc.) */
  strokeColor?: string;
  backgroundColor?: string;
  /** Extremos conectados de las flechas (apuntan al id de la forma de origen/destino) */
  start?: { id: string };
  end?: { id: string };
  /** Puntos relativos para flechas y líneas manuales: [[0, 0], [200, 50]] */
  points?: [number, number][];
}
```

---

## 🎨 Ejemplos prácticos por tipo de elemento

### 1. Formas con texto interior centrado (`rectangle`, `ellipse`, `diamond`)
Basta con pasar la propiedad `label`. El servidor crea la forma y un elemento de texto vinculado (`boundElements` y `containerId`) perfectamente centrado:

```json
{
  "id": "node-auth",
  "type": "rectangle",
  "x": 100,
  "y": 150,
  "label": "Servicio de autenticación",
  "backgroundColor": "#a5d8ff",
  "strokeColor": "#1971c2"
}
```

Para una decisión condicional en un diagrama de flujo:
```json
{
  "id": "node-check",
  "type": "diamond",
  "x": 380,
  "y": 130,
  "label": "¿Token válido?",
  "backgroundColor": "#ffec99"
}
```

### 2. Flechas conectadas y magnéticas (`arrow`)
Para unir dos formas, usa las propiedades `start` y `end` con los ID correspondientes. Heeey calcula el centro de las formas, orienta los puntos de la flecha y aplica la separación correcta de los bordes (`gap: 8px`):

```json
{
  "id": "arrow-auth-check",
  "type": "arrow",
  "start": { "id": "node-auth" },
  "end": { "id": "node-check" },
  "label": "valida el token"
}
```

> **Consejo**: las flechas pueden conectarse a formas enviadas en la misma petición o a formas que **ya estaban en la pizarra**.

### 3. Texto suelto (`text`)
Para cabeceras, títulos o anotaciones libres:

```json
{
  "type": "text",
  "x": 100,
  "y": 50,
  "text": "Arquitectura del sistema v2",
  "fontSize": 24,
  "strokeColor": "#1e1e1e"
}
```

### 4. Marcos / paneles de agrupación (`frame`)
Para delimitar áreas funcionales o secciones de un diagrama:

```json
{
  "id": "frame-backend",
  "type": "frame",
  "x": 50,
  "y": 80,
  "width": 600,
  "height": 400,
  "label": "Zona segura / VPC"
}
```

---

## 🧠 Valores por defecto aplicados automáticamente

Cuando se omiten los campos estéticos en la especificación, Heeey aplica valores coherentes:

- **Fuente**: familia 5 (`Excalifont`, la fuente manuscrita por defecto de Excalidraw).
- **Tamaños por defecto de las formas**:
  - `rectangle`: 180 × 80 px (crece con el texto).
  - `ellipse`: 140 × 100 px.
  - `diamond`: 180 × 110 px.
- **Colores por defecto**:
  - `strokeColor`: `#1e1e1e`
  - `backgroundColor`: `transparent`
  - `fillStyle`: `solid`
  - `roughness`: `1` (el característico estilo dibujado a mano)
  - `opacity`: `100`

---

## 🔄 Vista compacta (`describeElements`)

Al leer con formatos optimizados para modelos de lenguaje (como hacen las herramientas MCP), Heeey hace el proceso inverso:
- Las etiquetas vinculadas a formas se vuelven a incorporar a la propiedad `label` de la forma que las contiene.
- Las flechas muestran `start: { id }` y `end: { id }`.
- Las coordenadas decimales se redondean a enteros.
- Esta compactación ahorra hasta un 80 % de los tokens que ocupa la ventana de contexto del LLM.
