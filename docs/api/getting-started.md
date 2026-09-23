# Começando com a API (API Getting Started)

> Crie seu primeiro quadro programaticamente no Heeey em menos de 3 minutos.

A API REST v1 do **Heeey** permite criar, consultar, atualizar e organizar lousas e diagramas diretamente via código, scripts de automação, webhooks ou agentes autônomos.

---

## ⚡ Passo 1: Gerar sua Chave de API

Todas as chamadas à API são autenticadas por uma **Chave Pessoal de API** vinculada à sua conta:

1. Acesse o [heeey.click](https://heeey.click) e entre na sua conta (via Magic Link).
2. No Dashboard, clique no ícone de chave (**Chaves de API**) no cabeçalho superior.
3. Clique em **"Criar Nova Chave"**:
   - Dê um nome para a chave (ex.: `script-teste`).
   - Marque os escopos de **Leitura** (`read`) e **Escrita** (`write`).
4. Copie a chave gerada (`hk_...`). Ela só é exibida uma única vez.

---

## 🚀 Passo 2: Criar seu Primeiro Quadro

Envie uma requisição `POST` para `/api/v1/boards` com o título do quadro e formas básicas.

Você pode usar o formato resumido de elementos (**Element Spec**), passando apenas tipo, coordenadas e o texto (`label`):

```bash
curl -X POST https://heeey.click/api/v1/boards \
  -H "Authorization: Bearer hk_SUA_CHAVE_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Primeiro Fluxo via API",
    "elements": [
      {
        "id": "step-1",
        "type": "rectangle",
        "x": 100,
        "y": 150,
        "label": "Início do Processo",
        "backgroundColor": "#a5d8ff",
        "strokeColor": "#1971c2"
      },
      {
        "id": "step-2",
        "type": "diamond",
        "x": 380,
        "y": 135,
        "label": "Aprovado?",
        "backgroundColor": "#ffec99",
        "strokeColor": "#f08c00"
      },
      {
        "type": "arrow",
        "start": { "id": "step-1" },
        "end": { "id": "step-2" },
        "label": "submete"
      }
    ]
  }'
```

### Resposta de Sucesso (`201 Created`):
```json
{
  "board": {
    "id": "e67e3a1e-8e89-4089-a5f1-382a39281a92",
    "title": "Primeiro Fluxo via API",
    "folder_id": null,
    "access_level": "edit",
    "created_at": "2026-09-23T14:00:00Z",
    "updated_at": "2026-09-23T14:00:00Z",
    "deleted_at": null,
    "element_count": 5,
    "url": "https://heeey.click/b/e67e3a1e-8e89-4089-a5f1-382a39281a92"
  }
}
```

> **Dica**: Copie o link retornado em `url` e abra-o no seu navegador para ver o quadro desenhado com as cores e vinculações magnéticas perfeitamente ajustadas!

---

## 👁️ Passo 3: Consultar os Dados do Quadro

Para ler o estado atual do quadro criado:

```bash
curl -X GET https://heeey.click/api/v1/boards/e67e3a1e-8e89-4089-a5f1-382a39281a92 \
  -H "Authorization: Bearer hk_SUA_CHAVE_AQUI"
```

A resposta conterá os metadados do quadro e o array completo `elements` com todos os objetos vetoriais Excalidraw renderizáveis.

---

## 🔴 Passo 4: Atualização em Tempo Real (Live Update)

Deixe o quadro aberto em uma aba do navegador e execute a chamada `PATCH` abaixo para adicionar uma nova etapa ao fluxo:

```bash
curl -X PATCH https://heeey.click/api/v1/boards/e67e3a1e-8e89-4089-a5f1-382a39281a92 \
  -H "Authorization: Bearer hk_SUA_CHAVE_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "elements": [
      {
        "id": "step-3",
        "type": "rectangle",
        "x": 650,
        "y": 150,
        "label": "Produção Concluída",
        "backgroundColor": "#b2f2bb",
        "strokeColor": "#2f9e44"
      },
      {
        "type": "arrow",
        "start": { "id": "step-2" },
        "end": { "id": "step-3" },
        "label": "sim"
      }
    ]
  }'
```

Olhe para a aba do navegador: o novo bloco e a seta aparecerão instantaneamente na tela sem você recarregar a página! O Heeey faz o broadcast das alterações pelo canal Supabase Realtime automaticamente.

---

## 📚 Próximos Passos

- Conheça o formato detalhado de formas, rótulos e setas no [Esquema de Conteúdo da Cena](scene-content-schema.md).
- Consulte todos os métodos disponíveis na [Referência de Endpoints](endpoints.md).
- Entenda como paginar resultados em [Paginação](pagination.md).
- Conheça os limites de tamanho de payload em [Taxas & Limites Operacionais](rate-limiting.md).
