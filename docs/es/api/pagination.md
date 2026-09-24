# Paginación en la API

Al listar colecciones grandes (como pizarras o resultados de búsqueda), Heeey usa el modelo estándar de paginación por **desplazamiento y límite** (*Offset & Limit*).

---

## 🧭 Parámetros de paginación

Los endpoints que admiten paginación aceptan estos parámetros de consulta en la URL (*query parameters*):

| Parámetro | Tipo | Por defecto | Mínimo | Máximo | Descripción |
|---|---|---|---|---|---|
| `limit` | `integer` | `50` | `1` | `200` | Número máximo de registros que se devuelven en la página actual. |
| `offset` | `integer` | `0` | `0` | — | Número de registros que se saltan desde el principio de la ordenación. |

> **Nota de seguridad**: si envías un `limit` mayor que 200 o menor que 1, la base de datos de Heeey lo ajusta automáticamente al rango permitido (`least(greatest(limit, 1), 200)`) sin devolver un error.

---

## 📋 Endpoints que admiten paginación

### 1. `GET /api/v1/boards`
Lista las pizarras del usuario de la clave de API, de la editada más recientemente a la más antigua (`updated_at desc`).

```http
GET /api/v1/boards?limit=25&offset=50 HTTP/1.1
Host: heeey.click
Authorization: Bearer hk_...
```

**Filtros que se pueden combinar con la paginación:**
- `folder_id=<uuid>`: pagina solo las pizarras de la carpeta indicada.
- `include_trashed=true`: incluye las pizarras de la papelera.

### 2. `GET /api/v1/search`
Búsqueda de texto en los títulos y en el contenido dibujado en el lienzo. Acepta:
- `limit`: número máximo de resultados (por defecto: `20`).
- Los resultados se ordenan por puntuación de relevancia (`rank desc`).

```http
GET /api/v1/search?q=kubernetes&limit=10 HTTP/1.1
Host: heeey.click
Authorization: Bearer hk_...
```

---

## 💻 Ejemplos de implementación

### Ejemplo 1: cURL

Para obtener las 3 primeras páginas de 50 pizarras:

```bash
# Página 1 (pizarras 0 a 49)
curl "https://heeey.click/api/v1/boards?limit=50&offset=0" \
  -H "Authorization: Bearer hk_..."

# Página 2 (pizarras 50 a 99)
curl "https://heeey.click/api/v1/boards?limit=50&offset=50" \
  -H "Authorization: Bearer hk_..."

# Página 3 (pizarras 100 a 149)
curl "https://heeey.click/api/v1/boards?limit=50&offset=100" \
  -H "Authorization: Bearer hk_..."
```

---

### Ejemplo 2: TypeScript / JavaScript (recorrer todas las páginas)

```typescript
interface BoardSummary {
  id: string;
  title: string;
  url: string;
  updated_at: string;
}

async function fetchAllBoards(apiKey: string): Promise<BoardSummary[]> {
  const allBoards: BoardSummary[] = [];
  const pageSize = 100;
  let offset = 0;

  while (true) {
    const response = await fetch(
      `https://heeey.click/api/v1/boards?limit=${pageSize}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Fallo en la API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const boards: BoardSummary[] = data.boards || [];
    allBoards.push(...boards);

    // Si la página trae menos elementos que el límite, hemos llegado al final
    if (boards.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allBoards;
}
```

---

### Ejemplo 3: Python

```python
import requests

API_KEY = "hk_..."
BASE_URL = "https://heeey.click/api/v1/boards"

def get_all_boards():
    boards = []
    limit = 50
    offset = 0

    while True:
        resp = requests.get(
            BASE_URL,
            headers={"Authorization": f"Bearer {API_KEY}"},
            params={"limit": limit, "offset": offset}
        )
        resp.raise_for_status()
        batch = resp.json().get("boards", [])
        boards.extend(batch)

        if len(batch) < limit:
            break
        offset += limit

    return boards
```

---

## 🎯 Buenas prácticas

1. **Evita desplazamientos enormes**: en cuentas con miles de pizarras, combina la paginación con el filtro `folder_id` para mantener las consultas en rangos pequeños.
2. **Condición de parada**: la API no devuelve un recuento total (para mantener la latencia mínima), así que la forma correcta de terminar el bucle es comprobar si el número de elementos devueltos en `boards` es estrictamente menor que el `limit` solicitado.
