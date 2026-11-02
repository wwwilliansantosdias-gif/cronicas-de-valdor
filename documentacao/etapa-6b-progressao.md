# Etapa 6b – Progressão: atributos, itens, habilidades e monstros

Status: **aprovada por Willian** (benchmark e recorte). Passo 1 implementado; passos 2 a 10 seguem a ordem abaixo.

## 1. Referências (benchmark de sistemas, não cópia)

| Jogo | Atributos | Itens | Combate |
|---|---|---|---|
| Conquer Online | ~3 pontos por nível; automáticos até o renascimento | mesma peça em qualidades Normal → Refinado → Único → Elite → Super; "+1 a +12"; encaixes | ataques básicos e de área |
| Kritika | sem pontos; cresce pelo nível e pelo equipamento | graus por nível; melhoria +0 a +15, risco de quebrar acima de +9 (ligado à loja) | habilidades e combos por classe |
| Diablo 2 | 5 pontos de atributo e 1 de habilidade por nível; habilidade liberada por nível | sorteia o item e depois a qualidade; "encontrar mágicos" só melhora a qualidade, com retorno decrescente; chefe sempre larga mágico | habilidades com pontos |

Médias usadas onde não houve decisão explícita: **cerca de 16 monstros por área (cerca de 10 visíveis)** e **nível 10 em cerca de 30 minutos**. As fontes não trazem números oficiais de ritmo; são estimativas de ordem de grandeza, garantidas pelo simulador.

## 2. Recorte pelas nossas restrições
- Item precisa de peça LPC: a variedade vem da qualidade e do +N, não de muitos visuais (Conquer).
- Sem loja: melhoria pode falhar, mas **nunca destrói** o item (Kritika sem a parte da loja).
- 29 níveis e 3 regiões: sem renascimento, encaixes, Meteoros ou +15.

## 3. Contratos (formato que não muda)
- **Atributos** Força, Vitalidade, Agilidade e Sorte, começando em 5; **3 pontos por nível**, manuais, com botão "recomendado" (padrão por classe em `classes.json`; Guerreiro 2 Força : 1 Vitalidade). **Redistribuir** custa 25 de ouro × nível.
- **Fórmulas** em `dados/progressao.json`: dano = 6 + 1,5×Força + arma; vida = 60 + 8×Vitalidade + armaduras; recarga −2% por Agilidade (mínimo 70%); crítico 1% por Sorte (máximo 25%, ×1,5).
- **Item** = base (peça LPC) + qualidade + "+N". Qualidades: Comum ×1, Refinado ×1,15, Raro ×1,35 (+1 atributo), Lendário ×1,6 (+2 atributos). Melhoria até +5 (+10% cada), chance 100/100/80/60/40%, falha sem quebrar. Espaços: arma, capacete, peitoral, grevas; mochila de 20.
- **Queda** (passo 3): ~8% por monstro, chefe sempre; sorteia base e depois qualidade (pesos 70/22/7/1); Sorte só melhora a qualidade, com retorno decrescente; chefe garante Raro ou melhor.
- **Habilidades** como dados (`habilidades.json`: forma arco/linha/círculo, alcance, multiplicador, recarga, animação). 3 por classe, liberadas nos níveis 1, 3 e 6; 1 ponto de habilidade a cada 3 níveis; grau máximo 5 (+10% de dano e −5% de recarga por grau).
- **Save v2** com migração do v1 (pontos acumulados viram livres; "afiar" vira o +N da espada). Toda versão nova do save traz migração.

## 4. Ordem de construção
1. ✅ Base: save v2 e migração, atributos e fórmulas, habilidades como dados, simulador de ritmo.
2. ✅ Tela de atributos (manual, recomendado, redistribuir).
3. ✅ (adiantado a pedido) Estocada e Giro, com pontos de habilidade.
4. ✅ (adiantado a pedido) Ataques distintos dos monstros, com aviso visível.
5. ✅ (adiantado a pedido) Mais monstros por área, em bandos; só os próximos ativos; desempenho medido.
6. ✅ Drops, mochila e equipar (números).
7. Qualidades e cores; ferreiro com melhoria até +5 e fragmentos.
8. Mais peças visuais por espaço.
9. Arqueiro.
10. Regiões 2 e 3.
11. Som.

## 5. Resultado do passo 1
- Curva de experiência calibrada pelo simulador (`node tools/simular.mjs 10`): `xp_base` 33 → **nível 10 em cerca de 30 minutos**, cerca de 370 abates (média de 20 simulações). Monstros da região 1 com o dobro de vida, para cerca de 2 a 4 s por abate como nas referências.
- Mudanças visíveis: entrar na cidade restaura a vida (antes não havia como curar sem poção); o "afiar" do ferreiro passou a dar +10% no dano da arma, provisório até o passo 4.
- O teste de ritmo falha se uma mudança de números tirar o nível 10 da faixa de 25 a 35 minutos.

## 6. Resultado do passo 2
- Botão "Atrib." no topo; vira "+N" pulsando quando há pontos livres. Tela com "+1" por atributo, valores derivados (dano, vida, recarga, crítico), "Recomendado", "Distribuir sozinho" (liga/desliga) e "Redistribuir" (só na cidade, 25 de ouro × nível).
- Personagem novo começa no modo manual; saves anteriores mantêm o modo em que estavam.
- Redistribuir desliga o modo automático (senão os pontos devolvidos voltariam para o mesmo lugar sozinhos).
- Save com pontos inconsistentes com o nível é consertado ao carregar, nunca descartado.
- "Fechar" passou para o canto do título em todas as telas; a tela de atributos cabe sem rolar em 844×390 (teste de navegador).

## 7. Resultado dos passos 3 a 5 (adiantados porque eram o que mais mudava o jogo)
- **Habilidades do Guerreiro:** Golpe (arco à frente), Estocada (nível 3; linha longa, 140%, empurra; animação de estocar do gerador LPC) e Giro (nível 6; círculo em volta, 120%, 1,5 alvo em média). Botões próprios à direita mostram "Nv 3"/"Nv 6" até liberar e os segundos de recarga depois. Teclado: 1 e 2.
- **Pontos de habilidade:** 1 a cada 3 níveis; tela "Habilidades" (dentro de Atributos) sobe o grau até 5 (+10% de dano e −5% de recarga por grau). Save confere e conserta os graus.
- **Ataques dos monstros** (`ataques` em `dados/monstros.json`), todos com aviso antes do golpe:
  - Goblin: corpo a corpo ("!" amarelo acima da cabeça).
  - Javali: investida em linha reta, faixa vermelha no chão; a direção trava no aviso, então dá para sair da linha.
  - Cobra: bote curto e rápido que envenena (2 de dano por segundo por 3 s; barra de vida fica verde; a cidade cura).
  - Abelha: ferroada rápida e fraca.
  - Javali Coroado: pisão em área (círculo vermelho que cresce), investida longa e mordida.
- **16 monstros na Mata** (5 javalis, 4 goblins, 3 cobras, 3 abelhas e o chefe); só se movem os que estão a menos de 450 px do jogador e só são desenhados os que estão na tela. Teste de navegador com os 16 perto: 60 quadros por segundo no ambiente de teste (limite da tela); confirmar no celular.
- **Ritmo recalibrado** pelo simulador, que agora considera as habilidades e os ataques dos monstros: `xp_base` 36 → nível 10 em cerca de 30 minutos (cerca de 440 abates).

## 8. Volume de monstros (retorno de Willian: "baixo volume")
- 16 monstros espalhados em 60×40 peças pareciam vazios. Mudança, no padrão dos jogos de referência (bandos do Diablo, concentrações do Conquer): **bandos** — o texto do mapa aceita `spawn: tipo N grupo G`.
- Mata do Javali: 4 bandos de 3 javalis, 4 de 3 goblins, 3 de 2 cobras, 3 de 3 abelhas e o chefe = **40 monstros**; respawn de 25 s para **15 s** (`respawn_s` em `dados/progressao.json`).
- Desempenho: só os monstros a menos de 450 px se movem (perto da entrada, 4 de 40); teste com os 40 perto do jogador mantém 60 quadros por segundo no ambiente de teste.
- Simulador passou a lutar por bando (vários atacam juntos, o Giro atinge até 3); `xp_base` 38 → nível 10 em cerca de 30 minutos (cerca de 490 abates).

## 9. Resultado do passo 6 (itens)
- **Queda** (`drops` em `dados/itens.json`): 8% por monstro comum, chefe sempre (Raro ou melhor). Sorteia a base (equipável, da classe, até o nível da região), depois a qualidade (pesos 70/22/7/1) e os bônus (Raro +1 atributo, Lendário +2, de +2 cada). Sorte multiplica os pesos acima de Comum por 1 + 2·sor/(sor+40): retorno decrescente, no máximo ×3.
- **No chão:** brilho com a cor da qualidade (desenhado em código, sem imagem nova), nome por cima para Refinado ou melhor, pisca e some após 90 s. Pega ao passar por cima; mochila cheia avisa.
- **Mochila** (botão no topo): equipamento vestido à esquerda; itens à direita com cor da qualidade; tocar mostra valores e "Se equipar: dano ±, vida ±"; Equipar troca com o vestido (que volta para a mochila); Descartar pede confirmação. Cabe sem rolar em 844×390.
- **Mercador** compra itens (metade do valor, mais por qualidade, +N e bônus).
- Ainda sem visual novo: as 4 peças do Guerreiro são as mesmas em qualquer qualidade (passo 8).
- O simulador não conta os itens (fica do lado conservador): na prática o ritmo deve ser um pouco mais rápido que os 30 minutos.
