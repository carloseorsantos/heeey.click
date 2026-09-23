# Autenticação & Permissões no Servidor MCP

O servidor MCP do Heeey opera sobre transporte **Streamable HTTP** (`https://heeey.click/api/mcp`) e autentica cada requisição através de **Chaves Pessoais de API** (*Personal API Keys*).

Este documento explica como o acesso é validado, como as políticas de segurança são aplicadas no banco de dados e como as anotações de ferramentas orientam a execução segura por modelos de linguagem (LLMs).

---

## 🔑 Como a Autenticação Funciona

Ao configurar um cliente MCP (como Claude Code, Claude Desktop ou Cursor), a chave de API deve ser fornecida nos cabeçalhos HTTP da conexão:

```http
POST /api/mcp HTTP/1.1
Host: heeey.click
Authorization: Bearer hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
Content-Type: application/json
Accept: application/json
```

O cabeçalho alternativo `X-API-Key` também é aceito:
```http
X-API-Key: hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
```

### Ausência de Chave ou Chave Inválida
Caso a requisição não contenha uma credencial válida:
- Retorna HTTP status `401 Unauthorized`.
- Inclui o cabeçalho `WWW-Authenticate: Bearer realm="heeey.click"`.
- O corpo responde com o erro JSON-RPC 2.0 padrão:
  ```json
  {
    "jsonrpc": "2.0",
    "id": null,
    "error": {
      "code": -32001,
      "message": "Envie sua chave de API do heeey.click em Authorization: Bearer <chave>."
    }
  }
  ```

---

## 🛡️ Escopos & Isolamento de Dados no Banco

As ferramentas MCP não executam com permissões administrativas globais. Cada ferramenta aciona funções no PostgreSQL que invocam `public.api_authenticate(p_key, required_scope)`:

1. **Contexto do Usuário (`v_user`)**: O banco descobre quem é o dono da chave a partir do hash SHA-256 e atua estritamente sobre os registros daquele usuário.
2. **Escopos Suportados**:
   - **`read`**: Permissão para consultar e ler informações.
   - **`write`**: Permissão para criar, atualizar, desenhar e excluir.

### Mapeamento de Escopos por Ferramenta MCP:

| Ferramenta MCP | Escopo Mínimo Requerido | Ação Executada |
|---|---|---|
| `list_boards` | `read` | Lista os quadros da conta. |
| `search_boards` | `read` | Busca full-text em títulos e textos. |
| `get_board` | `read` | Lê elementos e estado da lousa. |
| `list_folders` | `read` | Lista pastas organizadoras. |
| `create_board` | `write` | Cria um novo quadro. |
| `add_elements` | `write` | Insere ou atualiza elementos no canvas. |
| `delete_elements` | `write` | Apaga elementos específicos da cena. |
| `rename_board` | `write` | Altera o título de um quadro. |
| `trash_board` | `write` | Envia o quadro para a lixeira. |
| `create_diagram` | `write` | Cria diagramas com auto-layout Dagre. |
| `layout_board` | `write` | Reorganiza visualmente uma lousa existente. |
| `create_folder` | `write` | Cria uma nova pasta. |
| `move_board` | `write` | Aloca um quadro dentro de uma pasta. |

> Se uma chave configurada apenas com o escopo `read` tentar invocar uma ferramenta de escrita (como `create_diagram`), a chamada não alterará nada e retornará a mensagem de erro da ferramenta: `"Esta chave de API não tem permissão de escrita."`.

---

## 🚦 Anotações de Ferramentas (Tool Annotations)

O protocolo MCP permite sinalizar aos clientes de IA as características de segurança de cada ferramenta. O Heeey implementa três anotações fundamentais em seu catálogo:

### 1. `readOnlyHint: true`
- **Ferramentas**: `list_boards`, `search_boards`, `get_board`, `list_folders`.
- **Efeito no Agente**: Indica que a chamada não realiza nenhuma alteração de estado. Agentes autônomos podem executá-las livremente em segundo plano para inspecionar e planejar antes de desenhar.

### 2. `destructiveHint: true`
- **Ferramentas**: `delete_elements`, `trash_board`.
- **Efeito no Agente**: Sinaliza que dados serão removidos ou arquivados. Clientes de IA normalmente solicitam confirmação explícita ao usuário humano antes de executar ferramentas com esta anotação.

### 3. `idempotentHint: true`
- **Ferramentas**: `rename_board`, `trash_board`, `layout_board`, `move_board`.
- **Efeito no Agente**: Indica que disparar a mesma chamada repetidas vezes produz o mesmo resultado final, permitindo retentativas seguras em caso de falhas transitórias de conexão.

---

## ⚙️ Protocolo vs. Erros de Ferramenta

O servidor MCP do Heeey diferencia com precisão os dois níveis de erro:

### 1. Erros de Protocolo JSON-RPC 2.0
Falhas de rede, formato de requisição inválido ou métodos não implementados respondem no nível do protocolo:
- `-32700`: JSON malformatado (*Parse error*).
- `-32600`: Objeto não obedece à especificação JSON-RPC 2.0 (*Invalid Request*).
- `-32601`: Método desconhecido (*Method not found*).
- `-32602`: Nome de ferramenta desconhecido ou argumentos ausentes.
- `-32001`: Autenticação ausente ou chave revogada.

### 2. Erros de Execução de Ferramentas (`isError: true`)
Quando a requisição é válida mas a operação no Heeey falha (por exemplo: tentar editar um quadro que já está na lixeira, passar um UUID inexistente ou violar permissões), o servidor retorna uma resposta JSON-RPC bem-sucedida contendo o payload de erro da ferramenta:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Quadro na lixeira é somente leitura."
      }
    ],
    "isError": true
  }
}
```

Essa abordagem é crucial para agentes de IA: em vez de travar a conexão do cliente, o LLM lê a explicação textual do erro e é capaz de raciocinar e corrigir seu plano (ex.: restaurar o quadro antes de desenhar ou escolher outro quadro válido).
