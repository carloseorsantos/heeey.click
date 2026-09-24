# Colaboración y tiempo real (multijugador)

Heeey usa la infraestructura de **Supabase Realtime** para ofrecer una experiencia multijugador de baja latencia y muy resistente, combinando canales de **Broadcast** y **Presence** con una sincronización periódica con la base de datos.

---

## ⚡ Cómo funciona la sincronización

La colaboración en tiempo real funciona sobre el canal de la sala:
```
heeey:room:{boardId}
```

Ningún elemento tiene que pasar por colas lentas ni por sondeos. Cuando un colaborador mueve el cursor o cambia elementos:

```
[Cliente A] --(Broadcast por WebSocket)--> [Supabase Realtime] --(Fan-out)--> [Cliente B, Cliente C, ...]
```

### 1. Difusión de elementos (`canvas-update`)
- Mientras un usuario dibuja o mueve elementos, los cambios se envían mediante el evento `canvas-update`.
- El payload incluye los elementos modificados, los metadatos del color de fondo de la escena y una marca de tiempo.
- **Reconciliación de versiones**: cada elemento tiene campos de control de versión (`version`, `versionNonce`). El cliente local compara los elementos recibidos con los del lienzo y solo aplica las actualizaciones con un número de versión estrictamente mayor o que resuelven los empates de forma determinista.

### 2. Sincronización de presencia y cursores (`cursor-update` y Presence)
- Las posiciones del ratón y del puntero láser se transmiten con alta frecuencia sin ensuciar el historial de dibujo.
- Cada participante tiene:
  - Un nombre visible en el cursor.
  - Un color único para el avatar y el halo del cursor (derivado de forma coherente de la paleta de 12 tonos de Heeey).
  - El estado del puntero láser cuando está activo.
  - Los elementos que tiene seleccionados, resaltados en tiempo real.
- Cuando se cierra una pestaña o se cae la conexión, Supabase Presence retira el cursor automáticamente a los pocos segundos.

---

## 🔒 Niveles de acceso y permisos

Cada pizarra tiene un campo `access_level`:

| Nivel de acceso | Valor en la base de datos | Descripción |
|---|---|---|
| **Puede editar** | `'edit'` | Cualquier visitante con el enlace puede interactuar, dibujar y añadir notas. |
| **Solo lectura** | `'view'` | Los visitantes ven los cambios y los cursores de los demás en tiempo real, pero el lienzo queda bloqueado para ediciones locales. La persona propietaria de la pizarra conserva siempre todos los permisos de edición. |

### Cambiar el nivel de acceso:
1. En la cabecera de la pizarra, abre el diálogo **Compartir**.
2. Alterna entre **«Puede editar»** y **«Solo lectura»**.
3. El cambio llega al instante a todos los visitantes conectados mediante un mensaje `meta-update`.

---

## 🛡️ Guardado automático y persistencia local

Heeey usa una estrategia híbrida por capas:
1. **Caché local inmediata (`localStorage`)**: todos los cambios locales se guardan al instante en el almacenamiento del navegador. Si se cae la conexión, no se pierde nada.
2. **Guardado automático con debounce en la base de datos (`PostgreSQL`)**: los cambios consolidados se envían a Supabase con un debounce inteligente (unos 1,5 segundos de inactividad después del último trazo).
3. **Indicador del estado de sincronización**:
   - 🟢 **Guardado**: el estado en la nube coincide con lo que ves en pantalla.
   - 🟡 **Guardando…**: se están enviando cambios pendientes a la base de datos.
   - 🟠 **Sin conexión**: conexión perdida; los cambios se conservan de forma segura en la caché local.
   - 🔴 **Error**: fallo temporal de red; se lanzará un nuevo intento automáticamente.

---

## 👤 Personalización de los colaboradores

Los invitados pueden personalizar cómo aparecen en cualquier momento:
- Haz clic en tu avatar identificativo en la esquina superior derecha.
- Elige un apodo (*nickname*) y tu color favorito de la paleta.
- Tu elección se recuerda en el navegador y se aplica automáticamente en todas las pizarras que visites después.
