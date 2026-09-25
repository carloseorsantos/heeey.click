# Regras do projeto

Regras gerais para quem contribui com o Heeey, sejam pessoas ou agentes de IA. O fluxo formal de mudanças, com aprovação, CI e deploy, está em [compliance/change-management.md](compliance/change-management.md). Este arquivo reúne as convenções do dia a dia.

## Leitura obrigatória
- **[`docs/README.md`](docs/README.md)**: índice da documentação do Heeey (recursos da lousa, colaboração, API REST, servidor MCP e modelo de dados). Leia antes de mudar qualquer coisa, e abra os documentos da área que a mudança afeta. As versões em inglês e espanhol ficam em `docs/en/` e `docs/es/`.

## Fluxo de mudanças
- Toda mudança nasce numa branch `feat/*`, `fix/*` ou `chore/*` e chega à `main` só por Pull Request.
- Uma branch por assunto. Não misture mudanças sem relação no mesmo PR.
- Commits no formato [Conventional Commits](https://www.conventionalcommits.org/) (`tipo(escopo): resumo`), agrupados por assunto.
- Preencha o [template de PR](.github/pull_request_template.md), inclusive o checklist.

## Issues
- Toda issue nova sai com labels. Use uma de cada grupo:
  - **Tipo:** `Feature`, `Fix` ou `Research`
  - **Área de impacto:** `Segurança`, `Integrações`, `Infraestrutura` ou `Geral`
- Antes de criar a issue, pergunte a quem pediu **a quem atribuir** e **em qual projeto** ela entra. Não presuma nenhum dos dois.
- Toda issue tem uma seção **Critérios de aceite**, em forma de checklist.
- Antes de abrir o PR ou encerrar a issue, revise cada critério contra o que foi entregue. Marque só os que foram cumpridos e aponte o que ainda falta.

## Código
- Reaproveite o que já existe (`Modal`, `AuthForm`, `Button`, hooks, i18n) antes de criar funções ou componentes novos.
- Siga o estilo do código ao redor: nomes, densidade de comentários e padrões.
- Dados que vêm do quadro (outros usuários, API, MCP) não são confiáveis. Valide tipos e tamanhos antes de usar.

## Textos e idiomas
- Todo texto de interface fica em `src/i18n/locales/`. `pt-BR.ts` é a fonte; `en-US.ts` e `es-ES.ts` têm as mesmas chaves.
- Links para `/app` nas páginas estáticas terminam em `lang=<locale>` (verificado por `staticPages.test.ts`).

## Documentação
- A documentação fica em `docs/`, nos três idiomas.
- Depois de mudar a documentação, rode `npm run docs:llms` para regenerar os `llms-full.txt`.

## Banco de dados
- Toda mudança de schema, RLS ou função é uma migration nova e re-executável em `supabase/migrations/`, com testes em `supabase/tests/`.
- Não edite migrations que já foram aplicadas.

## Validação
Antes de abrir um PR:
- `npm run build` (checagem de tipos + build) e `npm test` passam. Para rodar um teste só: `npx vitest run src/__tests__/<arquivo>.test.ts`.
- No Windows, com `core.autocrlf=true`, 2 testes de `docs.test.ts` falham por causa do fim de linha (CRLF). A falha é conhecida e não indica regressão.
- A mudança foi conferida no navegador (`npm run dev`), nos idiomas afetados.
- Nada de ferramentas de teste local vai para o repositório: screenshots, snapshots, scripts temporários e a pasta `.playwright-cli/`.

## Segurança
- Sem segredos, chaves ou dados pessoais no código, em logs ou em fixtures.
- Sem `.env`, o app usa o Supabase de produção. Quadros criados no `npm run dev` ficam gravados de verdade; apague os de teste depois. Não dispare magic links reais em testes; intercepte `/auth/v1/otp`.
- Vulnerabilidades seguem o [SECURITY.md](SECURITY.md).

## Regras locais
Cada pessoa pode ter um `rules.local.md` na raiz, fora do git (listado em `.git/info/exclude`), com regras pessoais: contas, identidade git e preferências de fluxo. Se ele existir, leia junto com este arquivo. Ele complementa estas regras, mas não substitui nenhuma.
