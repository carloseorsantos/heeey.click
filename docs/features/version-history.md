# Histórico de Versões & Restauração

O Heeey inclui um sistema integrado de controle de versão point-in-time que protege o trabalho da sua equipe contra edições indesejadas, desconfigurações acidentais ou perdas de dados.

---

## 🕒 Como Funcionam os Snapshots

O banco de dados grava snapshots do quadro na tabela `board_versions` em duas situações:

1. **Snapshots Automáticos (`reason: 'auto'`)**:
   - Disparados em segundo plano pelo servidor sempre que o quadro sofre edições ativas.
   - O servidor respeita um intervalo mínimo de **10 minutos** entre snapshots automáticos sucessivos para evitar excesso de dados em sessões contínuas.
2. **Snapshots de Pré-Restauração (`reason: 'before_restore'`)**:
   - Antes de restaurar qualquer versão antiga, o estado atual do quadro é arquivado imediatamente no histórico.
   - Isso significa que restaurar uma versão **nunca é uma operação destrutiva**; você pode sempre desfazer a restauração e voltar ao momento exato anterior.

---

## 🗄️ Política de Retenção

- **Capacidade**: Até **30 versões** mais recentes por quadro.
- **Validade Temporal**: Versões com mais de **30 dias** são automaticamente limpas por gatilhos do banco.
- Ao salvar a 31ª versão, o gatilho SQL remove a versão mais antiga do quadro correspondente de forma transparente.

---

## 🔄 Algoritmo de Reconciliação sem Conflitos (`buildRestoredElements`)

Um problema comum em aplicações colaborativas ao restaurar versões antigas é o conflito com colaboradores que continuam desenhando: elementos antigos com versão baixa seriam ignorados pelos clientes conectados.

O Heeey resolve isso com um algoritmo determinístico de bumping:

```typescript
export function buildRestoredElements(
  currentElements: readonly any[],
  versionElements: readonly any[],
  now: number = Date.now(),
  randomNonce: () => number = () => Math.floor(Math.random() * 2 ** 31)
): any[] {
  // 1. Cada elemento da versão histórica recebe um número de 'version'
  // estritamente superior ao que está atualmente no canvas.
  // 2. Elementos que existem no canvas atual mas NÃO existiam na versão restaurada
  // são marcados com isDeleted: true com versão elevada.
}
```

### Vantagens do Algoritmo:
- **Propagação Imediata**: A versão restaurada vence a reconciliação do Excalidraw em todos os navegadores conectados na hora.
- **Eliminação de Resíduos**: Desenhos feitos após o ponto histórico desaparecem do canvas de forma limpa.
- **Transmissão em Tempo Real**: Uma mensagem de `canvas-update` é transmitida pelo canal Supabase, atualizando a tela de todos os participantes ao vivo.

---

## 🖥️ Como Acessar o Histórico

1. Dentro do quadro aberto, clique no ícone de relógio (**Histórico de Versões**) no cabeçalho superior.
2. A lista de pontos de restauração será exibida com data, hora, quantidade de elementos e miniatura visual.
3. Clique em uma versão para inspecioná-la.
4. Clique em **"Restaurar esta versão"**. O canvas será atualizado instantaneamente.
