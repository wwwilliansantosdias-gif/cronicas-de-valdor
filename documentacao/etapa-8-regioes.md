# Etapa 8 – Regiões 2 e 3 (Caverna e Ruínas)

Status: **implementada**, aguardando teste de Willian no celular.

## 1. O que entrou
| Região | Cidade | Área de caça | Níveis | Portal |
|---|---|---|---|---|
| 2 Caverna | Veio-Fundo (mercador, ferreiro, missões) | Galerias Rasas (64×44, 34 monstros em bandos + Golem do Veio) | 10–19 | abre no 10 em Pé-de-Lenha; em Veio-Fundo há portal de volta e o das Ruínas (nível 20) |
| 3 Ruínas | Cinzaltar | Campo das Lápides (64×44, 34 monstros + Rei Esquelético) | 20–29 | abre no 20; portal de volta para Veio-Fundo |

Os mapas continuam montados por regras a partir do texto (`docs/mapas/*.txt`). Novas chaves: `base:` (chão da região), `obstaculos:` (estilos: árvore, rocha, cristal, ruína) e `portal:` repetível (uma cidade pode ter vários). As peças de chão, obstáculos e "lagoa" de cada base estão em `docs/dados/cenario.json` (folha *Cavern and ruin tiles*, já creditada).

## 2. Monstros
Todos vistos antes no mostruário, todos com andar + ataque e aviso no chão antes do golpe.
- Caverna: Morcego, Gosma (poça em área), Minhoca (bote em área), Golem (pisão), chefe **Golem do Veio** (golem maior, investida e pisão).
- Ruínas: Esqueleto, Zumbi (envenena), Fantasma (investida), **Olho voador** (ataque novo: raio em linha; a direção trava no aviso, dá para sair da faixa), chefe **Rei Esquelético** (pisão, raio e golpe).

## 3. Itens: mais e melhores a cada região
Por região (`docs/dados/regioes.json`, campo `drops`):

| Região | Chance por monstro | Multiplicador de qualidade |
|---|---|---|
| Floresta | 8% | ×1,0 |
| Caverna | 12% | ×1,5 |
| Ruínas | 15% | ×2,0 |

O multiplicador age como a Sorte: aumenta o peso de Incomum, Raro e Lendário. Os itens que caem vão até o nível máximo da região (19 e 29), limitados a 2 níveis acima do jogador.

## 4. Ritmo: 10→20 não é mais meia hora
A curva de experiência ganhou faixas (`xp_faixas` em `progressao.json`): o custo de cada nível é `38 · n^1,6 · mult`, com mult 1 até o nível 9, 3,06 de 10 a 19 e 6,29 de 20 a 29. Calibrado com `node tools/simular.mjs 29 <classe>` (média de 20 jogadores simulados):

| Trecho | Guerreiro | Arqueiro |
|---|---|---|
| 1→10 | ~26 min | ~26 min |
| 10→20 | ~2 h (121 min) | ~1 h 50 (110 min) |
| 20→29 | ~4 h (241 min) | ~3 h 50 (229 min) |
| Mortes no total | ~8 | ~16 |

O arqueiro morre mais porque tem menos vida; o simulador supõe que ele recua e toma 35% dos ataques (o guerreiro, 50%). Os testes de motor exigem 10→20 entre 90 e 150 min e 20→29 entre 180 e 300 min, e menos de 4 mortes por hora.

## 5. Habilidades novas
| Classe | Habilidade | Nível | Forma | O que faz |
|---|---|---|---|---|
| Guerreiro | Terremoto | 12 | círculo raio 90 | atinge tudo em volta, bem maior que o Giro |
| Guerreiro | Investida | 20 | linha 120 | avança 100 px cortando todos no caminho |
| Arqueiro | Rajada | 12 | linha, 1 alvo | três flechas seguidas no mesmo alvo |
| Arqueiro | Perfurante | 20 | linha 280 | a flecha atravessa a fila inteira |

Ficam nos botões 3 e 4 (teclas 3 e 4). Sobem de grau com pontos de habilidade como as outras (dano, recarga e área). O Poder no topo da tela soma dano por segundo e vida efetiva (vida e defesa), então sobe com nível, atributos, itens, +N e conjuntos.

## 6. Testes
- Motor: novas habilidades (perfura, 1 alvo × 3, círculo maior, avanço), ritmo por faixa e quedas por região.
- Navegador: `tests/nav/fluxo.mjs` (portais de ida e volta, as duas áreas com bandos e chefes) e `tests/nav/habilidades.mjs` (Investida, Rajada e Perfurante no jogo).
