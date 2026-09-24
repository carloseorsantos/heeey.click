# Tasas y límites operativos (Rate Limiting)

Para garantizar la estabilidad, una latencia baja y un uso equilibrado de los recursos entre todos los usuarios e integraciones, Heeey establece límites operativos para la API REST (`/api/v1`) y el servidor MCP (`/api/mcp`).

---

## 🛑 Límites estructurales de datos

| Ámbito | Límite | Código de error | Detalles |
|---|---|---|---|
| **Elementos por llamada (`elements`)** | Máx. **5.000 elementos** | `400 Bad Request` (`invalid_request`) | Lo comprueba la función de base de datos `api_check_elements`. Evita payloads excesivos que sobrecarguen el lienzo en los navegadores de los clientes conectados. |
| **Nodos por diagrama (`create_diagram`)** | Máx. **300 nodos** | `400 Bad Request` (`invalid_request`) | El motor de disposición Dagre coloca hasta 300 nodos con rapidez y traza las flechas sin colisiones. |
| **Claves de API activas por usuario** | Máx. **20 claves** | `400 Bad Request` (`invalid_request`) | Cada cuenta puede tener hasta 20 claves activas a la vez. Revoca las claves antiguas antes de crear otras si llegas al límite. |
| **Tamaño máximo de las imágenes** | **1.600 px** (ancho/alto) | Redimensionado automático | Las imágenes arrastradas o pegadas se redimensionan en el cliente antes de subirlas a Supabase Storage (`board-media`). |
| **Tamaño objetivo de los medios optimizados** | **< 150 KB** por imagen | Compresión automática | El proceso convierte a WebP (calidad 0.8) con gran fidelidad y un consumo de ancho de banda muy bajo. |
| **Tiempo máximo de ejecución (Edge)** | **25 segundos** | `504 Gateway Timeout` | Las funciones edge (`api/v1.ts` y `api/mcp.ts`) se ejecutan en Vercel Edge Runtime y suelen responder en menos de 100 ms. |

---

## 🚦 Límites de concurrencia y de red

1. **Peticiones simultáneas**:
   - La arquitectura serverless de Vercel Edge escala automáticamente para atender picos de peticiones concurrentes.
   - Las actualizaciones simultáneas (`PATCH /boards/:id` o llamadas MCP) se serializan mediante transacciones de PostgreSQL con bloqueo de fila (`for update`), lo que evita corromper el estado.

2. **Cuotas de la base de datos de Supabase**:
   - Las funciones de la API se conectan directamente a PostgreSQL mediante llamadas RPC autenticadas.
   - Si el pool de conexiones de la base de datos se satura, la API responde con el estado `500 Server Error`.

---

## 💡 Recomendaciones y buenas prácticas

### 1. Agrupa las actualizaciones de elementos (batching)
En lugar de enviar 50 peticiones separadas con un elemento cada una mediante `PATCH /api/v1/boards/:id`, envía un único array con los 50 elementos. Así reduces la sobrecarga de red y se envía una sola notificación en tiempo real a los colaboradores.

### 2. Reintentos con espera exponencial
Si tu integración recibe un error temporal de red o un estado 500/504, reintenta con una espera cada vez mayor:

```typescript
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 500) {
  try {
    const res = await fetch(url, options);
    if (res.status >= 500 && retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
}
```

### 3. Usa `originBeside` y reutiliza nodos
Al generar diagramas en pizarras existentes mediante MCP, reutiliza los ID de los nodos existentes para actualizarlos en su sitio, o deja que el motor de disposición calcule las distancias sin sobrecargar la memoria del lienzo.
