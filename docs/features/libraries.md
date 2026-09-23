# Bibliotecas de Componentes (Libraries)

O Heeey integra-se profundamente ao ecossistema de bibliotecas do Excalidraw, permitindo salvar ícones, diagramas de arquitetura, wireframes e blocos gráficos reutilizáveis para agilizar sua rotina.

---

## 📦 O que são Bibliotecas?

No Excalidraw, uma biblioteca é uma coleção de itens compostos por um ou mais elementos gráficos pré-fabricados (por exemplo: ícones de serviços AWS, símbolos UML, botões de UI ou ilustrações).

No Heeey, você pode:
- Salvar qualquer seleção de elementos do canvas diretamente na sua biblioteca pessoal.
- Navegar pela biblioteca oficial pública do Excalidraw e instalar pacotes prontos com um clique.
- Arrastar itens da sua biblioteca diretamente para qualquer quadro.

---

## ☁️ Persistência na Nuvem vs. Cache Local

O Heeey implementa um adaptador sob medida (`createLibraryAdapter` via `useHandleLibrary`):

| Contexto do Usuário | Onde os Itens são Armazenados | Comportamento |
|---|---|---|
| **Usuário Autenticado** | Tabela `user_libraries` no Supabase + Cache Local | Sincronização em nuvem automática. A biblioteca pessoal acompanha o usuário em qualquer navegador ou computador. Se estiver temporariamente offline, o cache local garante leitura e escrita sem erros. |
| **Convidado / Não Autenticado** | `localStorage` (`heeey_library`) | Mantida com segurança no navegador atual do dispositivo. |

---

## 🔄 Migração Automática no Primeiro Login

Se você utilizou o Heeey como visitante e construiu uma biblioteca de elementos personalizada, você não precisa exportá-la manualmente:

- Quando você entra na sua conta pela primeira vez (via Magic Link), o adaptador de migração (`createGuestLibraryMigration`) é acionado.
- Ele lê automaticamente os itens de `localStorage` e os envia para a sua conta na tabela `user_libraries`.
- O cache temporário anônimo é limpo com segurança e seus itens passam a estar disponíveis na nuvem.
