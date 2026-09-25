# Fornecedores e Subprocessadores

**Revisão:** anual. Na revisão, baixar o relatório SOC 2 Type 2 mais recente de cada fornecedor
crítico (pelo trust center dele), ler a seção de *exceções* e os *Complementary User Entity
Controls* (CUECs), e registrar abaixo.

| Fornecedor | Uso | Dados tratados | Crítico | Certificações | Onde obter o relatório |
|---|---|---|---|---|---|
| **Supabase** | Postgres, Auth, Storage, Realtime | Quadros, e-mails, imagens, auditoria | Sim | SOC 2 Type 2, HIPAA | Dashboard → Organization → Legal Documents (plano Team+) ou trust center |
| **Vercel** | Hospedagem, funções, cron, Web Analytics | Tráfego, conteúdo em trânsito | Sim | SOC 2 Type 2, ISO 27001 | security.vercel.com |
| **Vercel AI Gateway** | Busca semântica (Jev) | Títulos e textos dos quadros, só quando a busca é usada | Não | Via Vercel; ZDR opcional (`AI_GATEWAY_ZDR`) | security.vercel.com |
| **PostHog** | Métricas de produto e erros | Eventos de uso, identificadores | Não | SOC 2 Type 2 | posthog.com/handbook/company/security |
| **GitHub** | Código, CI, Dependabot | Código-fonte (público) | Sim | SOC 2 Type 2, ISO 27001 | GitHub Trust Center |

## CUECs que cabem a nós

Controles que os relatórios dos fornecedores assumem que o cliente faz:

- MFA e revisão de acessos nas contas ([access-control.md](access-control.md)).
- RLS correto em todas as tabelas (Supabase não protege dados expostos por políticas nossas).
- Guarda da `service_role` key e das variáveis de ambiente.
- Configuração de backups/PITR adequada ao nosso RPO.

## Registro de revisões

| Data | Fornecedor | Período do relatório | Exceções relevantes | Ação |
|---|---|---|---|---|
| | | | | |

## Novo fornecedor

Antes de adicionar um serviço que recebe dados de usuários: verificar certificações (SOC 2 ou
ISO 27001), DPA e localização dos dados; adicionar nesta tabela; atualizar a política de
privacidade (pt, en, es).
