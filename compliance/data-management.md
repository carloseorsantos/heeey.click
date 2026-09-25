# Gestão de Dados: Retenção, Exclusão, Backup e Recuperação

**Revisão:** anual · **Teste de restauração:** anual

## 1. Inventário e retenção

| Dado | Onde | Retenção | Como é apagado |
|---|---|---|---|
| Quadros ativos | `public.boards` | Enquanto o time existir | Por quem administra o quadro (lixeira → exclusão definitiva) |
| Quadros na lixeira | `public.boards` (`deleted_at`) | **30 dias** | Expurgo diário automático |
| Imagens dos quadros | Storage `board-media/{board_id}/` | Igual ao quadro | Junto com o quadro (app ou expurgo diário) |
| Histórico de versões | `public.board_versions` | 30 versões / 30 dias por quadro | Automático, e em cascata com o quadro |
| Times, membros e projetos | `public.teams`, `team_members`, `projects`, `project_members` | Enquanto o time existir | Pelo owner (time vazio); o time pessoal some com a conta |
| Convites de time | `public.team_invites` (só o hash do token) | 7 dias de validade; ficam até o time ser excluído | Em cascata com o time |
| Convites em quadros | `public.board_members` (e-mail convidado) | Enquanto o quadro existir | Por quem compartilha, pela própria pessoa, ou em cascata com o quadro |
| Pastas | `public.folders` | Enquanto o projeto existir | Em cascata com o projeto |
| Biblioteca pessoal | `public.user_libraries` | Enquanto a conta existir | Em cascata com a conta |
| Chaves de API | `public.api_keys` (só o hash), `api_key_teams` | Enquanto a conta existir | Em cascata com a conta |
| Trilha de auditoria | `public.audit_log` | **1 ano** | Expurgo diário automático |
| Contas (e-mail) | Supabase Auth | Até o pedido de exclusão | Manual, em até 30 dias do pedido |
| Métricas de uso | PostHog, Vercel Analytics | Conforme o plano do fornecedor | No fornecedor |

## 2. Expurgo automático

- `public.purge_expired_data()` apaga quadros há mais de 30 dias na lixeira e eventos de auditoria com mais de 1 ano. Cada quadro apagado gera um evento `board.purged`.
- O **Vercel Cron** chama `GET /api/cron/purge` todo dia às 03:17 UTC (`vercel.json`). O endpoint exige `Authorization: Bearer $CRON_SECRET`, roda a função com a `service_role` e apaga as imagens dos quadros expurgados pela API do Storage.
- O mesmo cron roda `public.apply_scheduled_link_restrictions()`, que restringe os links abertos cujo aviso de 30 dias venceu (migração dos times). Cada restrição gera `board.link_restricted`.
- Evidência: logs do cron na Vercel (resposta com `boards_purged`, `audit_events_purged`, `links_restricted` e `media_errors`) e eventos `board.purged` e `board.link_restricted` em `audit_log`.

## 3. Pedidos de titulares (LGPD/GDPR)

1. O pedido chega em `contato@heeey.click` e é registrado com data.
2. Confirmar a identidade (o pedido deve vir do e-mail da conta).
3. **Acesso/portabilidade**: exportar os quadros da pessoa em JSON do Excalidraw.
4. **Exclusão**: antes, apagar as imagens (`board-media/{board_id}/`) dos quadros do **time pessoal** da pessoa, que o banco apaga junto com o time. Depois, excluir o usuário no Supabase Auth: time pessoal, projetos, pastas, bibliotecas, chaves e convites apagam em cascata. Nos times com outras pessoas, os quadros continuam (o criador vira `null`) e, se ela era a única owner, a posse passa para um admin ou para o membro mais antigo. Convites pendentes para o e-mail dela (`board_members` sem `user_id`) devem ser removidos à parte.
5. Responder em até 15 dias e concluir a exclusão em até 30 dias.

## 4. Backup

- O Supabase faz backups diários automáticos do Postgres (retidos por 7 dias no plano Pro).
- **Recomendado**: plano Pro com **PITR** (Point-in-Time Recovery), para recuperar até minutos antes de um incidente.
- O Storage (imagens) não entra nos backups do banco. O risco é aceito: as imagens também ficam dentro do JSON do quadro quando ele é exportado. Reavaliar se imagens passarem a ser críticas.
- O código e as migrations estão no GitHub, e `supabase/schema.sql` + `supabase/migrations/` recriam o schema do zero.

## 5. Teste anual de restauração

1. Restaurar o backup mais recente num **projeto Supabase separado** (nunca por cima de produção).
2. Aplicar as migrations e conferir: contagem de quadros, um quadro aberto pelo app apontando para o projeto de teste, políticas RLS presentes.
3. Registrar data, duração (RTO obtido), idade do backup (RPO obtido) e problemas em `compliance/restore-tests/AAAA.md`.
4. Apagar o projeto de teste.

Metas: **RPO** 24 h (backup diário) ou minutos com PITR · **RTO** 4 h.

## 6. Continuidade

| Falha | Plano |
|---|---|
| Vercel fora do ar | Aguardar; o app já guarda cópias locais para uso offline. Se prolongado, publicar `dist/` em outro host estático |
| Supabase fora do ar | Aguardar; usuários mantêm cópias locais. Comunicar no site |
| Perda do projeto Supabase | Criar projeto novo, `schema.sql` + migrations, restaurar backup, atualizar variáveis na Vercel |
| Perda de acesso ao GitHub | Clones locais têm o histórico completo; recriar o repositório |
