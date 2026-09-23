# Motor de Layout Automático de Diagramas

Desenhar diagramas bonitos através de modelos de linguagem costuma ser um desafio: LLMs não possuem percepção espacial nativa de pixels, resultando frequentemente em caixas sobrepostas, setas que cruzam formas e textos cortados.

O Heeey resolve esse problema com um motor de layout determinístico embutido no servidor (`diagramLayout.ts`), construído sobre o algoritmo em camadas de Sugiyama via **Dagre**.

---

## 🏗️ Como Funciona o Algoritmo

Quando o agente invoca a ferramenta `create_diagram` ou `layout_board`:

```
[Nós & Arestas Simples]
         │
         ▼
1. Cálculo Textual & Auto-Wrap:
   - Mede as dimensões reais do texto com base na fonte Excalifont.
   - Aplica quebra automática de palavras (word wrap) em largura ideal.
   - Expande retângulos, elipses e losangos para acomodar o texto com folga interna (padding).
         │
         ▼
2. Algoritmo em Camadas (Sugiyama via Dagre):
   - Atribui nós a camadas sequenciais conforme a direção do fluxo (TB, LR, BT, RL).
   - Minimiza cruzamento de setas (crossing reduction).
   - Distribui espaçamentos harmônicos (nodeSpacing: 50px, rankSpacing: 70px).
         │
         ▼
3. Roteamento Inteligente de Setas & Polyline:
   - As arestas dobram suavemente ao redor das formas para evitar colisão.
   - Aplica o recuo das pontas (`trimEnds`) para que as pontas de seta não toquem a borda das caixas.
   - Vincula magneticamente o início e o fim aos nós correspondentes.
         │
         ▼
[Cena Excalidraw Pronta & Transmitida ao Vivo]
```

---

## 🧭 Direções de Fluxo Suportadas (`direction`)

O parâmetro `direction` define a orientação geral do diagrama:

| Direção | Nome | Uso Típico |
|---|---|---|
| `'TB'` (Padrão) | *Top to Bottom* | Fluxogramas verticais, organogramas, árvores de decisão. |
| `'LR'` | *Left to Right* | Pipelines de CI/CD, esteiras de dados, jornadas do usuário. |
| `'BT'` | *Bottom to Top* | Modelagens de camadas inferiores para superiores. |
| `'RL'` | *Right to Left* | Diagramas com sentido reverso ou fluxos de retorno. |

---

## 🎨 Paleta de Cores dos Nós

O motor possui uma paleta de 6 tons pastéis selecionados da estética nativa do Excalidraw:

| Cor (`color`) | Cor de Traço (`strokeColor`) | Cor de Fundo (`backgroundColor`) | Significado Sugerido |
|---|---|---|---|
| `'blue'` | `#1971c2` | `#a5d8ff` | Serviços, bancos de dados, nós neutros |
| `'green'` | `#2f9e44` | `#b2f2bb` | Sucesso, nós finais, aprovação |
| `'yellow'` | `#f08c00` | `#ffec99` | Decisões, avisos, filas, processamento |
| `'red'` | `#e03131` | `#ffc9c9` | Erros, falhas, zonas críticas |
| `'violet'` | `#6741d9` | `#d0bfff` | Usuários, clientes externos, gateways |
| `'gray'` | `#495057` | `#e9ecef` | Componentes secundários, infraestrutura |

---

## 📍 Posicionamento ao Lado de Conteúdo Existente (`originBeside`)

Se você instruir o agente a adicionar um diagrama em um quadro que **já possui desenhos existentes** (passando o parâmetro `board_id`):

- O motor calcula a caixa delimitadora (*bounding box*) de todos os elementos vivos atualmente na lousa.
- Posiciona o novo diagrama automaticamente **à direita do conteúdo anterior** com uma margem de segurança de `160px`.
- Dessa forma, nenhum desenho existente é sobrescrito ou tampado!
