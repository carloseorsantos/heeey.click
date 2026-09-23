# Heeey (heeey.click) — Lousa Interativa & Whiteboard Colaborativo

Aplicação web moderna de whiteboard e lousa vetorial baseada no componente oficial `@excalidraw/excalidraw`, com persistência na nuvem, colaboração multiplayer em tempo real via Supabase (Broadcast e Presence), acesso híbrido para convidados e login via Magic Link, além de um dashboard para gerenciamento de múltiplos quadros.

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
3. Cole e execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e depois de [`supabase/storage.sql`](supabase/storage.sql).

**Banco já existente?** Execute, em ordem, os arquivos de [`supabase/migrations/`](supabase/migrations/) que ainda não foram aplicados (ou use `supabase db push` com a Supabase CLI). Aplique as migrations **antes** de publicar o front-end que depende delas.

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
