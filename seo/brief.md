# SEO brief

## Business
heeey.click is a collaborative, real-time whiteboard built on Excalidraw + Supabase. Open source. Also exposes an MCP server and REST API so AI agents (Claude, ChatGPT, etc.) can create and edit boards and diagrams.

## Offer
Free whiteboard: use as guest instantly, sign in (magic link) to keep boards, folders, search, version history and API/MCP keys.

## Buyer
Two audiences, one page each (don't mix them on the same page):
1. **Whiteboard seekers (PT-BR)** — want an online whiteboard / "lousa online" / "quadro branco colaborativo" to sketch or teach with others, free, no install. Competes with Miro, Excalidraw, tldraw.
2. **Devs with AI agents** — want their agent to draw diagrams on a shared canvas ("whiteboard MCP", "Claude draw diagram", "Excalidraw MCP"). Small niche, low competition.

## Conversion
- Event name in analytics: `signup_completed` (fires once, when a magic-link login creates/first authenticates an account)
- Tool: PostHog (to be installed)
- What counts: signup via magic link
- Secondary (diagnostic only, not a conversion): `board_created`, `api_key_created`

## Money pages
- https://www.heeey.click/ — audience 1 (PT-BR). Target: "lousa online colaborativa", "quadro branco online grátis". CTA: /app?settings=account
- https://www.heeey.click/mcp — audience 2 (EN). Target: "whiteboard MCP server", "Excalidraw MCP". CTA: /app?settings=account (then API key)
- App lives at /app (noindex via robots); boards stay at /b/:id; docs at /docs

## Brand guardrails
<!-- Things we never say, tone, claims we can't make. -->

## Connected tools
- [ ] Google Search Console (property: heeey.click) — required, free
- [ ] PostHog — conversions
- [ ] DataForSEO — later, only if manual SERP checks aren't enough
- [ ] Firecrawl — later; WebFetch/browser covers competitor reading for now
- [ ] Web search — built-in
- [ ] PageSpeed Insights API — free
- [ ] Ahrefs — not planned
- [ ] Bing Webmaster Tools — free, AI Performance report
- [ ] CMS / repo (draft only) — this repo, Vercel deploy
