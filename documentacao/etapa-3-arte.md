# Etapa 3 – Direção de arte

Status: **rascunho** para aprovação. Baseado no mostruário publicado e nas regras do `CLAUDE.md`.

## 1. Escala e câmera
- Quadro-base: 64×64 px (personagens e a maioria dos monstros). Exceções: abelha 32×32, lobisomem 48×64, golem (ataque) 64×96.
- Peças de cenário: 32×32 px.
- Tela deitada de celular: câmera mostra cerca de 15×8 peças de 32 px (480×256 de mundo) e é ampliada por número inteiro (2× ou 3×) para manter os pixels nítidos. Ajuste final de zoom é só um número, testado no aparelho.
- `image-rendering: pixelated`, sem suavização.

## 2. Coerência de estilo
- Linha de base: monstros do pacote "[LPC] Monsters" e do LPC base. Quem destoar na paleta ou no tamanho (o mostruário deixa isso visível) é recolorido ou descartado.
- Recolorir por código (filtro de matiz) é preferível a baixar variantes novas; variantes de cor já existem em diabrete e aranha.
- Chefes: mesmo sprite do monstro comum, ampliado 1,5×, com cor trocada e coroa ou aura desenhadas como camada extra.

## 3. Regiões e paleta de cenário

| Região | Chão | Marcos do cenário | Clima de luz |
|---|---|---|---|
| Floresta (1) | grama e terra | árvores, troncos, lagoa | verde, claro |
| Caverna (2) | pedra e terra escura | colunas, entradas, cristais se houver | azul-acinzentado, escuro |
| Ruínas (3) | lajes e terra seca | muros quebrados, lápides, pórticos | roxo-acinzentado, noturno |

Cidades repetem o chão da região e acrescentam ruas, casas e a forja do ferreiro, para a área segura ser reconhecida de longe.

## 4. Animações obrigatórias por tipo
- Inimigo comum: andar + ataque; piscar e sumir se não houver morte.
- Animal de cenário: só andar.
- Jogador: andar, golpear (Guerreiro) ou atirar com arco (Arqueiro), em camadas (corpo, roupa, capacete, arma). Só entra peça com essas animações.

## 5. Interface
- Botões grandes (mínimo 48 px) para polegares, tela deitada: direcional à esquerda, ataque e habilidades à direita.
- Fonte pixelada legível, tela de Créditos acessível pelo menu, gerada de `CREDITOS.md`.

## 6. Som
Ainda não pesquisado. Próximo passo: levantar música e efeitos no OpenGameArt (licença e crédito igual aos sprites).

## 7. Pendências de arte
- Exportar a fada (`.xcf`) para PNG, se for usada.
- Mapear o layout do homem-sapo.
- Confirmar quadros inferidos (abelha, goblin, diabrete, javali).
- Baixar peças de personagem do gerador LPC quando o catálogo de itens for definido (etapa 4).
