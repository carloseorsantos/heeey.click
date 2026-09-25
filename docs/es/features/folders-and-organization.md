# Carpetas, organización y papelera

El panel de Heeey ofrece todo lo necesario para estructurar, clasificar y proteger tus pizarras de trabajo.

---

## 📁 Carpetas anidadas

Para mantener organizados proyectos, equipos o asignaturas, puedes crear árboles de carpetas de cualquier profundidad:

- **Crear carpetas**: en el panel, haz clic en **«Nueva carpeta»**, escribe el nombre y elige si va en el nivel superior o dentro de una carpeta existente.
- **Navegación con migas de pan**: la ruta visual completa (p. ej. `Inicio > Design System > Componentes web`) te permite saltar a cualquier nivel intermedio con un clic.
- **Mover pizarras**:
  - En el menú de tres puntos de cualquier tarjeta de pizarra, elige **«Mover a carpeta»**.
  - Se muestra el árbol completo para que puedas mover la pizarra a cualquier carpeta o devolverla al nivel superior.
- **Eliminar carpetas**:
  - Al eliminar una carpeta que contiene subcarpetas, todas las subcarpetas se eliminan de forma recursiva.
  - **Tu contenido está a salvo**: las pizarras que estaban dentro de la carpeta eliminada **no se borran**; vuelven al nivel superior de tu panel (`folder_id = null`).

---

## 🗑️ Papelera (borrado lógico) y protección contra borrados accidentales

Heeey borra en dos pasos:

### 1. Mover a la papelera
- Mover una pizarra a la papelera establece `deleted_at = now()`.
- La pizarra desaparece al instante de las listas activas, de las carpetas y de las búsquedas por defecto.
- Si alguien tiene la pizarra abierta cuando se envía a la papelera, pasa automáticamente al modo de solo lectura con un aviso en la parte superior.

### 2. Restaurar
- En cualquier momento, abre la pestaña **«Papelera»** del panel.
- Haz clic en el botón de restaurar de la tarjeta para devolver la pizarra a su carpeta original.
- Además, justo después de cualquier borrado accidental aparece un aviso con la opción *Deshacer*.

### 3. Eliminación definitiva
- Solo la persona propietaria con sesión iniciada puede eliminar definitivamente una pizarra de la papelera.
- La eliminación definitiva borra:
  - El registro de la pizarra en la tabla `boards`.
  - Todas las imágenes asociadas en el bucket `board-media` de Supabase Storage.
  - Todas las versiones históricas de `board_versions`.
- Las pizarras que pasan más de **30 días** en la papelera se eliminan definitivamente de forma automática, una vez al día (Vercel Cron en `/api/cron/purge`, que llama a `public.purge_expired_data()`).

---

## 🖼️ Miniaturas inteligentes

Para que el panel cargue al instante incluso con decenas de pizarras complejas:
- Mientras dibujas, se genera en segundo plano en el cliente una miniatura rasterizada en **WebP** (`maxWidthOrHeight = 480px`, calidad 0.7) cada 20 segundos de actividad.
- La cadena codificada en base64 se guarda en la columna `thumbnail` de la tabla `boards`.
- El panel solo descarga los metadatos y las miniaturas compactas (`fetchBoardSummaries`), sin tener que descargar los elementos en bruto de decenas de escenas completas.
- En el modo oscuro del panel, un filtro CSS invierte con armonía las miniaturas claras sin procesamiento gráfico adicional.

---

## 📑 Plantillas iniciales

Al crear una pizarra nueva, puedes partir de plantillas listas para usar:

1. **Lluvia de ideas**:
   - Pizarras temáticas con notas adhesivas de colores agrupadas por ideas, retos y próximos pasos.
2. **Diagrama de flujo**:
   - Nodos de proceso ya conectados, con bloques de inicio y fin y un rombo de decisión.
3. **Wireframe**:
   - Elementos estructurales de interfaz: barra de navegación, cajas de contenido y botones interactivos.
