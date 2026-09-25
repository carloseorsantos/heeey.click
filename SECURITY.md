# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

- Preferred: [report it privately on GitHub](https://github.com/carloseorsantos/heeey.click/security/advisories/new).
- Or email **contato@heeey.click** with "SECURITY" in the subject.

Include what you found, steps to reproduce and the impact you expect. We will acknowledge your
report within **3 business days**, keep you updated, and credit you in the fix unless you prefer
otherwise. Please give us a reasonable time to fix the issue before disclosing it.

## Scope

- https://heeey.click (web app, `/api/v1`, `/mcp`)
- This repository (including Supabase migrations and RLS policies)

Out of scope: denial of service, spam, social engineering, and findings in third-party services
(Supabase, Vercel, PostHog) — report those to the vendor.

## Supported versions

Only the current production deployment (the `main` branch) receives security fixes.

---

Nossas políticas de segurança e compliance estão em [`compliance/`](compliance/README.md).
