# Visión general del servidor MCP (Model Context Protocol)

**Heeey** ofrece un servidor nativo de **Model Context Protocol (MCP)**, el estándar abierto del sector para conectar modelos de lenguaje (LLMs) con fuentes de datos y herramientas externas.

Con el servidor MCP de Heeey, los agentes autónomos (como Claude Code, Claude Desktop, Cursor y otros) pueden revisar pizarras existentes, crear diagramas de arquitectura complejos, ordenar pizarras desordenadas y colaborar activamente con personas en tiempo real.

---

## 🚀 Cómo funciona MCP en Heeey

- **Endpoint único de producción**: `https://heeey.click/api/mcp`
- **Transporte**: **Streamable HTTP** (POST con un payload JSON-RPC 2.0 y cabeceras de control).
- **Sin estado (stateless)**: cada petición se autentica de forma independiente en la base de datos, lo que permite escalar al instante en entornos serverless/edge sin gestionar daemons ni WebSockets dedicados para el agente.
- **Versiones del protocolo admitidas**:
  - `2025-06-18`
  - `2025-03-26`
  - `2024-11-05`
- **Interoperabilidad verificada**: el servidor supera pruebas automáticas de integración con el SDK oficial `@modelcontextprotocol/sdk`.

---

## 🤖 Qué puede hacer el agente de IA

Al conectar un agente a Heeey, recibe un conjunto completo de herramientas capaces de:

1. **Leer escenas de forma inteligente (`get_board`)**:
   - Por defecto, el agente recibe una vista compacta y contextual de la escena: formas con su texto interior (`label`), flechas que indican qué nodos conectan (`start`, `end`) y coordenadas redondeadas. Así se ahorra hasta un 80 % del contexto del LLM.
2. **Generar diagramas automáticamente (`create_diagram`)**:
   - El agente solo tiene que enumerar los nodos (`label`, `shape`, `color`) y las conexiones (`from`, `to`, `label`).
   - El motor de disposición interno de Heeey ajusta el tamaño de cada caja a su texto, reparte los elementos en capas sin solapamientos y traza las flechas rodeando las formas.
3. **Ordenar pizarras existentes (`layout_board`)**:
   - ¿Alguien dibujó un flujo desordenado? El agente puede usar `layout_board` para alinear las formas y trazar las flechas automáticamente en la dirección indicada (`TB`, `LR`, `BT`, `RL`).
4. **Colaboración visible en directo**:
   - Cuando el agente añade o edita elementos, el cambio se difunde al instante por Supabase Realtime. ¡El usuario ve aparecer las formas en el lienzo mientras conversa con el asistente!
