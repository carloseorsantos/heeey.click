# Resposta a Incidentes

**Revisão:** anual · **Simulação (tabletop):** anual

## 1. O que é um incidente

Qualquer evento que comprometa ou ameace a confidencialidade, a integridade ou a disponibilidade
do heeey.click: vazamento de segredo, acesso indevido a quadros, falha de RLS, indisponibilidade,
perda de dados, conta administrativa comprometida ou vulnerabilidade reportada e explorável.

## 2. Severidade

| Nível | Exemplo | Início da resposta |
|---|---|---|
| **SEV1** | Dados pessoais ou quadros expostos; `service_role` vazada; site fora do ar | Imediato |
| **SEV2** | Vulnerabilidade explorável sem evidência de exploração; recurso importante quebrado | Até 24 h |
| **SEV3** | Problema de segurança de baixo impacto; degradação parcial | Próximo dia útil |

## 3. Passo a passo

Indisponibilidade é detectada pelo Upptime (`carloseorsantos/status`), que consulta o site, `/api/health`
e `/api/v1` a cada 5 minutos e abre sozinho uma issue lá quando algo cai; ela fecha quando o serviço volta.

1. **Registrar**: abra uma issue **privada** (security advisory do GitHub) ou, se não houver risco de expor detalhes, uma issue com o rótulo `incident`. Anote o horário de detecção.
2. **Conter**: rotacionar segredos, revogar chaves de API, desligar funcionalidades, fazer rollback na Vercel ou restringir políticas RLS.
3. **Investigar**: `public.audit_log`, logs da Vercel (funções e cron), logs do Supabase (API, Auth, Postgres), PostHog.
4. **Erradicar e recuperar**: corrigir por PR (fluxo emergencial se preciso), restaurar dados se necessário ([data-management.md](data-management.md)).
5. **Comunicar** (seção 4).
6. **Post-mortem** em até 5 dias úteis para SEV1/SEV2 (seção 5).

## 4. Comunicação

- **Titulares de dados e ANPD**: se houver risco ou dano relevante a titulares, comunicar à ANPD e às pessoas afetadas em até **3 dias úteis** a partir da ciência (Resolução CD/ANPD nº 15/2024). Para titulares na UE, notificar a autoridade competente em até 72 h (GDPR art. 33).
- **Usuários**: status page pública em [status.heeey.click](https://status.heeey.click) (para incidentes sem
  monitor automático, abra uma issue com o rótulo `incident` no repo `carloseorsantos/status`), aviso no site
  ou por e-mail a partir de `contato@heeey.click`.
- **Quem reportou** (divulgação responsável): atualização ao conter e ao corrigir.

## 5. Modelo de post-mortem

```markdown
# Post-mortem: <título> (SEVn)

- Detecção: AAAA-MM-DD HH:MM UTC · Contenção: ... · Resolução: ...
- Impacto: quem/quantos, quais dados, por quanto tempo
- Linha do tempo
- Causa raiz (sem culpados)
- O que funcionou / o que não funcionou
- Ações corretivas (com issue e responsável)
- Comunicações feitas (ANPD, usuários)
```
