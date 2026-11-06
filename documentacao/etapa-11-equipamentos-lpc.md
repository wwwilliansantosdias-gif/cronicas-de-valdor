# Etapa 11 – Sistema de equipamentos a partir das definições do gerador LPC

Status: **documentação, testes, código e página de aprovação feitos; ainda fora do jogo.** O jogo continua com o sistema da etapa 7 até Willian aprovar a página `docs/equipamentos/` e até a etapa de balanceamento dar números aos itens novos.

## 1. Fonte da verdade
Repositório oficial do gerador: `LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator`. O que é lido de lá e onde:

| Pasta do gerador | O que é usado |
|---|---|
| `sheet_definitions/` | camadas (`layer_N`), ordem (`zPos`), animações, variantes de cor, `recolors` e créditos de cada item |
| `palette_definitions/` | paletas `metal` (base: steel), `wood` (base: maple), `cloth` (base: white) |
| `spritesheets/` | as imagens PNG |
| `sources/state/constants.ts` e `sources/custom-animations.ts` | tamanho e ordem dos quadros (o README do gerador não traz esses números) |

`tools/build_definicoes.py` baixa só as definições e imagens que o catálogo usa e gera `docs/dados/lpc_definicoes.json`. As imagens vão para `docs/assets/lpc/`. Item, caminho ou cor que não exista nas definições faz o script parar com erro, para nunca inventar nada.

### Tamanho e ordem dos quadros (conferidos no código do gerador)
Cada folha de animação tem 4 linhas: costas, esquerda, frente, direita.

| Animação | Quadros | Tamanho do quadro |
|---|---|---|
| andar (`walk`) | 9 (o 0 é parado) | 64 px |
| golpear (`slash`) | 6 | 64 px |
| estocar (`thrust`) | 8 | 64 px |
| atirar (`shoot`) | 13 | 64 px |
| `walk_128` (arco andando) | 9 | 128 px |
| `slash_oversize`, `thrust_oversize` (armas grandes) | 6 e 8 | 192 px |

Quadros maiores que 64 px são desenhados centrados no boneco.

## 2. Personagem em camadas
- Cada parte do boneco (corpo, cabeça, cabelo, cada camada de cada item) recebe o `zPos` da sua definição. O desenho é feito do menor para o maior.
- Exemplos: arco atrás do corpo (−1) e na frente (140). Capa atrás (5) e na frente (85). Aljava (8), corpo (10), calça (20), botas (25), peitoral (60), cabeça (100), cabelo (120), elmo (130), viseira (132), enfeite do elmo (139).
- Trocar um equipamento troca só as camadas dele.

## 3. Cores
Uma cor de item é escrita como `material.nome`, por exemplo `metal.gold`, `wood.oak`, `cloth.leather` ou `valdor.gelo`.
- **Item com `recolors`** (elmos, armaduras, escudo de madeira, capas, botas): uma imagem base e troca de paleta no jogo. Cada cor da paleta-base vira a cor da mesma posição na escolhida, com tolerância de ±1 por canal, como no gerador.
- **Item só com variantes prontas** (arcos, armas do guerreiro, amuleto, tabardo): se a variante com o mesmo nome existe (`gold`, `steel`, `bronze`…), usa a imagem pronta. Se não existe (madeiras e cores do Valdor), troca a paleta da imagem base. Para os arcos a base está na madeira `maple`. Conferido: trocar `maple` por `oak` reproduz a variante `medium` oficial sem nenhum pixel diferente.
- **Cores do Valdor**: `docs/dados/paletas_valdor.json` (gelo, fogo, veneno, sombra…). Cada uma é uma escala de 6 tons, do escuro ao claro, igual às paletas do gerador.
- **Desempenho:** a troca de cor acontece só ao carregar ou trocar o item. O resultado fica guardado na memória, e nada é refeito a cada quadro.

## 4. Encaixes
| Encaixe | Guerreiro | Arqueiro |
|---|---|---|
| Arma | espada longa, maça, machado de guerra, lança | arco normal, recurvo, grande |
| Mão secundária | escudos | — |
| Costas | capa | capa (a aljava já vem com a classe, sempre visível) |
| Cabeça | elmo + viseira + enfeite (um item com várias partes) | capuz ou elmo leve |
| Peito | placas, legionária | couro |
| Sobre o peito | tabardo | — |
| Ombros | ombreiras | — |
| Braços | braço de armadura, luvas | braçadeiras, luvas |
| Pernas | perneira de armadura | calça |
| Pés | botas | botas |
| Pescoço | amuleto ou pedra | amuleto ou pedra |

**Fora por decisão:** besta (sem animação de atirar no LPC), bumerangue e estilingue.
**Mago:** fica com o sistema da etapa 10 até ganhar a sua linha no catálogo.

## 5. Item no catálogo (`docs/dados/catalogo_equipamentos.json`)
Cada item tem:
- `id` e `nome` em português;
- `classes` e `encaixe`;
- `formato`: uma ou mais partes, cada parte é uma definição do gerador;
- `cor`: `"raridade"` (vem da tabela de raridade) ou uma cor fixa (para pano e couro);
- `raridade` e `reforco` iniciais.

Não há dano, defesa nem vida: isso fica para a etapa de balanceamento.

## 6. Raridade (`docs/dados/raridades.json`, proposta ajustável)
| Raridade | Cor do item (metal / madeira) | Efeitos | Cor do nome |
|---|---|---|---|
| Comum | ferro / carvalho | nenhum | branco |
| Incomum | bronze / bronze | nenhum | verde |
| Raro | prata / prata | contorno fraco | azul |
| Épico | ouro / ouro | contorno, pulsar, clarão no ataque, estouro no impacto | roxo |
| Lendário | gelo do Valdor | tudo acima, partículas, rastro e aura | laranja dourado |

Cada raridade também tem a cor do brilho (`brilho`): creme, verde, azul, dourado, e no Lendário a cor do próprio item.

Arqueiro: 3 formatos × 5 raridades = 15 degraus visuais, mais o reforço.

**Reforço +0 a +12:** a força do brilho e a quantidade de partículas sobem a cada nível. A partir de +4 qualquer item ganha contorno, a partir de +7 partículas e a partir de +10 aura. A forja do jogo continua indo até +5 até o balanceamento definir custo e chance de +6 a +12.

**Relação com o jogo de hoje:** as qualidades atuais (Comum, Refinado, Raro, Lendário) seguem valendo no jogo. A troca para as 5 raridades depende do balanceamento, porque peso de queda e multiplicador são números.

## 7. Efeitos (camada própria, por cima)
Contorno brilhante, pulsar, clarão no ataque, partículas paradas no item (com a cor do próprio item), rastro da flecha, estouro no impacto, aura no chão, e cor do nome e da moldura conforme a raridade.
- Tudo é ligado pela tabela de raridade e pelo reforço.
- As partículas têm limite (`limites.particulas_max`).
- Há uma chave para desligar os efeitos, pensando em celular fraco.
- O contorno é preparado uma vez por imagem e guardado, não é recalculado a cada quadro.

## 8. Créditos
`tools/build_definicoes.py` junta o campo `credits` de cada definição usada (autores, licenças, links). `tools/build_mostruario.py` coloca essa lista em `CREDITOS.md`, que é o texto da tela de Créditos do jogo. O código (`creditosDoCatalogo`) recusa item sem crédito.

## 9. Testes
- **`tests/js/equipamento.test.js`:**
  - ordem das camadas;
  - troca de paleta e derivação das cores do Valdor;
  - memória das imagens recoloridas;
  - leitura da tabela de raridade;
  - efeitos ligando e desligando por raridade, reforço e chave geral;
  - recusa de encaixe ou classe errados;
  - créditos.
- **`tests/test_catalogo.py`:** todo formato existe nas definições, toda imagem existe e está creditada.
- **`tests/nav/equipamentos.mjs`:** a página de aprovação abre, desenha os 15 arcos e reage ao seletor de reforço e à chave de efeitos.

## 10. O que a arte LPC limitou (achados ao construir)
- **Arco grande:** a definição prevê uma parte de trás para a animação de atirar, mas a imagem não existe no gerador. Ela é pulada, como o próprio gerador faz.
- **Espada longa e maça:** as imagens não estão pintadas em nenhuma paleta (15% e 46% dos pixels batem). Por isso não trocam de cor com a raridade e só ganham os efeitos. O machado de guerra e a alabarda batem com a paleta prata e trocam de cor normalmente.
- **Lança comum e lança longa:** não têm a animação de golpear, então entrou a **alabarda** (que tem golpe e estocada) para o grupo das lanças.
- **Maça e machado de guerra:** não têm estocada; usam o golpe no lugar, como a regra já aprovada para as armas sem estocar.
- **Amuleto:** as cores são combinações prontas de metal e pedra (ex.: ouro com azul). O amuleto não muda com a raridade, só os efeitos.
