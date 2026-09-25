# Compliance e controles de segurança (SOC 2)

Esta pasta reúne as políticas e os procedimentos do heeey.click, organizados pelos
**Trust Services Criteria** do SOC 2 (Security, Availability, Confidentiality e Privacy).
Ela não é publicada no site: fica só no repositório.

> SOC 2 Type 2 é um relatório de auditoria independente que prova que estes controles
> **funcionaram durante um período** (3 a 12 meses). Por isso, cada controle abaixo diz
> onde está a **evidência** que um auditor pediria.

## Políticas

| Documento | Assunto |
|---|---|
| [information-security-policy.md](information-security-policy.md) | Política geral, papéis, classificação de dados, revisão anual |
| [access-control.md](access-control.md) | MFA, menor privilégio, segredos, revisão trimestral de acessos |
| [change-management.md](change-management.md) | PRs, revisão, CI, migrations, deploy e rollback |
| [incident-response.md](incident-response.md) | Severidades, resposta, comunicação e post-mortem |
| [data-management.md](data-management.md) | Retenção, exclusão, backup e recuperação |
| [vendors.md](vendors.md) | Subprocessadores e revisão anual dos relatórios SOC 2 deles |
| [../SECURITY.md](../SECURITY.md) | Como reportar vulnerabilidades |

## Matriz de controles

Legenda: ✅ implementado no código/repositório · ⚙️ configuração manual (ver pendências) · 📋 processo recorrente

| # | Controle | Critério | Status | Evidência |
|---|---|---|---|---|
| C1 | CI obrigatório (build, tipos, testes, `npm audit`) em todo PR | CC8.1 | ✅ | `.github/workflows/ci.yml`, execuções no GitHub Actions |
| C2 | Branch `main` protegida: PR + revisão + CI verde | CC8.1 | ✅ | Branch protection (`compliance/branch-protection.json`), ativa desde 2026-09-24 |
| C3 | Code owners revisam toda mudança | CC8.1 | ✅ | `.github/CODEOWNERS`, aprovações nos PRs |
| C4 | Checklist de segurança no PR | CC8.1 | ✅ | `.github/pull_request_template.md` |
| C5 | Mudanças de banco versionadas e testadas (PGlite) | CC8.1 | ✅ | `supabase/migrations/`, `supabase/tests/` |
| C6 | Row Level Security em todas as tabelas expostas | CC6.1 | ✅ | Migrations + testes em `database.test.ts` |
| C7 | Canais Realtime privados; só editores alteram a cena | CC6.1 | ✅ | `20260925120000_realtime_channel_authorization.sql` |
| C8 | Chaves de API com hash, escopo e revogação | CC6.1 | ✅ | `20260923180000_api_keys.sql` |
| C9 | Trilha de auditoria somente inserção (quadros e chaves de API) | CC7.2 | ✅ | Tabela `public.audit_log` |
| C10 | Retenção: lixeira 30 dias, auditoria 1 ano, expurgo diário | P4.2 / C1.2 | ✅ ⚙️ | `purge_expired_data()`, `api/cron/purge.ts`, logs do Vercel Cron |
| C11 | Atualização de dependências e alertas de vulnerabilidade | CC7.1 | ✅ ⚙️ | `.github/dependabot.yml`, PRs do Dependabot |
| C12 | Secret scanning + push protection | CC6.1 | ✅ | Já ativo no repositório |
| C13 | Cabeçalhos de segurança HTTP (HSTS, nosniff, etc.) | CC6.7 | ✅ | `vercel.json` |
| C14 | MFA em GitHub, Supabase, Vercel, PostHog, domínio e e-mail | CC6.1 | ⚙️ 📋 | Prints das telas de membros com MFA |
| C15 | Revisão trimestral de acessos | CC6.2 / CC6.3 | 📋 | `compliance/access-reviews/AAAA-QN.md` |
| C16 | Backups com PITR e teste anual de restauração | A1.2 / A1.3 | ⚙️ 📋 | Plano Supabase + registro do teste |
| C17 | Monitoramento de disponibilidade e erros, com status page pública | CC7.2 / A1.1 / CC2.3 | ✅ ⚙️ | `/api/health` + Upptime a cada 5 min ([status.heeey.click](https://status.heeey.click), repo `carloseorsantos/status`) + PostHog error tracking |
| C18 | Resposta a incidentes com post-mortem | CC7.3–CC7.5 | 📋 | Issues com o rótulo `incident` |
| C19 | Revisão anual dos fornecedores | CC9.2 | 📋 | Registro em `vendors.md` |
| C20 | Política de privacidade e termos publicados | P1.1 | ✅ | `/privacidade`, `/termos` (pt, en, es) |
| C21 | Divulgação responsável de vulnerabilidades | CC2.3 | ✅ ⚙️ | `SECURITY.md` + private vulnerability reporting |

## Pendências manuais (fora do código)

Já feitos em 2026-09-24: branch protection na `main`, `CRON_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` na
Vercel, e a migration `20260926120000_audit_log_and_retention.sql` aplicada em produção.

Coisas que precisam ser feitas por quem administra as contas:

1. **Dependabot security updates** e **private vulnerability reporting** (C11, C21):
   GitHub → Settings → Code security.
2. **MFA obrigatório** em todas as contas (C14).
3. **Supabase**: avaliar o plano Pro com PITR (C16).
4. **Status page** (C17): no repo `carloseorsantos/status`, criar o secret `GH_PAT` (token fine-grained só
   desse repo, com Contents, Issues, Actions e Workflows em leitura e escrita) e rodar o workflow *Setup CI*;
   depois, no DNS, o CNAME `status` → `carloseorsantos.github.io`.
5. Primeira **revisão de acessos** e primeiro **teste de restauração** (C15, C16).

## Calendário de controles recorrentes

| Frequência | Atividade | Registro |
|---|---|---|
| Contínuo | Revisão de PRs, CI, Dependabot | GitHub |
| Diário | Expurgo de retenção | Logs do Vercel Cron |
| Trimestral | Revisão de acessos | `compliance/access-reviews/` |
| Anual | Revisão das políticas, fornecedores, teste de restauração, pentest | Commit nesta pasta |

## Consultas úteis para evidências

```sql
-- Eventos de segurança dos últimos 90 dias
select occurred_at, actor_id, action, entity, entity_id, details
from public.audit_log
where occurred_at > now() - interval '90 days'
order by occurred_at desc;

-- Quem mudou o nível de acesso de quadros
select * from public.audit_log where action = 'board.access_changed' order by occurred_at desc;
```
