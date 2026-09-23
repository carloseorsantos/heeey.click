# Taxas & Limites Operacionais (Rate Limiting)

Para garantir estabilidade, baixa latência e consumo equilibrado de recursos entre todos os usuários e integrações, o Heeey estabelece limites operacionais para a API REST (`/api/v1`) e para o servidor MCP (`/api/mcp`).

---

## 🛑 Limites Estruturais de Dados

| Escopo | Limite | Código de Erro | Detalhes |
|---|---|---|---|
| **Elementos por Chamada (`elements`)** | Máx. **5.000 elementos** | `400 Bad Request` (`invalid_request`) | Validado pela função de banco `api_check_elements`. Evita payloads excessivos que sobrecarreguem o canvas no navegador dos clientes conectados. |
| **Nós por Diagrama (`create_diagram`)** | Máx. **300 nós** | `400 Bad Request` (`invalid_request`) | O motor de layout Dagre calcula a disposição de até 300 nós com alta velocidade e roteamento sem colisão de setas. |
| **Chaves de API Ativas por Usuário** | Máx. **20 chaves** | `400 Bad Request` (`invalid_request`) | Cada conta pode manter até 20 chaves ativas simultâneas. Revogue chaves antigas antes de gerar novas se atingir a cota. |
| **Dimensão Máxima de Imagens** | **1.600 px** (largura/altura) | Redimensionamento automático | Imagens arrastadas ou coladas são redimensionadas no cliente antes do envio ao Supabase Storage (`board-media`). |
| **Tamanho Alvo de Mídia Otimizada** | **< 150 KB** por imagem | Compressão automática | Pipeline converte para WebP (qualidade 0.8) mantendo alta fidelidade com baixíssimo consumo de banda. |
| **Tempo Limite de Execução (Edge)** | **25 segundos** | `504 Gateway Timeout` | As funções de borda (`api/v1.ts` e `api/mcp.ts`) executam no Vercel Edge Runtime e respondem tipicamente em menos de 100ms. |

---

## 🚦 Limites de Concorrência & Rede

1. **Requisições Simultâneas**:
   - A arquitetura serverless no Vercel Edge escala automaticamente para atender picos de requisições concorrentes.
   - Chamadas simultâneas de atualização (`PATCH /boards/:id` ou chamadas MCP) são serializadas por transações no PostgreSQL com bloqueio de linha (`for update`), evitando corrupção de estado.

2. **Cotas do Supabase Database**:
   - As funções da API conectam-se diretamente ao PostgreSQL via chamadas RPC autenticadas.
   - Em caso de saturação do pool de conexões do banco, a API responderá com status `500 Server Error`.

---

## 💡 Recomendações e Boas Práticas

### 1. Agrupe Atualizações de Elementos (Batching)
Em vez de enviar 50 requisições individuais com um elemento cada via `PATCH /api/v1/boards/:id`, envie um único array contendo todos os 50 elementos. Isso reduz o overhead de rede e dispara apenas uma notificação de broadcast em tempo real para os colaboradores.

### 2. Tratamento com Backoff Exponencial
Caso sua integração receba um erro temporário de rede ou status 500/504, implemente uma política de repetição com atraso progressivo:

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

### 3. Use `originBeside` e Nós Reutilizáveis
Ao gerar diagramas em lousas existentes via MCP, reutilize os IDs de nós existentes para atualizá-los no lugar, ou confie no motor de layout para calcular as distâncias sem sobrecarregar a memória do canvas.
