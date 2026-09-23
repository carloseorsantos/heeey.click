# Busca Global em Texto do Canvas

O Heeey conta com um sistema de busca rápida em texto completo (*full-text search*) que localiza quadros não apenas pelo título, mas por **qualquer texto ou rótulo escrito dentro do canvas**.

---

## 🔍 Como Funciona a Busca

A busca pode ser acionada:
- No **Dashboard**: pela barra de busca superior ou atalho.
- Dentro de um **Quadro**: pelo modal de busca de quadros (`BoardSearchModal`), permitindo alternar de lousa sem voltar ao painel inicial.

---

## 🧠 Características Técnicas da Busca

1. **Insensível a Acentos & Caixa Alta/Baixa**:
   - Graças à extensão PostgreSQL `unaccent` e normalização NFD, buscar por `reuniao`, `Reunião`, `REUNIÃO` ou `reunião` trará os mesmos resultados com precisão total.
2. **Indexação Automática de Texto do Canvas (`tsvector` & GIN)**:
   - Toda vez que um quadro é salvo, um gatilho de banco extrai todos os elementos de tipo `text` (incluindo rótulos internos de formas e setas).
   - O título recebe peso **A** (maior relevância) e o conteúdo dos elementos recebe peso **B**.
   - Um índice GIN (`idx_boards_search`) garante respostas em milissegundos mesmo em bases volumosas.
3. **Busca Local & Remota**:
   - **Remota**: Usuários conectados pesquisam remotamente através da função RPC `search_boards`.
   - **Local**: Convidados pesquisam nos quadros salvos no cache do navegador através da função `searchLoadedBoards`.
4. **Trechos de Pré-Visualização (Snippets com Destaque)**:
   - O resultado da busca não exibe apenas o nome do quadro: ele recorta um trecho contextual de até 40 caracteres ao redor da primeira palavra encontrada, preservando a acentuação original e destacando o termo correspondente.
5. **Busca Semântica com Jev (Vercel AI Gateway)**:
   - Quando a busca por palavras traz menos de 3 resultados, o app chama `POST /api/ai-search` para achar quadros **relacionados pelo significado** (ex.: `planejamento Q3` encontra "Roadmap julho–setembro"). Esses resultados aparecem com o rótulo **Relacionado**.
   - A função lê até 40 quadros recentes do usuário pela RPC `search_candidates` (título + 600 caracteres do canvas, com a sessão do próprio usuário) e faz **uma única** chamada ao modelo `typesafe-ai/jev` no endpoint `/v1/evaluate` do AI Gateway, com uma pergunta booleana por quadro. Entram os quadros com probabilidade acima de 0,5, até 8 resultados.
   - Retenção zero de dados: defina `AI_GATEWAY_ZDR=true` para o gateway recusar provedores que guardam dados. Exige plano Pro ou Enterprise da Vercel; no Hobby, ligar isso faz toda chamada falhar com 403.
   - **Credenciais**: em produção a função usa o token OIDC do projeto na Vercel (sem chave). Localmente, rode `vercel link` e `vercel env pull` (o token OIDC vale 12 h) ou defina `AI_GATEWAY_API_KEY`. Sem credencial, a busca semântica é desligada em silêncio e a busca por palavras segue normal.
   - O `vite dev` não serve as funções de `api/`; para testar localmente use `vercel dev`.
