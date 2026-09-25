# Autenticación y claves de API

Heeey usa **claves personales de API** (*Personal API Keys*) para autorizar las peticiones a la API REST (`/api/v1`) y al servidor MCP (`/api/mcp`).

---

## 🔑 Cómo obtener una clave de API

1. Entra en [heeey.click](https://heeey.click) e inicia sesión en tu cuenta (mediante Magic Link).
2. En el panel, haz clic en el icono de la llave (**Claves de API**) de la cabecera.
3. Haz clic en **«Nueva clave»**:
   - Ponle un nombre identificativo (p. ej. `script-copia`, `claude-code`, `github-actions`).
   - Elige los alcances que necesitas:
     - **Lectura (`read`)**: permite listar pizarras y carpetas y leer el contenido de las escenas.
     - **Escritura (`write`)**: permite crear, modificar, mover y enviar pizarras a la papelera.
4. **Guarda tu clave en un lugar seguro**: la clave completa, con el formato `hk_<prefijo>_<secreto>`, se muestra **una sola vez**, al crearla.

---

## 🔒 Formato de la clave y almacenamiento seguro

- **Formato**: `hk_` seguido de un prefijo hexadecimal de 8 caracteres y un secreto criptográfico de 40 caracteres generado con `gen_random_bytes(24)`.
  Ejemplo: `hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4`
- **Almacenamiento en la base de datos**: el secreto en claro **nunca** se guarda en la base de datos. Supabase solo almacena:
  - El `prefix` (p. ej. `hk_1a2b3c4d`), que se muestra en la interfaz para que sepas qué clave es cuál.
  - El `key_hash`: un resumen criptográfico calculado con `sha256(clave)`.
- **Límite por cuenta**: cada usuario puede tener hasta **20 claves activas a la vez**.
- **Equipos a los que llega la clave**: al crear la clave eliges en qué equipos lee y cambia pizarras (por defecto, solo tu equipo personal). Las claves antiguas siguen llegando a tu equipo personal. Si sales de un equipo, la clave pierde el acceso a él al instante.

---

## 📤 Enviar la clave en las peticiones

Puedes enviar la clave en la cabecera estándar `Authorization` o en la cabecera personalizada `X-API-Key`:

### Opción 1: cabecera Authorization Bearer (recomendada)
```http
GET /api/v1/boards HTTP/1.1
Host: heeey.click
Authorization: Bearer hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
```

### Opción 2: cabecera X-API-Key
```http
GET /api/v1/boards HTTP/1.1
Host: heeey.click
X-API-Key: hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
```

---

## 🚫 Revocar una clave

Si tu clave se ha filtrado o quieres desactivar una integración antigua:
1. Abre el diálogo **Claves de API** en el panel.
2. Busca la clave por su prefijo o su nombre.
3. Haz clic en **«Revocar»**.
4. La clave se marca con `revoked_at = now()` y deja de funcionar al instante. La revocación es definitiva y no se puede deshacer.
