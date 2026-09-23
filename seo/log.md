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
