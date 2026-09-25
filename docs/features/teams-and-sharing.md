# Times, Projetos & Compartilhamento

Os quadros do Heeey ficam organizados em **times** e **projetos**, e o compartilhamento funciona como no Google Drive: você convida pessoas por e-mail e escolhe o acesso geral do link.

```
Usuário ↔ Times → Projetos → Pastas → Quadros
```

---

## 👥 Times

- **Time pessoal**: toda conta ganha um time pessoal no cadastro, com um projeto padrão (**Geral**). Ele não pode ser excluído nem abandonado pelo dono, mas aceita convidados como qualquer outro time.
- **Criar um time**: no seletor de times (topo da barra lateral), escolha **Criar time**. Quem cria vira **owner**.
- **Trocar de time**: o mesmo seletor lista todos os seus times. O endereço do painel é `/t/<time>` e, dentro de um projeto, `/t/<time>/p/<projeto>`.

### Papéis no time

| Papel | O que pode fazer |
|---|---|
| **Owner** | Tudo o que um admin faz, além de promover outros owners e excluir o time. O time sempre tem pelo menos um owner. |
| **Admin** | Convida e remove pessoas, muda papéis (exceto de owners), vê todos os projetos, inclusive os privados, e administra todos os quadros. |
| **Membro** | Cria projetos e quadros e edita os quadros dos projetos a que tem acesso. |
| **Leitor** | Só visualiza os quadros dos projetos a que tem acesso. |

### Convites para o time

Em **Configurações › Time**, owners e admins criam um **link de convite** com o papel desejado. Cada link vale para **uma pessoa** e expira em **7 dias**. Quem abre o link vê o nome do time e o papel, entra na conta (ou cria uma) e aceita. Os links ativos podem ser revogados.

### Sair ou excluir

- **Sair do time**: os quadros que você criou continuam no time.
- **Excluir o time**: só owners, e só com o time vazio (sem quadros, nem na lixeira).
- **Exclusão de conta**: o time pessoal e os quadros dele são apagados. Em times com outras pessoas, a posse passa para um admin (ou, na falta dele, para o membro mais antigo).

---

## 📁 Projetos

Projetos organizam os quadros de um time. Dentro de cada projeto você pode criar pastas.

- **Aberto ao time** (padrão): todos os membros do time veem os quadros. Leitores do time só visualizam.
- **Privado**: só as pessoas adicionadas ao projeto (como Editor ou Leitor) e os owners e admins do time.
- O projeto padrão (**Geral**) fica sempre aberto ao time e não pode ser excluído.
- **Mover quadros**: pelo menu do quadro, **Mover para projeto**. Entre projetos do mesmo time, basta editar os dois. Entre times, é preciso ser owner ou admin nos dois.

---

## 🔗 Compartilhar (estilo Google Drive)

O botão **Compartilhar** do quadro abre três blocos:

### 1. Adicionar pessoas
Digite um e-mail, escolha **Leitor** ou **Editor** e clique em **Convidar**. Funciona para qualquer e-mail: se a pessoa ainda não tem conta, o convite fica guardado e vale assim que ela criar a conta com esse e-mail **verificado**. A tela nunca mostra se um e-mail já tem conta.

Não há e-mail de notificação: envie o link com **Copiar link**. Os quadros compartilhados com você aparecem em **Compartilhados comigo**.

### 2. Pessoas com acesso
Mostra quem criou o quadro, o acesso herdado (os membros do time ou do projeto privado) e as pessoas convidadas diretamente. O convite direto só **soma** acesso: nunca tira o que a pessoa já tem pelo time. Convidados de fora do time veem só aquele quadro, não o projeto nem os outros quadros.

### 3. Acesso geral

| Opção | Efeito |
|---|---|
| **Restrito** | Só quem tem acesso pelo time, projeto ou convite abre o quadro, mesmo com o link. Padrão dos quadros novos. |
| **Qualquer pessoa com o link · Leitor** | Quem tem o link vê o quadro, sem criar conta. |
| **Qualquer pessoa com o link · Editor** | Quem tem o link edita junto, sem criar conta. |

Quem abre um quadro restrito sem acesso vê a tela **Você precisa de acesso**, com a opção de entrar com outra conta.

### Quem pode compartilhar
Por padrão, **editores** podem convidar pessoas e mudar o acesso geral. Owners e admins do time podem desligar isso (engrenagem do modal ou **Configurações › Time**); então só quem criou o quadro e os admins compartilham. Quem entra só pelo link nunca altera o acesso.

---

## ⏳ Links antigos: migração com aviso

Quadros que já estavam abertos por link antes dos times ganharam **30 dias** até virarem restritos. Durante esse prazo:

- Quem pode compartilhar vê o aviso no modal, com **Manter link aberto** (vale só para aquele quadro) e **Restringir agora**.
- Quem só visita pelo link vê uma faixa com a data em que o link deixará de ser público.
- Mudar o acesso geral manualmente cancela a migração daquele quadro.

Uma rotina diária aplica as restrições vencidas e registra cada uma na trilha de auditoria.

---

## 📝 Quadros criados sem conta

Sem conta, os quadros ficam abertos para edição por link. Ao entrar, o Heeey pergunta **em qual time e projeto guardá-los** e se o link **continua aberto** ou fica **restrito**; nenhuma opção vem marcada. Se você responder **Agora não**, um aviso no painel permite guardar depois.

---

## 🔒 Segurança

- Todas as regras são aplicadas no banco (RLS e funções do PostgreSQL), não só na interface: API, MCP, Realtime e Storage seguem a mesma permissão.
- Mudanças de time, papéis, convites, projetos e compartilhamentos entram na trilha de auditoria, sem guardar os e-mails convidados.
- Chaves de API alcançam só os times escolhidos na criação (veja [Autenticação](../api/authentication.md)).
