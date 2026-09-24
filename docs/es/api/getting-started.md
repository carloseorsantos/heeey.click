# Primeros pasos con la API

> Crea tu primera pizarra en Heeey de forma programática en menos de 3 minutos.

La API REST v1 de **Heeey** te permite crear, consultar, actualizar y organizar pizarras y diagramas directamente desde código, scripts de automatización, webhooks o agentes autónomos.

---

## ⚡ Paso 1: crea tu clave de API

Todas las llamadas a la API se autentican con una **clave personal de API** vinculada a tu cuenta:

1. Entra en [heeey.click](https://heeey.click) e inicia sesión en tu cuenta (mediante Magic Link).
2. En el panel, haz clic en el icono de la llave (**Claves de API**) de la cabecera.
3. Haz clic en **«Nueva clave»**:
   - Ponle un nombre a la clave (p. ej. `script-prueba`).
   - Marca los alcances de **Lectura** (`read`) y **Escritura** (`write`).
4. Copia la clave generada (`hk_...`). Solo se muestra una vez.

---

## 🚀 Paso 2: crea tu primera pizarra

Envía una petición `POST` a `/api/v1/boards` con el título de la pizarra y algunas formas básicas.

Puedes usar el formato abreviado de elementos (**Element Spec**), indicando solo el tipo, las coordenadas y el texto (`label`):

```bash
curl -X POST https://heeey.click/api/v1/boards \
  -H "Authorization: Bearer hk_TU_CLAVE_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Primer flujo con la API",
    "elements": [
      {
        "id": "step-1",
        "type": "rectangle",
        "x": 100,
        "y": 150,
        "label": "Inicio del proceso",
        "backgroundColor": "#a5d8ff",
        "strokeColor": "#1971c2"
      },
      {
        "id": "step-2",
        "type": "diamond",
        "x": 380,
        "y": 135,
        "label": "¿Aprobado?",
        "backgroundColor": "#ffec99",
        "strokeColor": "#f08c00"
      },
      {
        "type": "arrow",
        "start": { "id": "step-1" },
        "end": { "id": "step-2" },
        "label": "envía"
      }
    ]
  }'
```

### Respuesta correcta (`201 Created`):
```json
{
  "board": {
    "id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "title": "Primer flujo con la API",
    "folder_id": null,
    "access_level": "edit",
    "created_at": "2026-09-23T14:00:00Z",
    "updated_at": "2026-09-23T14:00:00Z",
    "deleted_at": null,
    "element_count": 5,
    "url": "https://heeey.click/b/e67e3a1e-8e89-4089-a5f1-382a39281a92"
  }
}
```

> **Consejo**: copia el enlace devuelto en `url` y ábrelo en el navegador para ver la pizarra dibujada con sus colores y sus conexiones magnéticas perfectamente colocadas.

---

## 👁️ Paso 3: consulta los datos de la pizarra

Para leer el estado actual de la pizarra que has creado:

```bash
curl -X GET https://heeey.click/api/v1/boards/e67e3a1e-8e89-4089-a5f1-382a39281a92 \
  -H "Authorization: Bearer hk_TU_CLAVE_AQUI"
```

La respuesta contiene los metadatos de la pizarra y el array completo `elements` con todos los objetos vectoriales de Excalidraw listos para dibujar.

---

## 🔴 Paso 4: actualización en directo

Deja la pizarra abierta en una pestaña del navegador y ejecuta la llamada `PATCH` siguiente para añadir un paso nuevo al flujo:

```bash
curl -X PATCH https://heeey.click/api/v1/boards/e67e3a1e-8e89-4089-a5f1-382a39281a92 \
  -H "Authorization: Bearer hk_TU_CLAVE_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "elements": [
      {
        "id": "step-3",
        "type": "rectangle",
        "x": 650,
        "y": 150,
        "label": "En producción",
        "backgroundColor": "#b2f2bb",
        "strokeColor": "#2f9e44"
      },
      {
        "type": "arrow",
        "start": { "id": "step-2" },
        "end": { "id": "step-3" },
        "label": "sí"
      }
    ]
  }'
```

Mira la pestaña del navegador: ¡el nuevo bloque y la flecha aparecen en pantalla al instante, sin recargar la página! Heeey difunde los cambios automáticamente por el canal de Supabase Realtime.

---

## 📚 Próximos pasos

- Conoce el formato detallado de formas, etiquetas y flechas en el [Esquema del contenido de la escena](scene-content-schema.md).
- Consulta todos los métodos disponibles en la [Referencia de endpoints](endpoints.md).
- Aprende a paginar resultados en [Paginación](pagination.md).
- Revisa los límites de tamaño del payload en [Tasas y límites operativos](rate-limiting.md).
