# Heeey (heeey.click) — Lousa Interativa & Whiteboard Colaborativo

Aplicação web moderna de whiteboard e lousa vetorial baseada no componente oficial `@excalidraw/excalidraw`, com persistência na nuvem, colaboração multiplayer em tempo real via Supabase (Broadcast e Presence), acesso híbrido para convidados e login via Magic Link, além de um dashboard para gerenciamento de múltiplos quadros.

> 📚 **Documentação Oficial**: Consulte a pasta [`docs/`](docs/README.md) para a documentação técnica detalhada, referências da API REST v1 e guia do servidor MCP para agentes de IA.
>
> 🔒 **Segurança e compliance**: políticas e controles (SOC 2) em [`compliance/`](compliance/README.md); para reportar vulnerabilidades, veja [`SECURITY.md`](SECURITY.md).

---

## 🚀 Tecnologias

- **Frontend**: Vite, React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Whiteboard Core**: `@excalidraw/excalidraw` (0.18.x)
- **Backend & Tempo Real**: Supabase
  - **Realtime Broadcast**: Sincronização ultrarrápida dos elementos do canvas via canal `heeey:room:{boardId}`
  - **Realtime Presence**: Rastreamento dos colaboradores online, cursores ao vivo, nomes e cores
  - **Auth**: Autenticação sem senha via Magic Link (Email OTP)
  - **Database**: PostgreSQL com Row Level Security (RLS) e auto-save debounced

---

## 📦 Estrutura do Projeto

```
heeey.click/
├── .env                       # Credenciais do Supabase (URL e Publishable Key)
├── supabase/
│   ├── schema.sql             # Definição da tabela public.boards, índices e políticas RLS (instalação nova)
│   ├── storage.sql            # Bucket board-media e suas políticas
│   └── migrations/            # Alterações incrementais para bancos já existentes
├── src/
│   ├── __tests__/             # Testes unitários automatizados (Vitest)
│   ├── components/
│   │   ├── AuthModal.tsx      # Modal de login com Magic Link
│   │   ├── BoardCard.tsx      # Cartão do quadro no Dashboard (abrir, renomear, duplicar, lixeira)
│   │   ├── Header.tsx         # Barra superior com título editável, status de sync e avatares
│   │   ├── NicknameModal.tsx  # Personalização de nome e cor de colaborador
│   │   └── ShareModal.tsx     # Modal de compartilhamento com controle de permissão (Edição/Leitura)
│   ├── hooks/
│   │   ├── useAuth.tsx        # Contexto de autenticação e perfil do usuário/convidado
│   │   └── useRealtimeBoard.ts # Hook central de colaboração multiplayer e sincronização
│   ├── lib/
│   │   ├── storage.ts         # Cache e persistência local (fallback offline)
│   │   ├── supabase.ts        # Cliente Supabase configurado para Realtime e Auth
│   │   ├── types.ts           # Definições de tipos TypeScript
│   │   └── utils.ts           # Funções utilitárias (cores, debounce, formatação)
│   ├── pages/
│   │   ├── BoardPage.tsx      # Tela de desenho do Excalidraw em tela cheia
│   │   └── DashboardPage.tsx  # Galeria de quadros (Meus Quadros), busca e templates
│   ├── App.tsx                # Roteamento SPA (/ e /b/:id)
│   ├── index.css              # Estilos Tailwind e estilos base do Excalidraw
│   └── main.tsx               # Ponto de entrada React
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 🛠️ Configuração do Banco de Dados (Supabase)

Para inicializar a tabela `public.boards` no seu projeto Supabase:

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard).
2. Abra o **SQL Editor** do projeto.
3. Cole e execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql), depois de [`supabase/storage.sql`](supabase/storage.sql) e, por fim, de todos os arquivos de [`supabase/migrations/`](supabase/migrations/) em ordem (eles podem ser executados de novo sem problemas).

**Banco já existente?** Execute, em ordem, os arquivos de `supabase/migrations/` que ainda não foram aplicados (ou use `supabase db push` com a Supabase CLI). Aplique as migrations **antes** de publicar o front-end que depende delas.

O script cria:
- A tabela `public.boards` com colunas para `elements`, `app_state`, `files`, `access_level` ('edit' ou 'view'), `owner_id` e `deleted_at` (lixeira).
- Políticas RLS permitindo:
  - Leitura pública dos quadros por qualquer pessoa com o link.
  - Criação aberta de novos quadros.
  - Atualização por proprietário ou em quadros com permissão "Pode Editar".
  - Lixeira (`deleted_at`): somente o proprietário move ou restaura quadros com dono; quadros na lixeira ficam somente leitura.
  - Exclusão definitiva restrita ao proprietário autenticado (quadros anônimos só vão para a lixeira).

---

## 🏃 Como Executar

### 1. Instalar dependências
```bash
npm install
```

### 2. Rodar em ambiente de desenvolvimento
```bash
npm run dev
```

### 3. Rodar os testes automatizados
```bash
npm test
```

### 4. Gerar build de produção
```bash
npm run build
```

---

## 🔌 API pública

Crie uma chave em **Chaves de API** (ícone de chave no dashboard, com a conta conectada). A chave tem as mesmas permissões que você e alcança apenas os seus quadros e pastas; chaves "somente leitura" não criam nem alteram nada.

```bash
curl https://heeey.click/api/v1/boards -H "Authorization: Bearer hk_..."
```

| Método | Rota | Corpo |
|---|---|---|
| `GET` | `/api/v1/boards?folder_id=&include_trashed=&limit=&offset=` | |
| `POST` | `/api/v1/boards` | `{ "title", "elements"?, "folder_id"? }` |
| `GET` | `/api/v1/boards/:id` | (inclui a cena completa) |
| `PATCH` | `/api/v1/boards/:id` | `{ "title"?, "elements"?, "delete_element_ids"? }` |
| `DELETE` | `/api/v1/boards/:id` | (move para a lixeira) |
| `POST` | `/api/v1/boards/:id/move` | `{ "folder_id" }` (`null` = raiz) |
| `GET` | `/api/v1/search?q=` | |
| `GET` / `POST` | `/api/v1/folders` | `{ "name", "parent_id"? }` |

**Elementos** podem ser elementos completos do Excalidraw ou descrições curtas; o servidor completa o resto, coloca o texto dentro das formas e conecta as setas:

```json
{
  "title": "Fluxo de login",
  "elements": [
    { "id": "form", "type": "rectangle", "x": 0, "y": 0, "label": "Formulário" },
    { "id": "auth", "type": "diamond", "x": 320, "y": -15, "label": "Senha ok?" },
    { "type": "arrow", "start": { "id": "form" }, "end": { "id": "auth" }, "label": "envia" }
  ]
}
```

No `PATCH`, elementos com o mesmo `id` são atualizados e os demais são adicionados; quem estiver com o quadro aberto vê a mudança na hora. Erros vêm como `{ "error": { "code", "message" } }` com status 400, 401, 403, 404 ou 409.

A API roda como Vercel Function (`api/v1.ts` → `src/server/apiHandler.ts`) e não precisa de segredos: a autenticação acontece no banco, nas funções `api_*` (migration `public_api`). Opcionalmente defina `APP_URL` para os links dos quadros.

---

## 🤖 MCP (agentes de IA)

O servidor MCP fica em `https://heeey.click/api/mcp` (transporte Streamable HTTP) e usa a mesma chave de API. Ao criar uma chave, o app mostra o comando pronto; no Claude Code:

```bash
claude mcp add --transport http heeey https://heeey.click/api/mcp --header "Authorization: Bearer hk_..."
```

Ferramentas: `list_boards`, `search_boards`, `get_board` (visão compacta da cena, ou `detail: "full"`), `create_board`, `add_elements`, `delete_elements`, `rename_board`, `trash_board`, `list_folders`, `create_folder` e `move_board`.

Para diagramas de nós e setas (fluxogramas, arquiteturas, organogramas, mapas mentais), o agente usa **`create_diagram`**: informa só os nós (`id`, `label`, `shape`, `color`) e as ligações (`from`, `to`, `label`), e o servidor dimensiona as formas pelo texto, distribui tudo em camadas (`direction`: `TB`, `LR`, `BT`, `RL`) e desenha setas conectadas que contornam as formas. **`layout_board`** reorganiza um quadro existente do mesmo jeito. Os elementos seguem o mesmo formato curto da API; quem estiver com o quadro aberto vê as mudanças do agente ao vivo.

A implementação (`src/server/mcpHandler.ts`, exposta por `api/mcp.ts`) é sem estado e tem teste de compatibilidade com o cliente oficial do SDK do MCP.

---

## 🌐 Idiomas

A interface está em **português** e **inglês**. O idioma vem do navegador na primeira visita e pode ser trocado pelo botão de idioma no dashboard ou pelo menu do perfil dentro do quadro; o editor do Excalidraw acompanha.

Os textos ficam em `src/i18n/locales/` (`pt-BR.ts` é a fonte; `en.ts` precisa ter as mesmas chaves, o que o TypeScript e os testes verificam). Use `const { t } = useI18n()` nos componentes, com parâmetros (`t('dashboard.movedTo', { name })`) e plurais no formato `{count, plural, one {# item} other {# itens}}`.
