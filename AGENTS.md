# AGENTS.md

Instruções para agentes de IA que trabalham neste repositório.

<!--
  Seção obrigatória. Os dois itens abaixo precisam existir em qualquer versão deste arquivo:
  toda edição mantém os dois, com o mesmo sentido e nesta ordem. Outras seções podem ser
  adicionadas, alteradas ou removidas; estes dois itens não.
-->
## Antes de qualquer tarefa (obrigatório)

1. **Leia o [`rules.md`](rules.md).** Ele traz as regras e convenções do projeto e vale para toda mudança. Se houver um `rules.local.md` na raiz, leia também, como pede o próprio `rules.md`.
2. **Leia o `handoff.md` da raiz, se existir.** É o documento local usado para passar contexto entre agentes: o que está em andamento, decisões tomadas e pendências. Se ele não existir, **pergunte a quem está pedindo a tarefa qual arquivo `.md` local está sendo usado para compartilhar contexto entre os agentes**, e só então continue.

## Limites de ação
- Não faça push, não abra nem edite PRs, não comente e não crie ou altere issues sem um pedido explícito para aquela ação.
- Não apague nem sobrescreva arquivos que você não criou, como prints ou anotações soltos no repositório.
- Não mexa em arquivos fora do escopo da tarefa. Se encontrar algo que pede correção em outro lugar, avise em vez de corrigir.

## Ao terminar
- Atualize o `handoff.md` (ou o arquivo de contexto combinado) com o que foi feito, as decisões tomadas e o que ficou pendente.
- Encerre o que você iniciou. No Windows, parar o `npm run dev` pelo terminal do agente pode deixar o processo do Vite vivo; confira se a porta ficou livre.
