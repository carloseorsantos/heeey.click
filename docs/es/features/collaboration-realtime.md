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

Quién puede abrir una pizarra es la suma de tres capas (gana el mayor acceso). Los detalles están en [Equipos, proyectos y uso compartido](teams-and-sharing.md):

1. **Equipo y proyecto**: los miembros del equipo ven las pizarras de los proyectos abiertos al equipo; los proyectos privados, solo quienes fueron añadidos (owners y admins siempre los ven).
2. **Invitación directa**: personas invitadas por correo como **Lector** o **Editor**, incluso de fuera del equipo.
3. **Acceso general (el enlace)**, en el campo `access_level`:

| Acceso general | Valor en la base de datos | Descripción |
|---|---|---|
| **Restringido** | `'restricted'` | Solo quien tiene acceso por el equipo, el proyecto o una invitación abre la pizarra, incluso con el enlace. Predeterminado en las pizarras nuevas. |
| **Cualquiera con el enlace · Lector** | `'view'` | Quien tiene el enlace ve los cambios y los cursores en tiempo real, sin editar. |
| **Cualquiera con el enlace · Editor** | `'edit'` | Quien tiene el enlace dibuja a la vez, sin crear cuenta. |

Las pizarras creadas sin cuenta siguen abiertas para edición por enlace hasta que se guardan en un equipo.

### Cambiar el acceso general:
1. En la cabecera de la pizarra, abre el diálogo **Compartir**.
2. En **Acceso general**, elige **Restringido** o **Cualquiera con el enlace** (Lector o Editor).
3. El cambio vale al instante; quien tiene la pizarra abierta recibe un mensaje `meta-update` y vuelve a leer el permiso de la base de datos.

La sala en vivo sigue la misma regla: quien no puede abrir la pizarra no entra en el canal, y solo quien edita cambia la escena.

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
