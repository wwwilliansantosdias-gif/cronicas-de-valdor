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
7. ✅ Qualidades e cores; ferreiro com melhoria até +5 e fragmentos.
8. ✅ (adiantado a pedido) Mais peças visuais por espaço; personagem montado em camadas na hora.
9. ✅ Arqueiro (referência: arqueiro do Conquer, Scatter em Bird Island).
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

## 10. Retorno de Willian: "equipar não funciona" e "goblins andam de costas"
- **Equipar:** com toques reais o equipar trocava o item, mas nada mudava na tela (todas as quedas usavam as mesmas 4 peças da roupa inicial), não havia aviso e não dava para tirar uma peça. Correções:
  - Cada item tem aparência própria (`visual` em `dados/itens.json`) e o personagem é montado em camadas durante o jogo (corpo, grevas, peitoral, cabeça, capacete, arma). Região 1: Adaga, Espada longa; Gibão de couro, Cota de malha, Couraça de legião, Peitoral de placas; Calça, Grevas de placas; Gorro de couro, Elmo nasal, Elmo bárbaro, Elmo armet (níveis 1 a 7). Personagem novo começa de couro; quem já tinha placas continua com elas.
  - Só entram peças com andar, golpear e estocar (regra do projeto): por isso só duas armas; maça, sabre e machado do gerador não têm estocar.
  - Mensagem "Equipou"/"Tirou"; tocar numa peça vestida mostra "Tirar".
  - Queda limitada a itens de até 2 níveis acima do jogador (`acima_do_nivel`), para não cair item que não dá para usar.
  - `data/pecas_usadas.txt` agora é gerado por `tools/build_jogo_assets.py` a partir dos itens: crédito nunca fica para trás.
  - Teste de navegador com toques reais confere que vestir a cota de malha muda os pixels do personagem.
- **Goblins de costas:** as linhas de esquerda e direita da folha do goblin estavam trocadas (mapeadas a olho no mostruário). Corrigido; conferidas as demais folhas mapeadas a olho: javali, cobra, abelha, morcego e esqueleto estavam certos; o diabrete tinha cima/baixo trocados (corrigido, ainda não usado no jogo).

## 11. Resultado do passo 7 (ferreiro)
- **Melhoria +1 a +5** em qualquer item vestido ou da mochila (`melhoria` em `dados/itens.json`): +10% nos valores do item por nível; chance 100/100/80/60/40%; custo 40/70/110/160/220 de ouro e 0/1/2/3/5 fragmentos. Falha cobra o custo e o item continua igual: nunca quebra nem perde +N (recorte do Kritika sem a parte da loja).
- **Fragmentos:** 15% de chance por monstro comum, 3 garantidos do chefe; aparecem como texto flutuante "+1 fragmento" e no topo da tela.
- Tela do ferreiro: lista de itens (com a cor da qualidade, rola por dentro) e, ao escolher, custo, chance, "Melhorar para +N" e o resultado (sucesso em verde, falha em vermelho). O "afiar" provisório saiu.
- Testes: taxa de sucesso medida em 4000 tentativas por nível bate com a tabela; falha não altera o item; recusa sem recursos não cobra nada.

## 12. Itens mais visuais (decisão de Willian: seguir a recomendação; 3D fica para depois)
- **Cor por qualidade:** a peça vestida é tingida em código com a cor da qualidade (`tinta` em `dados/itens.json`: Comum 0, Refinado 0,14, Raro 0,28, Lendário 0,4). É uma derivação da própria peça LPC, já creditada; nenhuma imagem nova.
- **Aura** nos pés conforme a melhor qualidade vestida (Raro azul; Lendário dourada com faíscas) e **rastro da arma** ao golpear, na cor da qualidade, mais forte com o +N.
- **Ícones** na mochila, no equipamento vestido e no ferreiro, recortados do quadro parado de frente da própria peça.
- Não entrou (decisão pendente): armas sem animação de estocar (maça, sabre, machado, mangual) e novos espaços (capa, escudo, ombreiras, luvas, botas).
- Protótipo 3D documentado em `documentacao/futuro-3d.md` para a versão 2.

## 13. Resultado do passo 9 (Arqueiro)
- **Intenção (Willian):** abater vários inimigos com um tiro, como o arqueiro do Conquer upando em Bird Island com o Scatter. Referência pesquisada: o Scatter é um leque que acerta vários monstros; o dano cresce com o nível da habilidade (de 50% para 72% do arco); Rapid Fire e Intensify vêm depois. A página oficial (co.99.com) não abriu deste ambiente; números vieram de busca e foram tratados como referência, não cópia.
- **Habilidades** (`habilidades.json`): Disparo (nível 1; linha de 190 px, para no primeiro inimigo), **Dispersão** (nível 3; leque de 100° e 170 px, 70% do dano em **todos** do leque, recarga 1,2 s — a habilidade de "um tiro, vários abates") e Chuva (nível 6; círculo de 60 px a 110 px à frente, 110%, recarga 5 s). Formas novas no motor: `leque`, `circulo` com `distancia`, e `alvos` (limite, mais próximos primeiro).
- **Evolução até o "um tiro":** no começo a Dispersão precisa de vários tiros por bando; com Força, arco melhor (+N, qualidade) e grau da habilidade, ela passa a derrubar o bando inteiro de uma vez (teste de navegador confere com um arqueiro evoluído).
- **Visual:** arcos LPC (simples, recurvo, longo) com camada da frente e de trás, flecha na mão e aljava nas costas; flechas voando desenhadas em código (uma no Disparo, leque de 5 na Dispersão, chuva caindo com anel no chão). Improviso documentado: não existe folha de "andar com arco" no formato padrão (só 128 px e uma direção), então ao andar usa-se o primeiro quadro da folha de atirar (arco baixado).
- **Equipamento:** armaduras e capacetes servem às duas classes (todos têm andar, golpear, estocar e atirar); arcos só para o arqueiro, espadas só para o guerreiro; quedas respeitam a classe.
- **Classe ao começar:** personagem novo escolhe Guerreiro ou Arqueiro; menu "Novo personagem" apaga o progresso e volta à escolha. Save aceita qualquer classe implementada e recusa arma de outra classe vestida.
- **Ritmo:** simulador por classe; arqueiro chega ao nível 10 em cerca de 28 minutos (guerreiro cerca de 30); teste de ritmo cobre as duas classes.
- Sobre o visual do Conquer: é 2,5D (cenário desenhado à mão, personagens e monstros 3D em câmera fixa). Fica como referência para o protótipo 3D (`futuro-3d.md`).

## 14. Percepção de progresso (pedido de Willian antes das regiões 2 e 3)
- **Tela de Personagem** (botões "Atrib." e "Mochila" abrem a aba certa): boneco animado com o equipamento em camadas e os 4 espaços em volta (toque no boneco gira a direção); números ao lado: Poder, Dano, Ataques/s, Dano/s, Vida, Velocidade, Crítico; abas Equipamento, Atributos e Habilidades. Cabe sem rolar em 844×390.
- **Provar antes de equipar:** tocar num item da mochila veste o item no boneco e mostra a diferença de cada número em verde/vermelho; equipar avisa "Poder X → Y".
- **Poder** (`estatisticas` em `personagem.js`; pesos em `progressao.json` → `poder`): dano por segundo do ataque básico (com crítico médio) × 6 + vida × 0,5. Aparece no topo ("Nv 6 · Poder 254"); quando sobe, surge "+N Poder" em verde sobre o personagem; o título da tela mostra o ganho desde que ela foi aberta.
- **Subir de nível** avisa os pontos ganhos ("Nível 7! +3 pontos").
- **Mochila em grade** de 20 espaços com ícone, borda na cor da qualidade e "+N" no canto.
- **Área cresce com o grau da habilidade** (`por_grau.area` = 8% por grau em alcance, raio e ângulo; ângulo até 170°): grau 5 da Dispersão alcança cerca de 224 px e abre cerca de 132°; a aba Habilidades mostra a área atual e a do próximo grau.
- **Toques 2,5D:** sombra embaixo do personagem e dos monstros; flechas sobem e descem em arco com sombra correndo no chão; flechas da Chuva caem com a sombra crescendo.
