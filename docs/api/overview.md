# Visão Geral da API REST v1

A API pública do **Heeey** (`/api/v1`) permite criar, ler, atualizar, mover e buscar quadros e pastas de maneira programática.

A API foi projetada para ser leve, amigável para desenvolvedores e agentes autônomos, e executada diretamente em arquitetura de borda (*Edge Runtime* no Vercel).

---

## 🌐 Informações de Integração

- **URL Base de Produção**: `https://heeey.click/api/v1`
- **Ambiente Local**: `http://localhost:5173/api/v1`
- **Padrão de Troca de Dados**: JSON UTF-8
- **Autenticação**: Bearer Token via cabeçalho HTTP `Authorization`
- **CORS**: Habilitado para todos os domínios (`*`), suportando requisições diretas de ferramentas baseadas em navegador, webhooks e CLIs.

---

## ⚡ Princípios de Design da API

1. **Segurança no Banco (Zero-Secrets na Edge)**:
   - A função de borda (`apiHandler.ts`) não armazena chaves mestras ou segredos de superusuário.
   - Toda requisição é autenticada diretamente no PostgreSQL via hash criptográfico SHA-256 (`api_authenticate`). O contexto do usuário (`auth.uid()`) é aplicado no nível da transação, garantindo que as políticas de Row Level Security (RLS) protejam cada operação.
2. **Atualização em Tempo Real (Live Broadcast)**:
   - Sempre que você altera ou adiciona elementos a um quadro via `POST` ou `PATCH`, o servidor dispara uma mensagem de broadcast Supabase Realtime no canal `heeey:room:{boardId}`.
   - Qualquer pessoa com o quadro aberto no navegador verá os novos elementos surgirem ao vivo em sua tela sem precisar recarregar a página!
3. **Links Prontos para Uso (`url`)**:
   - Todas as respostas de quadros incluem a propriedade `url` formatada (ex.: `https://heeey.click/b/550e8400-e29b-41d4-a716-446655440000`), facilitando que scripts e bots entreguem o link direto para o usuário final.
4. **Formato Resumido de Elementos (Element Skeleton)**:
   - Você não precisa montar objetos gigantescos com dezenas de propriedades internas do Excalidraw. A API aceita especificações enxutas (`label`, `shape`, `start`, `end`) e gera os elementos completos automaticamente.

---

## 🧭 Sumário de Recursos da API

| Recurso | Método | Rota | Descrição |
|---|---|---|---|
| **Índice da API** | `GET` | `/api/v1` | Retorna o catálogo de rotas e formatos aceitos. |
| **Quadros** | `GET` | `/api/v1/boards` | Lista quadros do usuário (com paginação e filtro por pasta). |
| **Criar Quadro** | `POST` | `/api/v1/boards` | Cria um novo quadro com ou sem elementos iniciais. |
| **Obter Quadro** | `GET` | `/api/v1/boards/:id` | Retorna metadados e todos os elementos da cena. |
| **Atualizar Quadro** | `PATCH` | `/api/v1/boards/:id` | Atualiza título, adiciona/modifica elementos ou deleta por ID. |
| **Lixeira** | `DELETE` | `/api/v1/boards/:id` | Move o quadro para a lixeira (*soft delete*). |
| **Mover Quadro** | `POST` | `/api/v1/boards/:id/move` | Aloca o quadro em uma pasta (ou na raiz com `null`). |
| **Busca Global** | `GET` | `/api/v1/search?q=` | Busca full-text em títulos e no texto desenhado nas lousas. |
| **Listar Pastas** | `GET` | `/api/v1/folders` | Lista todas as pastas do usuário. |
| **Criar Pasta** | `POST` | `/api/v1/folders` | Cria uma pasta na raiz ou dentro de outra pasta. |
