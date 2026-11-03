# Etapa 9 – Aparência do herói

Status: **implementada** (corpo masculino atual). Corpo feminino e outros corpos ficam para depois: cada item precisaria da peça do corpo escolhido, e nem todas as armaduras têm.

## O que dá para escolher
| Campo | Opções | Como funciona |
|---|---|---|
| Pele | 7 tons (Clara, Âmbar, Oliva, Morena clara, Bronze, Morena, Negra) | troca de paleta no corpo e na cabeça |
| Rosto | Padrão, Magro, Cheio, Idoso | peça `head/heads/human/<rosto>` do gerador |
| Cabelo | Careca + 16 cortes | peça `hair/<corte>/adult` |
| Cor do cabelo | 10 cores | troca de paleta no cabelo e na barba |
| Barba | Sem barba, Por fazer, Aparada, Cheia, Média, Bigode | peça `beards/...` |
| Olhos | Azuis, Verdes, Castanhos, Cinza | troca de paleta nos olhos |

- Escolhe-se ao criar o personagem, depois da classe (começa com uma combinação sorteada; botão Sortear).
- Depois, na aba **Aparência** da tela do personagem, muda na hora e sem custo.
- O capacete fica por cima do cabelo (como no gerador); cabelos longos aparecem por baixo dele.

## Como é feito
- `docs/dados/aparencia.json`: opções, pastas das peças e paletas. As paletas são as `ulpc` do Universal LPC Spritesheet Character Generator: cada cor da paleta-base (pele "light", cabelo "orange", olhos "blue") vira a cor de mesma posição da escolhida, com tolerância de ±1 por canal, como no gerador. Conferido: 97–100% dos pixels das folhas usam as cores da base.
- `docs/src/aparencia.js`: regras puras (normalizar, alternar, sortear, trocar paleta), testadas em `tests/js/aparencia.test.js`.
- `tools/build_jogo_assets.py` baixa rosto, cabelo e barba para as animações das classes e os põe em `data/pecas_usadas.txt` (créditos automáticos).
- Save versão 4: campo `aparencia`. Saves antigos (v3) recebem a aparência padrão; id desconhecido volta ao padrão sem perder o personagem.

## Testes
`tests/js/aparencia.test.js` (dados, paleta, save) e `tests/nav/aparencia.mjs` (criação com toques, aba Aparência, salvar e recarregar, save adulterado). `tests/nav/telas.mjs` confere que as telas novas cabem nos celulares pequenos.
