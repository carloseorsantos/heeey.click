# Autenticação & Chaves de API

O Heeey utiliza **Chaves Pessoais de API** (*Personal API Keys*) para autorizar requisições feitas à API REST (`/api/v1`) e ao servidor MCP (`/api/mcp`).

---

## 🔑 Como Obter uma Chave de API

1. Acesse o [heeey.click](https://heeey.click) e entre na sua conta (via Magic Link).
2. No Dashboard, clique no ícone de chave (**Chaves de API**) no cabeçalho.
3. Clique em **"Criar Nova Chave"**:
   - Defina um nome identificador (ex.: `script-backup`, `claude-code`, `github-actions`).
   - Selecione os escopos desejados:
     - **Leitura (`read`)**: Permite listar quadros, pastas e ler o conteúdo das cenas.
     - **Escrita (`write`)**: Permite criar, alterar, mover e enviar quadros para a lixeira.
4. **Guarde sua chave com segurança**: A chave completa com o formato `hk_<prefixo>_<segredo>` só é exibida **uma única vez** no momento da criação.

---

## 🔒 Formato da Chave & Armazenamento Seguro

- **Formato**: `hk_` seguido de 8 caracteres hexadecimais de prefixo e 40 caracteres de segredo criptográfico gerado via `gen_random_bytes(24)`.
  Exemplo: `hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4`
- **Armazenamento no Banco**: O segredo puro **nunca** é gravado no banco de dados. O Supabase armazena apenas:
  - O `prefix` (ex.: `hk_1a2b3c4d`), exibido na interface para que você saiba qual chave é qual.
  - O `key_hash`: digest criptográfico gerado com `sha256(chave)`.
- **Limite por Conta**: Cada usuário pode manter até **20 chaves ativas simultaneamente**.
- **Times que a chave alcança**: Ao criar a chave você escolhe de quais times ela lê e altera quadros (por padrão, só o seu time pessoal). Chaves antigas continuam alcançando o time pessoal. Se você sair de um time, a chave perde o acesso a ele na hora.

---

## 📤 Enviando a Chave nas Requisições

Você pode enviar a chave através do cabeçalho padrão `Authorization` ou do cabeçalho customizado `X-API-Key`:

### Opção 1: Cabeçalho Authorization Bearer (Recomendado)
```http
GET /api/v1/boards HTTP/1.1
Host: heeey.click
Authorization: Bearer hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
```

### Opção 2: Cabeçalho X-API-Key
```http
GET /api/v1/boards HTTP/1.1
Host: heeey.click
X-API-Key: hk_1a2b3c4d_e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
```

---

## 🚫 Revogando uma Chave

Caso sua chave tenha vazado ou você deseje desativar uma integração antiga:
1. Abra o modal de **Chaves de API** no Dashboard.
2. Localize a chave pelo seu prefixo ou nome.
3. Clique em **"Revogar"**.
4. A chave é marcada com `revoked_at = now()` e deixará de funcionar imediatamente. A revogação é definitiva e não pode ser desfeita.
