# Visão Geral do Servidor MCP (Model Context Protocol)

O **Heeey** disponibiliza um servidor nativo de **Model Context Protocol (MCP)**, o padrão aberto da indústria para conectar modelos de linguagem (LLMs) a fontes de dados e ferramentas externas.

Com o MCP do Heeey, agentes autônomos (como Claude Code, Claude Desktop, Cursor e outros) podem inspecionar lousas existentes, criar diagramas arquiteturais complexos, reorganizar quadros bagunçados e colaborar ativamente com humanos em tempo real.

---

## 🚀 Como Funciona o MCP no Heeey

- **Endpoint Único de Produção**: `https://heeey.click/api/mcp`
- **Transporte**: **Streamable HTTP** (POST com payload JSON-RPC 2.0 e cabeçalhos de controle).
- **Sem Estado (Stateless)**: Cada requisição é autenticada de forma independente via banco de dados, permitindo escalabilidade instantânea em ambientes serverless/edge sem necessidade de gerenciar daemons ou WebSockets dedicados para o agente.
- **Versões Suportadas do Protocolo**:
  - `2025-06-18`
  - `2025-03-26`
  - `2024-11-05`
- **Interoperabilidade Verificada**: O servidor passa em testes automatizados de integração contra o SDK oficial `@modelcontextprotocol/sdk`.

---

## 🤖 Capacidades do Agente de IA

Ao conectar um agente ao Heeey, ele recebe um conjunto completo de ferramentas capazes de:

1. **Leitura Inteligente de Cenas (`get_board`)**:
   - Por padrão, o agente recebe uma visão compacta e contextualizada da cena: formas com seus textos internos (`label`), setas indicando quais nós conectam (`start`, `end`) e coordenadas arredondadas. Isso economiza até 80% do contexto do LLM.
2. **Geração Automatizada de Diagramas (`create_diagram`)**:
   - O agente só precisa listar os nós (`label`, `shape`, `color`) e as ligações (`from`, `to`, `label`).
   - O motor gráfico interno do Heeey calcula o tamanho de cada caixa pelo texto, distribui os elementos em camadas sem sobreposições e roteia as setas contornando as formas.
3. **Organização de Lousas Existentes (`layout_board`)**:
   - Um usuário desenhou um fluxo desorganizado? O agente pode acionar `layout_board` para alinhar formas e rotear setas automaticamente no sentido especificado (`TB`, `LR`, `BT`, `RL`).
4. **Colaboração Visível ao Vivo**:
   - Quando o agente insere ou edita elementos, a alteração é transmitida instantaneamente pelo Supabase Realtime. O usuário vê as formas surgirem no canvas enquanto conversa com o assistente!
