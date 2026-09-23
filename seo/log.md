# SEO log

Append-only. Newest entry at the bottom. Never delete or rewrite past entries.

<!--
## YYYY-MM-DD — <run type: setup | page pick | checkup | ship | weekly>
- Page / query:
- Data pulled: (date range, sources)
- Compared to baseline: search side … / business side …
- Days since last change went live:
- Verdict: win | miss | too early | n/a
- Recommendation (one):
- Approved? yes/no — by whom
- Changed live: (exact diff / what moved) on YYYY-MM-DD
- Sources: <urls>
- Missing data:
-->

## 2026-09-23 — setup (diagnóstico inicial)
- Page / query: n/a (nenhuma página escolhida ainda)
- Data pulled: nenhum — Search Console, analytics e DataForSEO não conectados
- Findings (fonte: código do repo):
  - Sem analytics nem evento de conversão nomeado (nenhuma referência a PostHog/GA/Plausible/Vercel Analytics em src/ ou index.html)
  - `/` é o dashboard do app, não há landing page para visitante deslogado (src/App.tsx)
  - SPA Vite: todas as rotas servem o mesmo index.html com um único <title>/<meta description> (vercel.json, index.html) — /docs/* não tem HTML próprio para o Google
  - Sem robots.txt nem sitemap.xml em public/
  - Signup é magic link via Supabase (src/hooks/useAuth.tsx) — candidato natural a evento de conversão
- Verdict: n/a — fase 0/1: resolver conversão e rastreamento antes de qualquer SEO
- Recommendation (one): definir e instrumentar o evento de conversão
- Approved? pendente
- Missing data: todos os dados de busca e de negócio

## 2026-09-23 — ship (passo 1: evento de conversão)
- Change drafted (local, não publicado): posthog-js carregado sob demanda só se VITE_POSTHOG_KEY existir; `signup_completed` {method: magic_link} disparado em SIGNED_IN quando a conta tem < 10 min, uma vez por conta; identify só por user.id; pageviews por history_change; sem autocapture, sem session recording
- Files: src/lib/analytics.ts, src/hooks/useAuth.tsx, src/main.tsx, .env.example, src/__tests__/analytics.test.ts
- Verified: testes passam; build sem chave não inclui o SDK
- Approved? pendente — aguardando chave do PostHog e teste local
- Changed live: não

## 2026-09-23 — ship (passo 1: verificação local)
- Verified (dev-offline-seo, :5176, Supabase desligado): posthog-js carrega com a chave do .env, $pageview enviado para us.i.posthog.com/i/v0/e/ na navegação SPA (/ → /docs), sem erros no console
- Adjusted: disable_surveys: true (surveys.js deixou de carregar)
- Not verified: `signup_completed` — exige magic link real no Supabase de produção
- Note: alguns $pageview de localhost:5176 foram para o projeto PostHog (filtrar por $host)
- Changed live: não

## 2026-09-23 — setup (passo 2: rastreabilidade + Search Console)
- Found: https://www.heeey.click/robots.txt e /sitemap.xml devolviam o index.html (200 text/html) por causa do rewrite da SPA em vercel.json
- Change drafted: public/robots.txt (Disallow /b/ e /api/, aponta sitemap) + public/sitemap.xml (home + 25 páginas de docs, host canônico www) + teste que impede o sitemap de divergir de DOC_ITEMS
- Verified: dev server serve text/plain e text/xml; sitemap válido (xmllint)
- Note: apex heeey.click → 308 → www funciona; falha só no DNS do provedor local (8.8.8.8 e 1.1.1.1 resolvem)
- Pending (usuário): propriedade de Domínio no Search Console via TXT no Vercel DNS; enviar sitemap após deploy
- Changed live: não

## 2026-09-23 — ship (passo 3: landing pages)
- Verified live: robots.txt 200 text/plain, sitemap.xml 200 application/xml em https://www.heeey.click
- Intent check (WebSearch 2026-09-23):
  - "lousa online colaborativa grátis" → páginas de produto (miro.com/whiteboard, lucid.co/pt/lucidspark, lousa.digital) + listas (capterra.com.br). Página de produto em PT se encaixa.
  - "whiteboard MCP server Claude draw diagrams" → repos GitHub de servidores locais (kamiazya/whiteboard, convict-git/excalidraw-whiteboard-mcp) + whiteboard-mcp.com (local, US$29). Diferencial do heeey: hospedado, multiplayer, persistente, grátis.
- Competitors read in full: lousa.digital (grátis, sem anúncios, sem coleta de dados, código de acesso); whiteboard-mcp.com (local, npx, auto-layout, licença paga)
- Change drafted: /lousa-online (PT) e /whiteboard-mcp (EN) como HTML estático (Vite multi-page) com title/description/canonical próprios, H2 em forma de pergunta com resposta na primeira linha, FAQ; CTA → /?settings=account (deep link novo que abre Configurações → Conta); pageview via PostHog; sitemap atualizado
- Claims checados contra docs/código: colaboração/permissões (docs/features/collaboration-realtime.md), convidado + herança de quadros (docs/getting-started.md), 13 ferramentas MCP (src/server), broadcast de mudanças da API (supabase/migrations/20260923190000_public_api.sql + teste), escopos e revogação de chaves (docs/mcp/auth-and-permissions.md, ApiKeysPanel)
- Schema: não adicionado (sem rich result aplicável; não é atalho de AEO)
- Verified: dev offline — desktop/mobile/light/dark, sem scroll horizontal, deep link abre Conta e limpa a URL, $pageview enviado; 160 testes; build gera dist/lousa-online e dist/whiteboard-mcp com o conteúdo no HTML (2,8 KB de JS)
- Approved? pendente — revisão de copy pelo usuário
- Changed live: não
