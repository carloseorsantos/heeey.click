# Historial de versiones y restauración

Heeey incluye un sistema integrado de control de versiones point-in-time que protege el trabajo de tu equipo frente a ediciones no deseadas, desórdenes accidentales o pérdidas de datos.

---

## 🕒 Cómo funcionan las instantáneas

La base de datos guarda instantáneas de la pizarra en la tabla `board_versions` en dos situaciones:

1. **Instantáneas automáticas (`reason: 'auto'`)**:
   - El servidor las genera en segundo plano siempre que la pizarra se está editando.
   - El servidor respeta un intervalo mínimo de **10 minutos** entre instantáneas automáticas consecutivas para no acumular demasiados datos en sesiones largas.
2. **Instantáneas previas a la restauración (`reason: 'before_restore'`)**:
   - Antes de restaurar cualquier versión antigua, el estado actual de la pizarra se archiva al instante en el historial.
   - Esto significa que restaurar una versión **nunca es destructivo**; siempre puedes deshacer la restauración y volver al momento exacto anterior.

---

## 🗄️ Política de retención

- **Capacidad**: hasta las **30** versiones más recientes por pizarra.
- **Validez**: las versiones con más de **30 días** se eliminan automáticamente mediante disparadores de la base de datos.
- Al guardar la versión número 31, el disparador SQL elimina de forma transparente la versión más antigua de esa pizarra.

---

## 🔄 Algoritmo de reconciliación sin conflictos (`buildRestoredElements`)

Un problema habitual en las aplicaciones colaborativas al restaurar versiones antiguas es el conflicto con los colaboradores que siguen dibujando: los elementos antiguos, con un número de versión bajo, serían ignorados por los clientes conectados.

Heeey lo resuelve con un algoritmo determinista de incremento de versiones:

```typescript
export function buildRestoredElements(
  currentElements: readonly any[],
  versionElements: readonly any[],
  now: number = Date.now(),
  randomNonce: () => number = () => Math.floor(Math.random() * 2 ** 31)
): any[] {
  // 1. Cada elemento de la versión histórica recibe un número de 'version'
  // estrictamente mayor que el que tiene ahora en el lienzo.
  // 2. Los elementos que existen en el lienzo actual pero NO existían en la versión restaurada
  // se marcan con isDeleted: true y una versión incrementada.
}
```

### Ventajas del algoritmo:
- **Propagación inmediata**: la versión restaurada gana la reconciliación de Excalidraw en todos los navegadores conectados al momento.
- **Sin restos**: los dibujos hechos después del punto histórico desaparecen del lienzo de forma limpia.
- **Difusión en tiempo real**: se envía un mensaje `canvas-update` por el canal de Supabase que actualiza en directo la pantalla de todos los participantes.

---

## 🖥️ Cómo acceder al historial

1. Con la pizarra abierta, haz clic en el icono del reloj (**Historial de versiones**) de la cabecera.
2. Aparece la lista de puntos de restauración con fecha, hora, número de elementos y una miniatura.
3. Haz clic en una versión para inspeccionarla.
4. Haz clic en **«Restaurar esta versión»**. El lienzo se actualiza al instante.
