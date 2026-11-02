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
3. Drops, mochila e equipar (números).
4. Qualidades e cores; ferreiro com melhoria até +5 e fragmentos.
5. Estocada e Giro, com pontos de habilidade.
6. Mais peças visuais por espaço.
7. Até 16 monstros por área, só os próximos ativos; medir desempenho.
8. Arqueiro.
9. Regiões 2 e 3.
10. Som.

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
