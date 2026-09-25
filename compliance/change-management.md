# Gestão de Mudanças

**Revisão:** anual

## 1. Fluxo

1. Toda mudança nasce numa branch (`feat/*`, `fix/*`, `chore/*`) e chega à `main` **somente por Pull Request**.
2. O PR usa o [template](../.github/pull_request_template.md) com o checklist de segurança.
3. O **CI** (`.github/workflows/ci.yml`) precisa passar:
   - `npm audit --audit-level=high` (sem vulnerabilidades altas ou críticas);
   - `npm run build` (checagem de tipos + build);
   - `npm test` (testes unitários e de banco em PGlite, com todas as migrations aplicadas duas vezes).
4. Pelo menos **1 aprovação** de outra pessoa, preferencialmente um code owner ([CODEOWNERS](../.github/CODEOWNERS)).
   Quem escreve o código não aprova o próprio PR.
5. Merge na `main` → a Vercel faz o deploy de produção automaticamente. Não há deploy manual fora desse fluxo.

## 2. Mudanças de banco

- Toda alteração de schema, RLS ou função é uma migration nova em `supabase/migrations/`, re-executável
  (`if not exists`, `create or replace`, `drop ... if exists`).
- Testes em `supabase/tests/` cobrem as regras de acesso novas.
- As migrations são aplicadas no Supabase **antes** do deploy do código que depende delas.

## 3. Mudanças emergenciais

Em um incidente, o responsável de segurança pode mesclar sem aprovação prévia (bypass de admin).
Nesse caso, o PR recebe o rótulo `emergency-change` e uma revisão posterior é feita em até 2 dias úteis.

## 4. Rollback

- Código: *Instant Rollback* da Vercel para o deploy anterior, seguido de um PR de revert.
- Banco: migration nova que desfaz a anterior (não editar migrations já aplicadas).

## 5. Dependências

O Dependabot abre PRs semanais (npm) e mensais (GitHub Actions). Eles passam pelo mesmo fluxo.
Vulnerabilidades altas bloqueiam o CI. Se não houver versão corrigida, usamos `overrides` no
`package.json` ou registramos uma exceção ([information-security-policy.md](information-security-policy.md#8-exceções)).

## Configuração da branch `main`

Feita por um admin do repositório (GitHub → Settings → Branches, ou pelo `gh`):

```bash
gh api -X PUT repos/carloseorsantos/heeey.click/branches/main/protection --input compliance/branch-protection.json
```

Com isso: PR obrigatório, 1 aprovação, aprovações descartadas quando há commits novos, check `ci`
obrigatório, conversas resolvidas e sem force-push ou exclusão da `main`. `enforce_admins` fica
desligado para permitir mudanças emergenciais (seção 3).
