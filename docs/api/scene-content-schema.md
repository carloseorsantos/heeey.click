# Esquema de Conteúdo da Cena (Element Spec)

O Heeey foi projetado para que você e modelos de IA não precisem montar objetos verbosos com as dezenas de propriedades internas do formato nativo do Excalidraw. A API e as ferramentas MCP aceitam uma especificação enxuta (**Element Spec**) e preenchem automaticamente posições, fontes, caixas delimitadoras e vinculações magnéticas.

Elementos nativos completos do Excalidraw continuam sendo 100% suportados e passam direto pelo conversor.

---

## 🧩 O Formato Resumido (Element Spec)

Qualquer elemento no array `elements` pode ser descrito com os seguintes campos essenciais:

```typescript
interface ElementSpec {
  /** Identificador estável do elemento (opcional; gerado automaticamente se omitido) */
  id?: string;
  /** Tipo da forma ou traço */
  type: 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'arrow' | 'line' | 'frame';
  /** Coordenadas no canvas em pixels */
  x?: number;
  y?: number;
  /** Dimensões (opcionais; calculadas automaticamente a partir do label quando omitidas) */
  width?: number;
  height?: number;
  /** Rótulo exibido dentro da forma ou sobre a seta */
  label?: string | { text: string; fontSize?: number };
  /** Conteúdo textual direto (obrigatório para type: "text") */
  text?: string;
  fontSize?: number;
  /** Cores em formato CSS (#hex, rgb, etc.) */
  strokeColor?: string;
  backgroundColor?: string;
  /** Extremidades conectadas para setas (apontando para o id da forma de origem/destino) */
  start?: { id: string };
  end?: { id: string };
  /** Pontos relativos para setas e linhas manuais: [[0, 0], [200, 50]] */
  points?: [number, number][];
}
```

---

## 🎨 Exemplos Práticos por Tipo de Elemento

### 1. Formas com Texto Interno Centralizado (`rectangle`, `ellipse`, `diamond`)
Basta passar a propriedade `label`. O servidor cria a forma geométrica e um elemento de texto acoplado (`boundElements` e `containerId`) perfeitamente centralizado:

```json
{
  "id": "node-auth",
  "type": "rectangle",
  "x": 100,
  "y": 150,
  "label": "Serviço de Autenticação",
  "backgroundColor": "#a5d8ff",
  "strokeColor": "#1971c2"
}
```

Para uma decisão condicional em um fluxograma:
```json
{
  "id": "node-check",
  "type": "diamond",
  "x": 380,
  "y": 130,
  "label": "Token Válido?",
  "backgroundColor": "#ffec99"
}
```

### 2. Setas Conectadas e Magnéticas (`arrow`)
Para ligar duas formas, utilize as propriedades `start` e `end` informando os IDs correspondentes. O Heeey calcula o centro das formas, direciona os pontos da seta e aplica o espaçamento correto das bordas (`gap: 8px`):

```json
{
  "id": "arrow-auth-check",
  "type": "arrow",
  "start": { "id": "node-auth" },
  "end": { "id": "node-check" },
  "label": "valida token"
}
```

> **Dica**: As setas podem se conectar a formas enviadas na mesma requisição ou a formas que **já existiam anteriormente no quadro**!

### 3. Texto Avulso (`text`)
Para cabeçalhos, títulos ou anotações livres:

```json
{
  "type": "text",
  "x": 100,
  "y": 50,
  "text": "Arquitetura do Sistema v2",
  "fontSize": 24,
  "strokeColor": "#1e1e1e"
}
```

### 4. Molduras / Painéis de Agrupamento (`frame`)
Para delimitar áreas funcionais ou seções de um diagrama:

```json
{
  "id": "frame-backend",
  "type": "frame",
  "x": 50,
  "y": 80,
  "width": 600,
  "height": 400,
  "label": "Zona Segura / VPC"
}
```

---

## 🧠 Valores Padrão Atribuídos Automaticamente

Quando campos cosméticos são omitidos na especificação, o Heeey aplica valores estéticos consistentes:

- **Fonte**: Família 5 (`Excalifont`, fonte padrão manual do Excalidraw).
- **Tamanhos Padrão de Formas**:
  - `rectangle`: 180 × 80 px (expande conforme o texto).
  - `ellipse`: 140 × 100 px.
  - `diamond`: 180 × 110 px.
- **Cores Padrão**:
  - `strokeColor`: `#1e1e1e`
  - `backgroundColor`: `transparent`
  - `fillStyle`: `solid`
  - `roughness`: `1` (estilo desenhado à mão característico)
  - `opacity`: `100`

---

## 🔄 Visão Compacta (`describeElements`)

Ao fazer chamadas de leitura com formatos otimizados para modelos de linguagem (como nas ferramentas MCP), o Heeey faz o processo inverso de descompressão:
- Rótulos acoplados a formas são reincorporados na propriedade `label` da forma receptora.
- Setas revelam `start: { id }` e `end: { id }`.
- Coordenadas flutuantes são arredondadas para inteiros.
- Essa compactação economiza até 80% dos tokens consumidos pela janela de contexto do LLM.
