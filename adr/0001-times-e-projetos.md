# ADR-0001: Times (workspaces) e projetos

**Status:** Aceito
**Data:** 2026-09-24
**Decisor:** Carlos Santos

## Contexto

Hoje a posse é por usuário: `boards.owner_id` e `folders.owner_id`. Essa regra aparece em vários pontos do banco:

- **RLS e triggers:** `handle_board_update`, `check_board_folder` e `check_folder_parent`.
- **Permissões:** `board_permission()` (usada no Storage e no histórico) e `realtime_can_edit_board()`.
- **API pública e MCP:** `api_own_board()` e as demais funções `api_*`.
- **Busca:** `search_boards()` e `search_candidates()`.
- **Outros:** `audit_board_change()`, a retenção e `user_libraries`.

Há ainda dois jeitos de compartilhar um quadro, e os dois precisam continuar funcionando:

- **Por link:** `access_level` junto com o cabeçalho `x-board-id`.
- **Quadros anônimos:** `owner_id null`, que alguém pode reivindicar depois.

Queremos que cada usuário participe de um ou mais times, e que cada time tenha um ou mais projetos. Todo usuário novo ganha automaticamente seu time pessoal, como no Excalidraw+, no Vercel e no Supabase.

## Decisão

A hierarquia fica: **Usuário ↔ (N:N) Time → Projeto → Pastas → Quadros**.

```
teams            (id, name, slug unique, is_personal, created_by, created_at)
team_members     (team_id, user_id, role owner|admin|member|viewer, PK(team_id, user_id))
team_invites     (id, team_id, role, token_hash, invited_by, expires_at, accepted_at, revoked_at)
projects         (id, team_id, name, visibility team|private, created_by, archived_at)
project_members  (project_id, user_id, role edit|view, PK(project_id, user_id))
folders          + team_id, project_id   (owner_id passa a significar "quem criou")
boards           + team_id, project_id   (owner_id passa a significar "quem criou", on delete set null)
                 + restrict_link_at timestamptz null   -- migração agendada para restrito
                 access_level: restricted|view|edit   -- "Acesso geral" (restricted é novo)
board_members    (board_id, user_id null, email, role view|edit, invited_by, created_at,
                  unique(board_id, user_id), unique(board_id, lower(email)))
teams            + editors_can_share boolean default true   -- engrenagem do modal
api_key_teams    (api_key_id, team_id)   -- times que a chave pode acessar
```

### Regras

1. **Time pessoal.** Um trigger em `auth.users` cria o time com `is_personal = true`, com o usuário como `owner` e um projeto padrão. Esse time aceita convidados como qualquer outro, mas não pode ser excluído nem abandonado pelo dono.
2. **Papéis no time:**
   - `owner` e `admin`: gerenciam membros e projetos.
   - `member`: edita.
   - `viewer`: só lê.
3. **Projetos:**
   - **Visibilidade `team` (padrão):** todo membro do time acessa o projeto, com a permissão do seu papel no time.
   - **Visibilidade `private`:** só entra quem está em `project_members`.
   - Owner e admin do time veem sempre todos os projetos, inclusive os privados. Isso evita projetos órfãos e ajuda em suporte e auditoria.
4. **Permissão efetiva.** A função central `board_permission()` devolve `owner|admin|edit|view|null`: o **maior** acesso entre:
   - o papel no time;
   - o acesso ao projeto;
   - o convite direto no quadro (`board_members`);
   - o link de compartilhamento (`access_level`), a menos que ele seja `restricted`.

   Storage, Realtime, histórico, API e busca passam todos por essa função e pelas auxiliares `team_role(team_id)` e `project_access(project_id)`, ambas stable e security definer.
5. **Compartilhamento no estilo Google Drive.** Detalhado na seção [Compartilhar](#compartilhar-estilo-google-drive) abaixo.
6. **URLs.** `/b/:id` continua global e nunca muda. O dashboard fica em `/t/:slug` e `/t/:slug/p/:projectId`. Quem abre um quadro sem ter acesso vê a tela "sem acesso · pedir acesso". A URL não carrega time nem projeto porque não protege nada, exporia a estrutura interna e quebraria ao mover o quadro.
7. **Convites.** No v1, o convite é um link copiável: o token fica guardado só como hash, com expiração e papel definidos. O envio por e-mail fica para depois.
8. **Chaves de API e MCP.** A chave continua sendo do usuário. Ao criá-la, o usuário escolhe quais times ela pode acessar (`api_key_teams`). Cada chamada respeita a interseção entre esses times e a permissão atual do usuário: se o usuário perde acesso, a chave perde junto.
9. **Mover quadro entre times.** Exige ser admin (ou owner) nos dois times. As imagens não mudam de caminho no Storage, porque o caminho usa o `board_id`.
10. **Saída e remoção de membros.** Os quadros ficam no time. Se a conta for excluída, `owner_id` vira `null`. Ver "Diferenças na implementação" sobre o único owner.
11. **Quadro anônimo reivindicado** vai para o projeto padrão do time ativo de quem o reivindicou.
12. **Cobrança.** Fora do v1. O time é a unidade natural para cobrar no futuro, mas nenhuma coluna de plano é criada agora.

## Compartilhar (estilo Google Drive)

O modal de compartilhar passa a ter três blocos: **adicionar pessoas**, **Pessoas com acesso** e **Acesso geral**, além dos botões "Copiar link" e "Concluído".

### Adicionar pessoas

- Campo de e-mail, com autocompletar **apenas** entre membros dos times do usuário.
- Papel escolhido na hora: **Leitor** (`view`) ou **Editor** (`edit`).
- Qualquer e-mail é aceito. Se ainda não existir conta com aquele e-mail, fica um **convite pendente** (`board_members.user_id null`), que é ativado quando alguém cria conta com esse e-mail **verificado**.
- A interface nunca revela se um e-mail já tem conta, para evitar enumeração de usuários.
- A adição passa por uma RPC `share_board(board_id, email, role)` com limite de taxa, que também grava no `audit_log`.

### Pessoas com acesso

A lista mostra quem acessa o quadro e por quê:

- **Criador**, com o rótulo "Criador" em vez de "Proprietário", porque o quadro é do time.
- **Acesso herdado**, em linhas agrupadas, por exemplo "Time Acme · Editores" ou "Projeto X (privado) · 4 pessoas". Essas linhas só leem; o acesso é ajustado no time ou no projeto.
- **Convidados diretos**, em que dá para trocar o papel (Leitor ou Editor) ou remover.
- **Convites pendentes** aparecem como qualquer outro e-mail (ver "Diferenças na implementação").

O convite direto só **soma** acesso. Ele nunca tira o acesso que a pessoa já tem pelo time ou pelo projeto.

### Acesso geral (`access_level`)

| Valor | Rótulo | Efeito |
|---|---|---|
| `restricted` | **Restrito** | Só quem tem acesso pelo time, pelo projeto ou por convite direto consegue abrir, mesmo com o link. |
| `view` | Qualquer pessoa com o link · Leitor | Como o `view` de hoje. |
| `edit` | Qualquer pessoa com o link · Editor | Como o `edit` de hoje. |

- **Quadro novo nasce `restricted`.**
- **Quadros existentes viram `restricted`, com aviso antes.** Ninguém perde o link sem saber:
  - No deploy da fase 5, cada quadro com link aberto recebe `boards.restrict_link_at = now() + 30 dias`.
  - Durante esse prazo, quem pode compartilhar o quadro vê um aviso no dashboard e no modal: "O link deste quadro será restrito em DD/MM". O aviso tem dois botões: **Manter link aberto**, que zera `restrict_link_at` e só vale para aquele quadro, e **Restringir agora**.
  - Quem só visita pelo link vê, dentro do quadro, a faixa "Este link deixará de ser público em DD/MM. Peça acesso ao dono."
  - O cron em `api/cron` troca para `restricted` os quadros cujo prazo venceu e grava no `audit_log`, com o autor registrado como `system`.
  - Mudar o acesso geral manualmente antes do prazo cancela a migração daquele quadro.
- **Quadros anônimos** (sem time) não podem ficar `restricted`, porque ninguém conseguiria abri-los. Na hora de reivindicar, um diálogo pergunta em qual time e projeto o quadro entra e se ele deve **continuar aberto por link** (como estava) ou **ficar Restrito**. Nenhuma opção vem pré-selecionada. A escolha grava no `audit_log`.
- **RLS de leitura.** A regra do cabeçalho `x-board-id` passa a valer só quando `access_level <> 'restricted'`. As políticas do Storage e do Realtime já usam `board_permission()` e herdam a regra.
- **Tela sem acesso.** Quem abre um quadro `restricted` sem permissão vê "Você precisa de acesso", com "Entrar com outra conta". O "Pedir acesso" fica para depois, porque depende de notificação.

### Quem pode compartilhar

- **Por padrão, editores** podem adicionar pessoas e mudar o acesso geral.
- O admin do time pode desligar isso para o time inteiro (`teams.editors_can_share`, a engrenagem do modal). Nesse caso, só o criador do quadro e os admins do time compartilham.
- Nenhum editor consegue conceder um papel maior que o próprio.

### Compartilhados comigo

- Uma seção nova no dashboard lista os quadros em que o usuário está em `board_members`, fora dos times dele.
- No v1 não há e-mail de notificação: quem compartilha usa o botão "Copiar link" e envia a mensagem por conta própria.
- **Convidado externo não vira membro do time.** Ele só vê aquele quadro: não vê o projeto, as pastas nem os outros quadros.

## Opções consideradas

| | A: `team_id` no quadro + membros (escolhida) | B: dono + ACL por quadro | C: schema por time |
|---|---|---|---|
| Complexidade | Média | Média, depois alta | Alta |
| Encaixe com o RLS atual | Troca `owner_id` por uma função central | Consulta a ACL em cada política | Incompatível com o PostgREST |
| Cobrança futura | Natural | Ruim | Ok |
| Referência de mercado | Vercel, Supabase, Linear, Excalidraw+ | Google Drive | Raro |

A opção A foi escolhida como base. O compartilhamento estilo Drive (convites por quadro, ou seja, a opção B) entra por cima dela, como uma camada que só soma acesso.

## Consequências e riscos

- **Desempenho do RLS.** Usar `(select team_ids_of_user())` e `(select auth.uid())` para que o Postgres calcule uma vez por consulta, com índices em `team_members(user_id, team_id)` e `project_members(user_id, project_id)`.
- **Migração sem tempo fora do ar (expand/contract):**
  1. Tabelas novas e colunas anuláveis.
  2. Backfill: um time pessoal e um projeto padrão por usuário; quadros e pastas vão para eles.
  3. RLS, triggers e RPCs novos.
  4. `NOT NULL` e remoção das políticas antigas.

  Aplicar as migrations antes do deploy.
- **Auditoria.** `audit_log` ganha `team_id`. Passam a ser registrados convites, mudanças de papel, remoções, mudanças de visibilidade de projeto e movimentação de quadros entre times.
- **Exclusão de conta e LGPD.** O `on delete cascade` que hoje apaga os quadros deixa de valer para conteúdo do time. Atualizar `compliance/data-management.md`.
- **Biblioteca.** `user_libraries` continua pessoal. A biblioteca do time fica como follow-up.

## Plano de implementação

1. [x] **Fase 1: schema, backfill e funções auxiliares**, sem mudança visível. Testes em PGlite do backfill e do trigger de time pessoal.
2. [x] **Fase 2: permissões.** Reescrever `board_permission`, `realtime_can_edit_board`, `check_board_folder`, `check_folder_parent`, `handle_board_update`, as funções `api_*`, a busca e o Storage. Testes de isolamento entre times e entre projetos privados.
3. [x] **Fase 3: UI.** Seletor de time no Header, projetos no Dashboard (`/t/:slug/p/:id`), aba "Time" nas Configurações (membros e papéis) e tela "sem acesso".
4. [x] **Fase 4: convites para o time** por link (criar, revogar, aceitar).
5. [x] **Fase 5: compartilhar estilo Drive**, nos passos abaixo.
   1. Adicionar `restricted` em `access_level`, criar `board_members` e a RPC `share_board`, e ativar os convites pendentes ao verificar o e-mail.
   2. Migração com aviso: preencher `restrict_link_at` (+30 dias), mostrar os avisos ao dono e ao visitante e criar o cron que aplica a restrição.
   3. Diálogo ao reivindicar um quadro anônimo: escolher time, projeto e acesso geral.
   4. Ajustar a RLS de leitura (`x-board-id` só quando o quadro não é restrito) e somar os convites diretos em `board_permission()`.
   5. Refazer o `ShareModal`: pessoas com acesso, acesso geral e engrenagem com `editors_can_share`.
   6. Criar a seção "Compartilhados comigo" e a tela "Você precisa de acesso".
   7. Testes em PGlite: restrito com o link, migração agendada e opção de manter aberto, convite pendente e ativação, editor que não consegue promover além do próprio papel, convidado que não vê o resto do projeto.
6. [x] **Fase 6: API e MCP.** Seleção de times na criação da chave (`api_key_teams`) e parâmetro de time nas chamadas.
7. [ ] **Depois:** notificação por e-mail (convite para o time e compartilhamento), "Pedir acesso", biblioteca do time e cobrança.

## Diferenças na implementação

Decididas durante a implementação (branch `feat/teams`, migration `20260927120000_teams_projects_sharing.sql`):

1. **`owner_id` não foi renomeado para `created_by`.** A coluna continua com o nome antigo e passa a significar "quem criou". Renomear quebraria os clientes já publicados durante o deploy.
2. **Convites pendentes não têm rótulo próprio.** A lista mostra só o e-mail e o papel de cada convite direto. Um rótulo "Convite pendente" revelaria quais e-mails ainda não têm conta, justamente o que a regra de não enumerar usuários proíbe.
3. **A exclusão de conta não é bloqueada.** O banco não consegue impedir a exclusão feita no Supabase Auth. Por isso: o time pessoal e os quadros dele são apagados; num time com outras pessoas, se a conta era a única owner, a posse passa para um admin (ou para o membro mais antigo). As imagens do time pessoal precisam ser apagadas antes; ver `compliance/data-management.md`.
4. **O link de convite para o time vale para uma pessoa.** Depois de aceito, não serve para mais ninguém. Continua expirando em 7 dias e pode ser revogado.
5. **Escritas privilegiadas só por funções.** Criador, time, projeto e agendamento da restrição do link não são graváveis pelos clientes: há permissões por coluna e uma checagem no gatilho. Reivindicar, mover e manter o link aberto passam por `claim_board`, `move_board` e `keep_board_link_open`, que ligam o sinal interno `heeey.system`.
6. **Quem pode enviar para a lixeira:** quem edita o quadro pelo time/projeto, ou quem o administra. Convidados diretos e quem entra pelo link não enviam.
7. **Excluir time ou projeto exige que estejam vazios,** incluindo a lixeira. O projeto padrão não pode ser excluído nem ficar privado.

