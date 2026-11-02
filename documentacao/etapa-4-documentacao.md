# Etapa 4 – Documentação técnica

Status: **rascunho** para aprovação. Valores numéricos de equilíbrio são provisórios e serão ajustados jogando (etapa 6).

## 1. Princípios
- Site estático (HTML, JS e imagens) publicado pelo GitHub Pages. Sem servidor, sem conta, sem loja.
- JavaScript sem framework, módulos ES, desenho em `<canvas>` 2D com pixels nítidos.
- **Dados antes de código:** regiões, monstros, itens, missões e mapas são arquivos JSON. Acrescentar uma região é acrescentar dados, sem alterar o motor.
- Cada imagem usada tem origem em `CREDITOS.md`; a tela de Créditos lê esse arquivo.

## 2. Estrutura de pastas

```text
index.html            jogo
src/                  motor (módulos JS)
data/                 regioes, monstros, itens, missoes, classes (JSON)
mapas/                descrições em texto de cada mapa (ver seção 5)
docs/                 mostruario (já publicado); o jogo irá para uma pasta de publicação definida na etapa 6
documentacao/         estas etapas
tools/                scripts de build e créditos
```

Observação: o Pages publica `/docs`. Na etapa 6 o jogo passa a ser gerado para essa pasta (ou o Pages muda para `/`); decidir antes de codar.

## 3. Módulos do motor
| Módulo | Responsabilidade |
|---|---|
| `loop` | passo fixo de simulação, desenho por quadro, pausa |
| `entrada` | toque: direcional virtual, botão de ataque, habilidades; teclado para testes |
| `mundo` | carrega região, mapa e entidades; troca de região pelo portal |
| `entidades` | jogador, inimigos, animais, NPCs; IA simples (vagar, perseguir, atacar) |
| `combate` | dano, alcance, recarga, projéteis (arco), morte |
| `animacao` | lê as especificações de quadros (mesmo formato de `data/mostruario.json`) |
| `camera` | enquadra o jogador, zoom inteiro |
| `ui` | vida, experiência, inventário, mercador, ferreiro, missões, Créditos |
| `salvar` | grava o progresso no navegador (`localStorage`) |

## 4. Modelos de dados

**Região** (`data/regioes.json`)
```json
{ "id": "floresta", "nome": "Floresta", "cidade": "pe-de-lenha", "cacada": "mata-do-javali",
  "niveis": [1, 9], "portal_proxima": { "para": "caverna", "nivel_minimo": 10 } }
```
**Monstro** (`data/monstros.json`): `id`, `sprite` (referência ao `mostruario.json`), `vida`, `dano`, `velocidade`, `alcance`, `xp`, `ouro`, `comportamento` (`inimigo`, `animal`, `chefe`), `escala`, `tinta`.

**Item** (`data/itens.json`): `id`, `tipo` (arma, armadura, capacete, consumível), `classes`, `nivel`, `preco`, `efeito`, **`peca_lpc`** (obrigatória: caminho da peça que o desenha; item sem peça não existe).

**Missão** (`data/missoes.json`): `id`, `cidade`, `objetivo` (matar N de X, entregar, chefe), `recompensa`, `requer`.

**Classe** (`data/classes.json`): `id` (guerreiro, arqueiro), animações usadas, atributos por nível, habilidades. A lista aceita novas classes sem mexer no motor.

## 5. Mapas por regras
Cada mapa é um texto curto que o agente transforma em grade de peças com regras fixas:
```text
mapa: mata-do-javali
tamanho: 60x40
base: grama
camadas: floresta densa; clareira no centro; rio no leste
entrada: cidade pe-de-lenha ao oeste
spawn: javali 4, goblin 3, cobra 2; chefe javali-coroado na clareira
```
O gerador usa semente fixa (mesmo texto → mesmo mapa), garante caminho entre entrada, portal e chefe, e nunca coloca monstro dentro de parede. Cidades seguem o mesmo formato, com `zona_segura: sim` (sem monstros) e pontos para mercador, ferreiro e quadro de missões.

## 6. Regras de jogo (provisórias)
- Nível máximo da v1: 29 (portal da região 3 → nada; fim em 30).
- Experiência cresce a cada nível; portais exigem nível mínimo (10 e 20).
- Morte: volta à cidade da região, sem perder o nível; perde parte do ouro.
- Cidades não têm combate.
- Chefe reaparece depois de um tempo ou ao reentrar na área.
- Limite de 6 a 10 monstros ativos por área.

## 7. Desempenho e plataforma
- Meta: 60 quadros por segundo em celular comum; se cair, desenhar só o que está na câmera e reduzir efeitos.
- Imagens agrupadas em poucas folhas; pré-carregamento com barra de progresso.
- Tela deitada obrigatória: se estiver em pé, mostrar aviso para girar.

## 8. Créditos e licenças no produto
Tela de Créditos exibe `CREDITOS.md`. O script `tools/build_mostruario.py` e o `tools/creditos_pecas.py` mantêm o arquivo atualizado quando entram sprites ou peças do gerador.

## 9. Fora da v1
Som e música (pesquisa pendente), multijogador, mais classes e mais regiões (a estrutura já aceita).
