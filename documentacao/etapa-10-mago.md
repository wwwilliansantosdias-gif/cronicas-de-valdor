# Etapa 10 – Mago

Status: **implementado** (aprovado por Willian com as recomendações: só recarga, Força aparece como "Magia", lista de habilidades como abaixo, chapéu de mago e roupas do arqueiro). O plano original segue abaixo; a seção 6 diz o que entrou.

## 1. Referências (sistema, não cópia)
- **Conquer Online, Taoista de Fogo:** feitiços de área à distância (Tornado, Círculo de Fogo, Fogo do Inferno), gasta mana (MP) por feitiço, muito dano e pouca defesa ("canhão de vidro"). Fonte: guia oficial de habilidades (co.99.com, página do Taoista de Fogo).
- **Diablo 2, Feiticeira:** três escolas (fogo, gelo, raio), mana, uma armadura de gelo como defesa e feitiços que acertam vários de uma vez. (De memória; não conferido em página.)
- **O que fica para o nosso jogo:** mago de longe, frágil, que limpa bandos com área e tem um escudo para sobreviver. A sensação de evolução vem de feitiços cada vez maiores, como a Dispersão e a Chuva do arqueiro.

## 2. O que a arte LPC tem (conferido)
**No gerador de personagens** (definições do projeto, lidas uma a uma):

| Peça | Corpo masculino | Animações | Variações |
|---|---|---|---|
| Cajados Cristal, Diamante, Retorcido, Laço, "S" | sim | andar e **estocada grande** (192 px). Sem conjurar | 6 cores cada |
| Cajado simples | sim | andar, estocada e **conjurar** (spellcast) | 1 |
| Varinha | sim | só golpear | 1 |
| Chapéus de mago (Mago, Celestial, Celestial com lua, Grande) | sim | todas, inclusive andar, estocada e conjurar | 6 cores ou mais, com faixa e fivela |
| Túnica (robe) | **não**, só o corpo feminino | — | — |
| Cinto de mago | não, só o feminino | — | — |
| Cinto de túnica | sim | — | azul-petróleo e branco |

O corpo masculino tem a animação de conjurar, mas as armaduras que usamos ainda não foram conferidas nela.

**Efeitos de magia:** pacote **Extended LPC Magic pack**, de Daniel Eddeland (OpenGameArt, CC-BY-SA 3.0 / GPL 3.0, estilo LPC; pede crédito "Daniel Eddeland" e link para a página). Baixado só para conferir (não versionado): 15 folhas de 512×512 com 16 quadros de 128 px (no jogo, a metade: 64 px). Os espinhos usam quadros de 64 px. O conteúdo:
- Leão de fogo, com folhas para as 4 direções (serve de projétil que corre à frente);
- Garra de raio, Tornado, Espinhos de gelo, Tentáculo de gelo, Tentáculo de água, Escudo de gelo, Casco de tartaruga (escudo), Picada de cobra.

Antes de entrar no jogo, o pacote passa pelo mostruário e pelos créditos, como os outros.

## 3. Proposta
**Como conjura:** com a **estocada do cajado**, apontando o cajado. Todas as armaduras do jogo já têm estocada, então o mago veste as mesmas roupas e servem os 5 cajados com cores. A animação de conjurar fica de reserva: só o cajado simples tem, e cada armadura precisaria ser conferida.

**Habilidades** (mesmos níveis das outras classes):

| Nível | Habilidade | Forma | Efeito (arte) |
|---|---|---|---|
| 1 | Faísca | 1 alvo, longe (como o Disparo) | Garra de raio no alvo |
| 3 | Leão de Fogo | linha que atravessa todos | Leão de fogo correndo à frente (4 direções) |
| 6 | Espinhos de Gelo | círculo em volta do mago | Espinhos de gelo |
| 12 | Escudo de Gelo | defesa: −50% de dano por 5 s | Escudo de gelo em volta |
| 20 | Tornado | área à distância que acerta várias vezes | Tornado |

**Itens:**
- Cajados por região: Floresta (simples, Retorcido), Caverna (Laço, Diamante, "S"), Ruínas (Cristal). As cores das variações acompanham a qualidade ou o material.
- Chapéus de mago no espaço do capacete.
- O resto das roupas é o mesmo do arqueiro.
- Um conjunto do mago para as Ruínas.

**Equilíbrio:** pouca vida, muito dano em área. O simulador supõe que o mago toma 35% dos ataques, como o arqueiro. A meta continua: nível 10 em 25–35 min, 10→20 em ~2 h, 20→29 em ~4 h.

## 4. Decisões para Willian
1. **Mana:** (a) só recarga, como o Guerreiro e o Arqueiro (**recomendado**: igual às outras classes e simples no celular); ou (b) barra de mana, como no Conquer e no Diablo, que pede barra nova, poções de mana e conta no simulador.
2. **Atributo de dano:** (a) a Força vale para o mago e aparece como "Magia" na tela dele (**recomendado**: sem mudar o save); ou (b) atributo novo, Inteligência, que muda o save (migração) e a distribuição recomendada.
3. **Habilidades:** aprovar a lista acima ou trocar alguma. Também dá para usar Tentáculo de gelo ou Picada de cobra (veneno).
4. **Roupa:** a túnica só existe para o corpo feminino. Por enquanto o mago masculino usa chapéu de mago, cinto de túnica e as roupas do arqueiro. Se quiser túnica, fica junto com o corpo feminino (etapa da aparência).

## 5. Passos depois de aprovado
1. Arte: pacote de magia no mostruário e nos créditos; baixar cajados e chapéus e conferir andar e estocada em cada um.
2. Dados: classe, 5 habilidades, cajados, chapéus, conjunto, distribuição recomendada.
3. Código: efeitos em folha (128 px pela metade), escudo temporário, dano repetido do Tornado, leão que corre.
4. Simulador, testes de motor e de navegador (`tests/nav/mago.mjs`) e gravação.
5. Documentação.

## 6. O que entrou
- **Arte:** Extended LPC Magic pack no mostruário e nos créditos (o leitor de páginas passou a ler também o campo "Attribution Instructions", o que completou o aviso de atribuição de mais 11 pacotes). Folhas usadas em `docs/assets/efeitos/`, descritas em `docs/dados/efeitos.json`.
- **Classe** `mago` em `classes.json` (recomendado 2 Magia : 1 Vitalidade), com `nome_atributo` para mostrar a Força como "Magia".
- **Habilidades** em `habilidades.json`: Faísca (linha, 1 alvo), Leão de Fogo (linha que atravessa), Espinhos de Gelo (círculo em volta), Escudo de Gelo (forma nova `escudo`: −50% de dano por 5 s, recarga 14 s), Tornado (círculo à distância com `tiques` 4 a cada 0,4 s; a área fica onde foi lançada).
- **Itens:** cajados Retorcido (1), de Laço (6), Serpente (12), de Diamante (17, bronze), de Cristal (25, Cinzaltar); chapéus de mago cinza (1), azul (8), Celestial (16), Arcano (25). Roupas do arqueiro servem ao mago. Conjunto **do Arcano** (cajado de cristal + chapéu arcano): +5 Magia e aura.
- **Ritmo** (simulador, 20 jogadores, mago toma 35% dos ataques como o arqueiro, escudo conta pela fração do tempo ativo): nível 10 em ~30 min, 10→20 em ~2 h, 20→29 em ~3 h 45. Nenhum número de equilíbrio mudou.
- **Testes:** motor (feitiços, escudo, ritmo do mago, drops só de cajado), dados (folhas grandes no fundo do cajado) e `tests/nav/mago.mjs` (cada feitiço no jogo, escudo reduz o golpe, "Magia" na tela, salvar).
