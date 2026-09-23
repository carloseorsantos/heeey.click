# Colaboração & Tempo Real (Multiplayer)

O Heeey utiliza a infraestrutura do **Supabase Realtime** para entregar uma experiência multiplayer de baixa latência e alta resiliência, combinando canais de **Broadcast**, **Presence** e sincronização periódica de banco de dados.

---

## ⚡ Como Funciona a Sincronização

A colaboração em tempo real opera no canal temático:
```
heeey:room:{boardId}
```

Nenhum elemento precisa passar por filas lentas ou polling. Quando um colaborador move o cursor ou altera elementos:

```
[Cliente A] --(Broadcast via WebSocket)--> [Supabase Realtime] --(Fan-out)--> [Cliente B, Cliente C, ...]
```

### 1. Broadcast de Elementos (`canvas-update`)
- Enquanto um usuário desenha ou move elementos, as alterações são enviadas pelo evento `canvas-update`.
- O payload inclui os elementos modificados, metadados de cor de fundo da cena e um timestamp.
- **Reconciliação de Versão**: Cada elemento possui campos de controle de versão (`version`, `versionNonce`). O cliente local compara os elementos recebidos com os do canvas e aplica apenas as atualizações com número de versão estritamente maior ou que resolvam empates deterministicamente.

### 2. Sincronização de Presença & Cursores (`cursor-update` & Presence)
- As posições dos mouses e ponteiros laser são transmitidas com alta frequência sem poluir o histórico de desenho.
- Cada participante tem:
  - Nome visível no cursor.
  - Cor única de avatar e halo de cursor (gerada de forma consistente a partir da paleta de 12 tons do Heeey).
  - Estado do laser pointer quando ativo.
  - Elementos atualmente selecionados destacados em tempo real.
- Quando uma aba é fechada ou a conexão cai, o Supabase Presence desliga o cursor automaticamente após poucos segundos.

---

## 🔒 Níveis de Acesso e Permissões

Cada quadro possui um campo `access_level`:

| Nível de Acesso | Valor no Banco | Descrição |
|---|---|---|
| **Pode Editar** | `'edit'` | Qualquer visitante com o link pode interagir, desenhar e adicionar notas. |
| **Apenas Leitura** | `'view'` | Visitantes visualizam as alterações em tempo real e os cursores dos colegas, mas o canvas fica bloqueado contra edições locais. O proprietário do quadro mantém permissão irrestrita de edição. |

### Alterando o Nível de Acesso:
1. No cabeçalho do quadro, abra o modal de **Compartilhar**.
2. Alterne entre **"Pode Editar"** e **"Apenas Leitura"**.
3. A mudança reflete imediatamente para todos os visitantes conectados através de uma mensagem `meta-update`.

---

## 🛡️ Salvamento Automático & Persistência Local

O Heeey utiliza uma estratégia híbrida em camadas:
1. **Cache Local Imediato (`localStorage`)**: Todas as alterações locais são registradas no armazenamento do navegador instantaneamente. Se a conexão cair, nada é perdido.
2. **Auto-Save com Debounce no Banco (`PostgreSQL`)**: As alterações consolidadas são enviadas ao Supabase com debounce inteligente (aproximadamente 1,5 segundos de inatividade após o último traço).
3. **Indicador de Status de Sincronização**:
   - 🟢 **Salvo**: O estado na nuvem está sincronizado com a tela atual.
   - 🟡 **Salvando...**: Alterações pendentes estão sendo enviadas ao banco.
   - 🟠 **Offline**: Conexão perdida; alterações retidas com segurança no cache local.
   - 🔴 **Erro**: Falha de rede temporária; nova tentativa automática será disparada.

---

## 👤 Personalização de Colaboradores

Visitantes convidados podem personalizar sua presença a qualquer momento:
- Clique no avatar de identificação no canto superior direito.
- Escolha um apelido (*nickname*) e selecione sua cor favorita na paleta.
- A personalização é memorizada no navegador e aplicada automaticamente em todos os quadros futuros que você visitar.
