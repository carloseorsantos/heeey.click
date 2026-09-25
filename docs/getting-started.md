# Começando com o Heeey (Quick Start)

Este guia apresenta como começar a usar o **Heeey**, desde o primeiro acesso no navegador até a automação programática via API e agentes de inteligência artificial.

---

## 🚀 Primeiro Acesso: Criando seu primeiro quadro

O Heeey foi projetado com fricção zero: você não precisa criar conta ou preencher formulários para começar a desenhar.

1. Acesse [heeey.click](https://heeey.click).
2. Clique no botão **"Criar Quadro em Branco"** ou escolha um dos templates disponíveis:
   - **Brainstorming**: Post-its e cartões temáticos para ideação rápida.
   - **Fluxograma**: Estrutura básica com blocos de decisão e setas direcionadas.
   - **Wireframe**: Telas e componentes básicos de prototipação.
3. Você será redirecionado para a URL `/b/<id-do-quadro>`.
4. Comece a desenhar imediatamente! Seu trabalho é salvo localmente em tempo real e sincronizado na nuvem.

---

## 👥 Colaborando com outras pessoas

Para convidar colegas para o mesmo quadro:

1. No cabeçalho superior do quadro, clique no botão **"Compartilhar"**.
2. Escolha o nível de permissão:
   - **Pode Editar** (`edit`): Qualquer pessoa com o link pode desenhar, adicionar notas e alterar o conteúdo.
   - **Apenas Leitura** (`view`): Qualquer pessoa com o link pode visualizar e acompanhar os cursores ao vivo, mas não pode alterar o canvas.
3. Clique em **"Copiar link"** e envie para a equipe.
4. Quando outras pessoas acessarem o link, você verá o cursor delas em tempo real, com seus respectivos nomes e cores de identificação.

---

## 🔐 Conectando sua Conta (Google ou Magic Link)

Embora o uso anônimo seja suportado, entrar com sua conta traz vantagens essenciais:

- **Seus quadros em qualquer dispositivo**: Acesse seu painel de qualquer navegador.
- **Herança automática de quadros anônimos**: Quadros criados por você como convidado no navegador são transferidos automaticamente para a sua conta quando você faz login.
- **Bibliotecas na nuvem**: Os elementos salvos na sua biblioteca de componentes ficam disponíveis em todos os seus quadros.
- **Geração de Chaves de API**: Habilite integrações com a API REST pública e o servidor MCP para IA.

### Como criar sua conta:
1. Na página inicial, clique em **"Criar conta grátis"**.
2. Digite seu endereço de e-mail e confirme que tem 16 anos ou mais e aceita os Termos de uso e a Política de privacidade.
3. Clique em **"Enviar link de acesso"** e abra o link que chegar no seu e-mail, neste mesmo navegador. Pronto! Não é necessário lembrar senhas.

### Como entrar:
1. Na página inicial, no Dashboard ou no menu do seu avatar, clique em **"Entrar"**.
2. Digite o e-mail da sua conta e clique em **"Enviar link de acesso"**.
3. Abra o link que chegar no seu e-mail, neste mesmo navegador.

### Entrar com o Google:
Nas mesmas telas, clique em **"Continuar com o Google"** e escolha sua conta Google. Ao criar conta, marque antes a confirmação de idade e dos termos. Se já existir uma conta Heeey com o mesmo e-mail, o Google entra nela; não é criada uma conta nova. Recebemos do Google apenas seu nome, e-mail e foto de perfil.

---

## 🤖 Automação em 3 Minutos: Claude Code & MCP

Se você utiliza o **Claude Code**, **Cursor** ou outro agente compatível com MCP:

1. Acesse o Dashboard conectado à sua conta.
2. Clique no ícone de chave (**Chaves de API**).
3. Digite um nome (ex.: `claude-code`) e clique em **"Criar Chave"**.
4. Copie a chave gerada (`hk_...`). O aplicativo já exibe o comando formatado para o seu terminal:

```bash
claude mcp add --transport http heeey https://heeey.click/api/mcp --header "Authorization: Bearer hk_SEU_TOKEN_AQUI"
```

5. Abra o terminal e execute o comando acima.
6. Agora seu assistente de IA pode criar diagramas inteiros, buscar em suas lousas e organizar seus quadros diretamente pelo prompt!

---

## 💻 Exemplo Rápido via cURL (API REST)

Você também pode criar quadros a partir de scripts ou automações CI/CD:

```bash
curl -X POST https://heeey.click/api/v1/boards \
  -H "Authorization: Bearer hk_SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fluxo de Aprovação",
    "elements": [
      { "id": "req", "type": "rectangle", "x": 100, "y": 100, "label": "Solicitação Enviada", "backgroundColor": "#a5d8ff" },
      { "id": "dec", "type": "diamond", "x": 380, "y": 85, "label": "Aprovado?", "backgroundColor": "#ffec99" },
      { "type": "arrow", "start": { "id": "req" }, "end": { "id": "dec" } }
    ]
  }'
```

O Heeey responderá com os dados do quadro criado e o link direto (`url`) para você abri-lo no navegador.
