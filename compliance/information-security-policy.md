# Política de Segurança da Informação

**Responsável:** mantenedor principal do heeey.click · **Revisão:** anual (ou após incidente grave)

## 1. Objetivo

Proteger a confidencialidade, a integridade e a disponibilidade dos quadros e dos dados das
pessoas que usam o heeey.click, e cumprir a LGPD, o GDPR e os compromissos da
[política de privacidade](../privacidade/index.html).

## 2. Escopo

- Aplicação web (Vite/React) e funções serverless (`api/`) hospedadas na Vercel.
- Banco de dados, autenticação, Storage e Realtime no Supabase.
- Repositório GitHub, pipelines de CI e contas administrativas dos fornecedores listados em [vendors.md](vendors.md).
- Todas as pessoas com acesso de escrita ao repositório ou acesso administrativo a esses serviços.

## 3. Papéis

| Papel | Responsabilidades |
|---|---|
| Responsável de segurança (mantenedor principal) | Aprova políticas, concede e revoga acessos, coordena incidentes, faz as revisões periódicas |
| Pessoas mantenedoras | Seguem estas políticas, revisam PRs, reportam incidentes |
| Contribuidores externos | Contribuem apenas por PR; não têm acesso a produção |

## 4. Classificação de dados

| Classe | Exemplos | Regras |
|---|---|---|
| **Restrito** | `service_role` key, `CRON_SECRET`, `AI_GATEWAY_API_KEY`, hashes de chaves de API, senhas de contas administrativas | Só em cofres (Vercel/Supabase/gerenciador de senhas); nunca no código, em logs ou em chats |
| **Confidencial** | Conteúdo dos quadros, e-mails dos usuários, `audit_log` | Protegido por RLS; acesso administrativo só para suporte ou incidente, com registro |
| **Interno** | Métricas agregadas, configurações, estas políticas | Acesso da equipe |
| **Público** | Código-fonte, documentação, chave anon/publishable do Supabase | Pode ser publicado |

## 5. Princípios

1. **Menor privilégio**: cada pessoa e cada chave têm só o acesso necessário ([access-control.md](access-control.md)).
2. **Defesa em profundidade**: o cliente nunca é confiável; toda regra de acesso vive no banco (RLS, gatilhos, funções `security definer` com `search_path` vazio).
3. **Mudanças rastreáveis**: tudo chega à produção por PR revisado e CI verde ([change-management.md](change-management.md)).
4. **Minimização de dados**: coletamos o mínimo e apagamos no prazo ([data-management.md](data-management.md)).
5. **Transparência**: incidentes que afetam dados pessoais são comunicados ([incident-response.md](incident-response.md)).

## 6. Uso aceitável

- Contas administrativas são pessoais e intransferíveis, sempre com MFA.
- Dispositivos usados para administrar produção precisam de disco criptografado, bloqueio de tela e sistema atualizado.
- Não copiar dados de produção para máquinas locais, exceto para responder a incidentes ou pedidos de titulares, e apagar logo depois.
- Os testes usam PGlite; nunca apontar testes para o banco de produção.

## 7. Criptografia

- **Em repouso:** banco, Storage e backups ficam criptografados com AES-256 pelo Supabase (controle herdado, ver [vendors.md](vendors.md)).
- **Em trânsito:** TLS 1.2+ em todo o tráfego (Vercel e Supabase); HTTP é redirecionado e o HSTS está ativo (`vercel.json`).
- **Credenciais:** chaves de API são guardadas só como hash SHA-256 e mostradas uma única vez; nenhuma credencial fica em texto puro no banco.
- **Segredos do servidor:** só nas variáveis de ambiente da Vercel/Supabase; nunca no repositório nem no bundle do cliente (variáveis `VITE_*` são públicas).
- **Tokens de terceiros:** hoje nenhum é armazenado. Se algum passar a ser, precisa ser criptografado na aplicação (AES-256-GCM, chave fora do banco) antes de gravar.
- **Quadros locais:** quadros de visitantes ficam em texto puro no `localStorage` do próprio dispositivo; não há criptografia ponta a ponta nos links de compartilhamento.

## 8. Treinamento e ciência

Toda pessoa que recebe acesso de escrita ou administrativo lê estas políticas e registra ciência
na revisão de acessos do trimestre ([access-control.md](access-control.md)).

## 9. Exceções

Exceções são registradas numa issue com o rótulo `security-exception`, com justificativa, prazo e
aprovação do responsável de segurança.
