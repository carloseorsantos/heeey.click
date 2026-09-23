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
