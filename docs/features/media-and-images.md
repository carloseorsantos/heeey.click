# Imagens & Otimização de Mídia

Colar ou arrastar capturas de tela e fotografias pesadas diretamente em uma lousa interativa pode degradar drasticamente o desempenho de renderização e o consumo de largura de banda de todos os colaboradores. O Heeey possui um pipeline especializado e automatizado de processamento de mídia no cliente.

---

## ⚡ Pipeline de Otimização Automática

Sempre que uma imagem é **colada** (`Ctrl+V` / `Cmd+V`) ou **arrastada** (*drag & drop*) para o canvas:

```
[Imagem Original] 
       │
       ▼ (Interceptação no navegador)
[Redimensionamento Proporcional: max 1600px]
       │
       ▼ (Compressão Canvas 2D)
[Conversão para WebP / Qualidade 0.8 (Meta < 150 KB)]
       │
       ├───► Sucesso ────► Upload assíncrono para Supabase Storage: board-media/{boardId}/{fileId}.webp
       │
       └───► Fallback ───► Preserva DataURL em base64 localmente caso offline ou storage indisponível
```

---

## 📊 Regras de Dimensionamento e Compressão

1. **Limite Dimensional (`MAX_IMAGE_DIMENSION`)**:
   - Nenhuma imagem é inserida no quadro com largura ou altura superior a **1600px**. O aspecto original é rigorosamente mantido.
2. **Compressão para WebP**:
   - Imagens são codificadas nativamente em formato **WebP** com qualidade `0.8`, resultando geralmente em arquivos menores que **150 KB** (uma economia de 70% a 90% em comparação com PNGs brutos de telas Retina).
   - Se o navegador não suportar exportação WebP no elemento Canvas, o pipeline recorre automaticamente a **JPEG** com preenchimento de fundo branco (evitando que áreas transparentes fiquem pretas).
3. **Posicionamento Inteligente no Canvas**:
   - A imagem é inserida centralizada no campo de visão atual do usuário (`viewportCoordsToSceneCoords`).
   - Imagens excessivamente amplas recebem uma escala visual padrão de exibição inicial (máx 600px) para não cobrir outros elementos já desenhados na tela.

---

## 🗄️ Armazenamento no Supabase (`board-media`)

- As imagens otimizadas são armazenadas no bucket público `board-media` do Supabase Storage no caminho:
  ```
  board-media/{boardId}/{fileId}.webp
  ```
- **Políticas de Acesso RLS no Storage**:
  - Leitura pública para qualquer visitante que possua o link do quadro.
  - Upload permitido para qualquer pessoa com permissão de edição no quadro.
  - Exclusão permitida apenas ao proprietário do quadro durante a exclusão permanente.
- **Fallback Resiliente**: Se o bucket não estiver configurado ou se a conexão cair, o Heeey armazena a imagem como DataURL em base64 diretamente nos metadados do quadro, garantindo que o usuário nunca perca seu trabalho.
