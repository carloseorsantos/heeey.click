# Paginação na API (Pagination)

Ao listar recursos volumosos (como quadros de trabalho ou resultados de busca), o Heeey utiliza o modelo padrão de paginação por **Deslocamento e Limite** (*Offset & Limit*).

---

## 🧭 Parâmetros de Paginação

Os endpoints que suportam paginação aceitam os seguintes parâmetros de consulta na URL (*query parameters*):

| Parâmetro | Tipo | Padrão | Mínimo | Máximo | Descrição |
|---|---|---|---|---|---|
| `limit` | `integer` | `50` | `1` | `200` | Quantidade máxima de registros a retornar na página atual. |
| `offset` | `integer` | `0` | `0` | — | Quantidade de registros a saltar a partir do início da ordenação. |

> **Nota de Segurança**: Se você enviar um valor de `limit` maior que 200 ou menor que 1, o banco de dados do Heeey ajustará automaticamente o valor para os limites permitidos (`least(greatest(limit, 1), 200)`), sem lançar erro.

---

## 📋 Endpoints com Suporte a Paginação

### 1. `GET /api/v1/boards`
Lista os quadros pertencentes ao usuário da chave de API, ordenados de forma decrescente pela data da última edição (`updated_at desc`).

```http
GET /api/v1/boards?limit=25&offset=50 HTTP/1.1
Host: heeey.click
Authorization: Bearer hk_...
```

**Filtros combináveis com paginação:**
- `folder_id=<uuid>`: Pagina apenas quadros contidos na pasta especificada.
- `include_trashed=true`: Inclui quadros na lixeira na paginação.

### 2. `GET /api/v1/search`
Busca textual em títulos e conteúdo desenhado no canvas. Aceita o parâmetro:
- `limit`: Quantidade máxima de resultados (padrão: `20`).
- Resultados são ordenados pela pontuação de relevância (`rank desc`).

```http
GET /api/v1/search?q=kubernetes&limit=10 HTTP/1.1
Host: heeey.click
Authorization: Bearer hk_...
```

---

## 💻 Exemplos de Implementação

### Exemplo 1: cURL

Para buscar as 3 primeiras páginas de 50 quadros:

```bash
# Página 1 (quadros 0 a 49)
curl "https://heeey.click/api/v1/boards?limit=50&offset=0" \
  -H "Authorization: Bearer hk_..."

# Página 2 (quadros 50 a 99)
curl "https://heeey.click/api/v1/boards?limit=50&offset=50" \
  -H "Authorization: Bearer hk_..."

# Página 3 (quadros 100 a 149)
curl "https://heeey.click/api/v1/boards?limit=50&offset=100" \
  -H "Authorization: Bearer hk_..."
```

---

### Exemplo 2: TypeScript / JavaScript (Iterando Todas as Páginas)

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
      throw new Error(`Falha na API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const boards: BoardSummary[] = data.boards || [];
    allBoards.push(...boards);

    // Se a página retornou menos itens que o limite, atingimos o final
    if (boards.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allBoards;
}
```

---

### Exemplo 3: Python

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

## 🎯 Boas Práticas

1. **Evite Offsets Gigantescos**: Para contas com milhares de quadros, combine a paginação com o filtro `folder_id` para manter as consultas em faixas reduzidas.
2. **Condição de Parada**: Como a API não retorna um contador total para manter latência mínima, a condição ideal de encerramento do loop é checar se o número de itens retornados em `boards` é estritamente menor do que o `limit` solicitado.
