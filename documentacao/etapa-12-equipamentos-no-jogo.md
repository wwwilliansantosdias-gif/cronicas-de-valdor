# Etapa 12 – Sistema de equipamentos dentro do jogo, com balanceamento

Status: **implementada** (aprovada por Willian: "pode seguir, Lendários viram dourado-fogo"). Segue a etapa 11 (`etapa-11-equipamentos-lpc.md`).

## 1. Um só arquivo de itens
- `docs/dados/itens.json` passa a guardar, para cada item, os números (nível, dano, vida, defesa, preço) **e** o `formato` (peças do gerador e cor). Saem os caminhos de imagem escritos à mão (`visual`, `peca_lpc`), as rampas de cor antigas (`materiais`) e o brilho antigo do +N (`brilho`).
- O `catalogo_equipamentos.json` da etapa 11 deixa de existir: os itens dele entram no `itens.json`.
- Os 68 itens com aparência do jogo foram ligados automaticamente à sua definição oficial no gerador. Todos acharam uma, conferido por script.
- A aparência do herói (rosto, cabelo, barba) também passa a vir das definições do gerador. Cada opção de `aparencia.json` ganha a sua definição.
- Imagens: tudo em `docs/assets/lpc/`, baixado por `tools/build_definicoes.py`. A pasta antiga `docs/assets/pecas/` sai. Os créditos vêm do campo `credits` de cada definição.

## 2. Encaixes (11)
Os nomes internos antigos continuam, para não quebrar o save. Muda o nome mostrado e entram dois encaixes novos:

| Interno | Mostrado | Guerreiro | Arqueiro | Mago |
|---|---|---|---|---|
| arma | Arma | sim | sim | sim |
| escudo | Mão secundária | sim | — | — |
| capa | Costas | sim | sim | sim |
| capacete | Cabeça | sim | sim | sim |
| peitoral | Peito | sim | sim | sim |
| **sobre_peito** (novo) | Sobre o peito | sim | — | — |
| ombros | Ombros | sim | sim | sim |
| bracos | Braços | sim | sim | sim |
| grevas | Pernas | sim | sim | sim |
| botas | Pés | sim | sim | sim |
| **pescoco** (novo) | Pescoço | sim | sim | sim |

## 3. Raridades com números
O nome, as cores e os efeitos vêm de `raridades.json` (aprovado na etapa 11). Os números ficam em `itens.json` → `qualidades`:

| Raridade | Multiplicador de dano, vida e defesa | Atributos extras | Peso na queda |
|---|---|---|---|
| Comum | ×1,00 | 0 | 70 |
| Incomum | ×1,15 | 0 | 22 |
| Raro | ×1,35 | 1 | 6,2 |
| Épico | ×1,50 | 2 | 1,5 |
| Lendário | ×1,60 | 3 | 0,3 |

- Raro ou melhor continua em 8% das quedas, como antes (antes eram Raro 7 + Lendário 1).
- O Lendário fica bem mais raro e o Épico entra no meio.
- O chefe continua deixando Raro ou melhor.
- A Sorte e o multiplicador de cada região continuam valendo.

**Itens que já existem (save):** Refinado vira Incomum. Raro continua Raro. Lendário continua Lendário e ganha a cor dourado-fogo (decisão de Willian). O multiplicador dele não muda (×1,60), então ninguém perde nem ganha força na conversão.

## 4. Cor de cada item
- **Peças de metal e madeira:** a cor vem da raridade (ferro, bronze, prata, ouro, dourado-fogo).
- **Peças dos conjuntos de região têm cor própria fixa**, para manter a identidade: Mineiro em bronze, Cinzaltar e Arcano no roxo-cinza de Cinzaltar (nova cor do Valdor `cinzaltar`). A raridade continua mudando os efeitos.
- **Pano e couro:** cor fixa escolhida por item (capas, calças, capuz, mantos).
- **Peças cuja arte não está em nenhuma paleta** (algumas armas e escudos com cores prontas): ficam com a cor original e só os efeitos mudam (limite da arte, já visto na etapa 11).

## 5. Forja até +12
Cada +1 continua dando +10% em dano, vida e defesa do item. Falhar continua sem quebrar e sem perder o +N.

| Nível | +1 | +2 | +3 | +4 | +5 | +6 | +7 | +8 | +9 | +10 | +11 | +12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Chance | 100% | 100% | 80% | 60% | 40% | 35% | 30% | 25% | 20% | 16% | 13% | 10% |
| Ouro | 40 | 70 | 110 | 160 | 220 | 300 | 400 | 520 | 660 | 820 | 1000 | 1200 |
| Fragmentos | 0 | 1 | 2 | 3 | 5 | 6 | 8 | 10 | 13 | 16 | 20 | 25 |

A curva segue a média das referências: as chances caem e os custos sobem cada vez mais rápido. O simulador de ritmo supõe itens comuns sem reforço, então o tempo até cada nível não depende da forja.

## 6. Itens novos (números pelo nível, como os vizinhos)
| Item | Encaixe | Classe | Nível | Valores |
|---|---|---|---|---|
| Alabarda | arma | Guerreiro | 14 | dano 8,8 |
| Escudo de madeira | Mão secundária | Guerreiro | 6 | vida 7, defesa 11 |
| Escudo reforçado | Mão secundária | Guerreiro | 16 | vida 13, defesa 21 |
| Elmo de viseira | Cabeça | Guerreiro | 16 | vida 8, defesa 8 |
| Elmo de crista | Cabeça | Guerreiro | 24 | vida 12, defesa 12 |
| Elmo fechado | Cabeça | Guerreiro | 28 | vida 14, defesa 14 |
| Tabardo vermelho / azul / negro | Sobre o peito | Guerreiro | 4 / 14 / 24 | vida e defesa 3 / 6 / 9 |
| Amuleto de estrela | Pescoço | todas | 6 | vida 6 |
| Pedra redonda | Pescoço | todas | 16 | vida 12 |
| Amuleto de cruz | Pescoço | todas | 26 | vida 18 |

## 7. Efeitos no jogo
- **Na arma:** contorno, pulsar, clarão no golpe ou disparo, partículas paradas na arma, rastro (flecha e espada), estouro no inimigo atingido e aura no chão. Tudo pela raridade e pelo reforço da arma (tabela da etapa 11).
- O brilho antigo do +N e a tinta antiga das qualidades saem (o sistema novo os substitui).
- A aura dos conjuntos completos continua.
- **Menu → "Efeitos: ligados/desligados"** guarda a escolha no aparelho, para celular fraco.

## 8. Save versão 5
- Refinado vira Incomum.
- Entram os encaixes `sobre_peito` e `pescoco`, vazios.
- O +N continua, agora válido até 12.
- Nada se perde. Há teste de migração da v4 para a v5 e de toda a cadeia v1→v5.

## 9. Testes
- **Motor:** raridades novas (pesos, Sorte, chefe), forja até +12 (chance medida igual à tabela, nunca quebra), migração v4→v5, encaixes e classes, camadas do personagem com aparência, ritmo das 3 classes.
- **Dados:** todo item com formato existente, imagens presentes e creditadas, conjuntos com cores fixas.
- **Navegador:** os testes do jogo continuam passando, mais:
  - os 11 encaixes cabem na tela;
  - o item aparece no boneco;
  - a chave de efeitos funciona;
  - a forja chega a +12.

## 10. Resultado
- **Ritmo** (simulador, 20 jogadores):

| Classe | 1→10 | 10→20 | 20→29 | Mortes |
|---|---|---|---|---|
| Guerreiro | 29 min | 2 h | 3 h 40 | quase nenhuma |
| Arqueiro | 29 min | 2 h | 4 h 15 | quase nenhuma |
| Mago | 30 min | 2 h | 3 h 45 | quase nenhuma |

  Os testes de ritmo continuam passando.
- **Imagens:** são carregadas aos poucos. As do equipamento vestido carregam antes do primeiro quadro. As da mochila carregam ao abrir a tela do personagem e ao pegar um item do chão. Por isso vestir é instantâneo.
- **Limites da arte que continuam:** algumas armas e escudos, cuja arte não está em nenhuma paleta, não mudam de cor com a raridade e ganham só os efeitos: espada longa, maça, sabre, florete, escudo redondo, escudo cruzado e cajado de diamante.
