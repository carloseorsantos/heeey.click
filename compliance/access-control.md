# Controle de Acesso

**Revisão:** anual · **Revisão de acessos:** trimestral

## 1. Contas administrativas

| Sistema | Quem tem acesso | Exigências |
|---|---|---|
| GitHub (repositório) | Mantenedores (admin/escrita), contribuidores (apenas via PR) | MFA obrigatório; admins só o necessário |
| Supabase (projeto de produção) | Responsável de segurança | MFA; acesso ao SQL Editor só para migrations e incidentes |
| Vercel (projeto heeey.click) | Responsável de segurança | MFA; variáveis de produção marcadas como *Sensitive* |
| PostHog | Mantenedores | MFA |
| Registro de domínio / DNS | Responsável de segurança | MFA + bloqueio de transferência |
| E-mail `contato@heeey.click` | Responsável de segurança | MFA |

## 2. Concessão e revogação

- Acesso é concedido por pedido registrado (issue ou mensagem arquivada) e aprovado pelo responsável de segurança.
- Ao sair do projeto, todos os acessos são revogados **em até 1 dia útil**, e segredos que a pessoa conhecia são rotacionados.

## 3. Segredos

| Segredo | Onde fica | Rotação |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (produção, *Sensitive*) | Anual, ou na saída de alguém com acesso, ou se houver suspeita de vazamento |
| `CRON_SECRET` | Vercel (produção, *Sensitive*) | Anual |
| `AI_GATEWAY_API_KEY` | Vercel | Anual |
| Chaves de API de usuários | Banco (apenas hash SHA-256) | O próprio usuário revoga; criação e revogação vão para `audit_log` |

A chave anon/publishable do Supabase é pública por natureza; a proteção dos dados é o RLS.
O secret scanning com push protection do GitHub bloqueia commits com segredos conhecidos.

## 4. Acesso dos usuários do produto

- Leitura de um quadro: dono ou quem tem o link (cabeçalho `x-board-id`); nunca listagem pública.
- Escrita: dono, ou qualquer pessoa com o link se o quadro estiver como editável.
- Alterar o acesso, mover para a lixeira ou excluir: só o dono. Esses eventos vão para `audit_log`.
- Tudo é garantido por RLS e testado em `supabase/tests/database.test.ts`.

## 5. Revisão trimestral de acessos

No início de cada trimestre, crie `compliance/access-reviews/AAAA-QN.md` a partir do modelo abaixo
e abra um PR. O PR mesclado é a evidência.

```markdown
# Revisão de acessos — AAAA-QN

Data: AAAA-MM-DD · Revisor: nome

| Sistema | Pessoa | Nível | MFA | Ainda necessário? | Ação |
|---|---|---|---|---|---|
| GitHub | @usuario | admin | sim | sim | — |
| Supabase | ... | owner | sim | sim | — |
| Vercel | ... | owner | sim | sim | — |
| PostHog | ... | admin | sim | sim | — |

Chaves e segredos rotacionados neste trimestre: ...
Pessoas que registraram ciência das políticas: ...
Observações: ...
```
