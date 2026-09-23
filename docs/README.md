# Documentação do Heeey (heeey.click)

> Lousa interativa e whiteboard colaborativo em tempo real, com persistência na nuvem, API REST pública e servidor MCP para agentes de IA.

Bem-vindo à documentação oficial do **Heeey**. Inspirada na arquitetura e documentação do ecossistema Excalidraw (`https://plus.excalidraw.com/docs`), esta documentação descreve todos os recursos, ferramentas de desenho, colaboração multiplayer, API REST v1, servidor MCP (*Model Context Protocol*) e modelo de dados do Heeey.

---

## 🧭 Navegação Rápida

<div class="grid">

### 🎨 [Recursos & Lousa](features/whiteboard-editor.md)
Explore o canvas vetorial baseado no `@excalidraw/excalidraw` 0.18, suporte a temas claro/escuro, ferramentas de desenho, formas, texto encadernado, setas inteligentes e atalhos.

### 👥 [Colaboração & Tempo Real](features/collaboration-realtime.md)
Entenda como funciona o multiplayer via Supabase Realtime (Broadcast e Presence), cursores ao vivo, nomes/cores de colaboradores, modo leitura vs. edição e links compartilháveis.

### 📁 [Organização & Dashboard](features/folders-and-organization.md)
Aprenda sobre o gerenciamento de quadros, pastas hierárquicas, busca global com destaque de texto, templates (Brainstorming, Fluxograma, Wireframe) e lixeira com proteção contra exclusão acidental.

### 🕒 [Histórico de Versões](features/version-history.md)
Saiba como snapshots automáticos a cada 10 minutos, retenção de 30 dias e snapshots pré-restauração garantem recuperação de estados com reconciliação sem perdas.

### 🌍 [Internacionalização (i18n)](features/i18n.md)
Suporte nativo e verificado a Português (`pt-BR`) e Inglês (`en`), detecção automática de idioma do navegador, pluralização ICU e sincronização do idioma do Excalidraw.

### 🧩 [Bibliotecas Pessoais](features/libraries.md)
Persistência na nuvem de bibliotecas de componentes reutilizáveis para usuários autenticados, cache local para convidados e migração automática no primeiro login.

### 🖼️ [Mídia & Otimização de Imagens](features/media-and-images.md)
Pipeline automático de compressão WebP/JPEG no cliente (máx 1600px, ~150KB), upload assíncrono para o Supabase Storage (`board-media`) e fallback offline gracioso.

### 🔍 [Busca Global no Canvas](features/search.md)
Busca full-text no PostgreSQL com `unaccent` e índices GIN, pesquisando em títulos e em todos os textos desenhados nas lousas com snippets destacados.

### 🔌 [API REST v1](api/overview.md)
Automatize a criação, leitura e manipulação de quadros e pastas. Autenticação por chave pessoal (`hk_...`), formato resumido de elementos, paginação e broadcast em tempo real.

### 🤖 [Servidor MCP para IA](mcp/overview.md)
Conecte Claude Code, Claude Desktop, Cursor e outros agentes inteligentes via Streamable HTTP (`/api/mcp`). Crie diagramas com layout em camadas automático (Dagre / Sugiyama) e organize quadros programaticamente.

</div>

---

## ⚡ O que é o Heeey?

O Heeey é uma aplicação web moderna de colaboração visual desenvolvida com foco em velocidade, simplicidade e abertura:

- **Whiteboard Core**: Utiliza o motor oficial `@excalidraw/excalidraw` 0.18.x, preservando a estética artesanal desenhada à mão (*hand-drawn*), exportação SVG/PNG com fidelidade total e suporte completo a bibliotecas de elementos.
- **Multiplayer Ultrarrápido**: Realtime Broadcast e Presence integrados sobre o canal `heeey:room:{boardId}`, permitindo latência mínima em alterações de canvas e cursores ao vivo.
- **Autenticação Descomplicada**: Acesso híbrido — convidados podem criar quadros instantaneamente; usuários registrados autenticam-se sem senhas via Magic Link (Email OTP) e herdam seus quadros anônimos automaticamente.
- **Programável & Orientado a Agentes**: Toda a infraestrutura possui suporte de primeira classe para automação via API REST e protocolo MCP, permitindo que agentes LLM leiam, compreendam, gerem e organizem diagramas complexos em segundos.
- **Totalmente Internacionalizado**: Suporte nativo e verificado em testes a Português (`pt-BR`) e Inglês (`en`).

---

## 📖 Índice Completo de Documentos

1. **Visão Geral & Começando**:
   - [Guia Rápido Geral (Getting Started)](getting-started.md)
2. **Funcionalidades da Lousa & Aplicação**:
   - [Canvas & Ferramentas de Desenho](features/whiteboard-editor.md)
   - [Colaboração & Tempo Real](features/collaboration-realtime.md)
   - [Pastas, Organização & Lixeira](features/folders-and-organization.md)
   - [Histórico de Versões & Restauração](features/version-history.md)
   - [Internacionalização (i18n)](features/i18n.md)
   - [Bibliotecas de Componentes](features/libraries.md)
   - [Imagens & Otimização de Mídia](features/media-and-images.md)
   - [Busca Global em Texto do Canvas](features/search.md)
3. **API REST Pública (`/api/v1`)**:
   - [Visão Geral da API](api/overview.md)
   - [Primeiros Passos com a API (API Quick Start)](api/getting-started.md)
   - [Autenticação & Escopos de Chaves](api/authentication.md)
   - [Paginação de Resultados](api/pagination.md)
   - [Taxas & Limites Operacionais](api/rate-limiting.md)
   - [Tratamento de Erros](api/error-handling.md)
   - [Esquema de Conteúdo da Cena (Element Spec)](api/scene-content-schema.md)
   - [Referência Completa de Endpoints](api/endpoints.md)
4. **Servidor MCP (Model Context Protocol)**:
   - [Visão Geral do MCP](mcp/overview.md)
   - [Configurando Agentes (Claude Code, Desktop, Cursor)](mcp/getting-started.md)
   - [Autenticação & Permissões MCP](mcp/auth-and-permissions.md)
   - [Catálogo Completo das 13 Ferramentas MCP](mcp/tools.md)
   - [Motor de Layout Automático de Diagramas](mcp/diagram-layout.md)
5. **Descoberta por Agentes & Modelos de Linguagem**:
   - [Índice Resumido para LLMs (`llms.txt`)](llms.txt)
   - [Dump de Texto Completo para LLMs (`llms-full.txt`)](llms-full.txt)
