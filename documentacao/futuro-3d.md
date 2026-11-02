# Futuro: protótipo 3D (versão 2)

Status: **adiado por decisão de Willian**. A versão 1 termina em 2D (LPC). Este documento guarda o plano para não precisar rediscutir depois.

## Por que não agora
- Muda decisões da etapa 1: sai a arte LPC e os mapas por peças de 32 px.
- Risco de desempenho no celular comum e menos variedade pronta de monstros do que o LPC oferece.
- Custo alto: praticamente uma versão 2.

## O que já serve para o 3D (não se perde)
O motor foi feito com dados e regras separados do desenho. Continuam valendo:
- `docs/dados/*.json`: monstros (vida, dano, ataques com aviso), itens (qualidade, +N, bônus), habilidades (formas arco/linha/círculo), progressão, missões, regiões.
- Regras em `docs/src/`: `combate.js`, `personagem.js`, `itens.js`, `progresso.js`, `salvar.js`, `mapa.js` (gera grade e posições num plano; no 3D vira o chão).
- `tools/simular.mjs` (ritmo) e os testes de motor e de dados.

O que seria refeito: `jogo.js` (desenho, câmera, entrada), arte, mostruário, testes de navegador e o visual dos itens (`visual` de cada item passaria a apontar para modelos 3D em vez de folhas LPC).

## Protótipo mínimo (antes de decidir)
Objetivo: medir no celular de Willian se vale a pena, gastando pouco.
1. Uma área pequena (a clareira da Mata do Javali) gerada a partir do mesmo texto de mapa, com chão, árvores e lagoa simples.
2. Um personagem (Guerreiro) andando e golpeando com câmera de cima em ângulo (estilo Diablo), controles de toque iguais aos atuais.
3. Um monstro (javali) usando os mesmos dados e a mesma IA (investida com aviso).
4. Trocar uma peça (peitoral) e ver o modelo mudar.
5. Medir: quadros por segundo no celular, tempo de carregamento, tamanho baixado.

Critério para seguir para a versão 2: 60 quadros por segundo estáveis no celular com cerca de 20 monstros e carregamento abaixo de 10 s.

## Tecnologia candidata (a verificar antes de começar)
- **Three.js** no navegador (sem build, como hoje), modelos em glTF.
- Modelos gratuitos de estilo low-poly com personagens modulares, armas e armaduras encaixáveis: **KayKit** (Kay Lousberg) e **Quaternius**. Lembro deles como licença livre (CC0), mas **licença, animações disponíveis e peso precisam ser conferidos** na página de cada pacote, seguindo a mesma regra do projeto: nunca inventar autor, licença ou animações.
- Monstros: verificar quais existem com andar e ataque (a mesma regra de inimigo comum vale no 3D).

## Referência visual citada por Willian
Arqueiro e arcos do Conquer Online: o jogo é 2,5D (cenários desenhados à mão, personagens, monstros e armas em 3D, câmera fixa em ângulo). O protótipo deve buscar visuais próximos: câmera fixa de cima em ângulo, personagens 3D low-poly sobre um chão com textura desenhada.

## Alternativa intermediária ("2,5D")
Continuar com os sprites LPC e acrescentar sombras projetadas, luz e escuridão (caverna) e paralaxe. Custo médio, não refaz nada. Pode entrar na versão 1 se fizer falta.
