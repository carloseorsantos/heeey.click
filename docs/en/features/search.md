# Global Search in Canvas Text

Heeey has a fast full-text search that finds boards not only by title but by **any text or label written on the canvas**.

---

## 🔍 How Search Works

You can search:
- On the **dashboard**: from the top search bar or with the shortcut.
- Inside a **board**: from the board search dialog (`BoardSearchModal`), to switch whiteboards without going back to the dashboard.

---

## 🧠 Technical Details

1. **Accent- and case-insensitive**:
   - Thanks to the PostgreSQL `unaccent` extension and NFD normalization, searching for `reuniao`, `Reunião`, `REUNIÃO` or `reunião` returns exactly the same results.
2. **Automatic canvas text indexing (`tsvector` & GIN)**:
   - Every time a board is saved, a database trigger extracts all `text` elements (including labels inside shapes and on arrows).
   - The title gets weight **A** (highest relevance) and element content gets weight **B**.
   - A GIN index (`idx_boards_search`) answers in milliseconds even on large datasets.
3. **Local & remote search**:
   - **Remote**: Signed-in users search remotely through the `search_boards` RPC function.
   - **Local**: Guests search the boards saved in the browser cache through the `searchLoadedBoards` function.
4. **Preview snippets with highlighting**:
   - Results don't just show the board name: they cut a contextual snippet of up to 40 characters around the first match, keeping the original accents and highlighting the matching term.
5. **Semantic search with Jev (Vercel AI Gateway)**:
   - When keyword search returns fewer than 3 results, the app calls `POST /api/ai-search` to find boards **related by meaning** (e.g. `Q3 planning` finds "July–September roadmap"). These results appear with the **Related** label.
   - The function reads up to 40 of the user's recent boards through the `search_candidates` RPC (title + 600 characters of canvas text, with the user's own session) and makes **a single** call to the `typesafe-ai/jev` model on the AI Gateway `/v1/evaluate` endpoint, with one yes/no question per board. Boards with a probability above 0.5 are included, up to 8 results.
   - Zero data retention: set `AI_GATEWAY_ZDR=true` so the gateway refuses providers that keep data. It requires a Vercel Pro or Enterprise plan; on Hobby, turning it on makes every call fail with a 403.
   - **Credentials**: In production the function uses the Vercel project's OIDC token (no key). Locally, run `vercel link` and `vercel env pull` (the OIDC token lasts 12 h) or set `AI_GATEWAY_API_KEY`. Without credentials, semantic search is silently turned off and keyword search keeps working as usual.
   - `vite dev` doesn't serve the functions in `api/`; to test locally, use `vercel dev`.
