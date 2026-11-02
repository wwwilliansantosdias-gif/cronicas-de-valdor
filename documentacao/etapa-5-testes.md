# Etapa 5 – Plano de testes

Status: **rascunho** para aprovação. Os testes de dados (seção 2) já existem e passam; os demais serão escritos junto com o código na etapa 6, na ordem abaixo.

Princípio (igual ao `CLAUDE.md` da biblioteca anterior): testar **propriedades**, não números fixos. Exemplo: "todo item tem peça LPC", e não "a espada custa 50".

## 1. Níveis de teste
| Nível | Ferramenta | O que cobre |
|---|---|---|
| Dados | `pytest` (Python) | JSON, créditos, quadros de animação, arquivos de imagem |
| Motor | testes de unidade em JS (Node, sem navegador) | combate, experiência, portais, salvar, geração de mapa |
| Navegador | Playwright com tela deitada (844×390) | carrega sem erro, desenha, controles por toque, portal |
| Aparelho | você, no celular | sensação, tamanho dos botões, desempenho real |

## 2. Dados (feitos, `tests/test_dados.py`)
- Todo pacote usado aparece em `CREDITOS.md`; pacote sem texto de atribuição fica marcado.
- Estado do monstro coerente: "ok" exige andar e ataque; "sem ataque" não pode ter ataque.
- Todo quadro de animação cabe dentro da imagem e o primeiro quadro não é vazio.
- Nenhuma imagem publicada sem uso (nada sem crédito entra de carona).
- O CSV de créditos do gerador mantém as colunas esperadas.
- Verificado por mutação: dados quebrados de propósito (quadro fora da imagem, estado trocado, crédito removido) fazem os testes falharem.

## 3. Dados do jogo (a escrever com `data/*.json`)
- Todo item tem `peca_lpc` existente em `data/gerador/CREDITS.csv`.
- Toda peça usada está listada em `data/pecas_usadas.txt` e sai em `CREDITOS.md`.
- Todo monstro de comportamento `inimigo` ou `chefe` tem andar e ataque; `animal` só precisa de andar.
- Toda região referencia cidade, área de caça e monstros que existem; os níveis das regiões não se sobrepõem e `portal_proxima.nivel_minimo` fica dentro da faixa da região seguinte.
- Toda missão aponta para cidade e monstro existentes; nenhuma exige nível maior que o máximo.
- Acrescentar uma região de teste só com dados não exige mudança de código (teste de estrutura).

## 4. Mapas por regras
- Mesmo texto e mesma semente produzem o mesmo mapa.
- Existe caminho entre entrada, portal e chefe (busca em grade).
- Nenhum monstro, NPC ou portal nasce em peça bloqueada.
- Cidade: zona segura, sem monstros; mercador, ferreiro e quadro de missões presentes e alcançáveis.
- Quantidade de monstros por área entre 6 e 10.

## 5. Motor
- Dano nunca deixa vida negativa; morte dispara uma vez só.
- Experiência acumulada sobe de nível de forma monotônica; nível máximo não ultrapassa 29.
- Portal bloqueia abaixo do nível mínimo e libera no nível exato.
- Morrer volta à cidade, mantém nível, perde só parte do ouro.
- Salvar e carregar devolvem o mesmo estado; dado corrompido não derruba o jogo (recomeça com aviso).
- Troca de equipamento muda as camadas desenhadas e só aceita item de classe compatível.
- Passo fixo: o mesmo conjunto de entradas dá o mesmo resultado, independente da taxa de quadros.

## 6. Navegador (844×390, tela deitada)
- Página carrega sem erros de console e sem imagem faltando (404).
- Em tela em pé aparece o aviso para girar.
- Direcional e ataque respondem a toque; botões com pelo menos 48 px.
- Fluxo completo: cidade → área de caça → matar monstro → ganhar experiência → voltar à cidade → vender no mercador.
- Tela de Créditos mostra o conteúdo de `CREDITOS.md`.
- Capturas de tela por região para comparar a olho (sem comparação de pixel).

## 7. Desempenho
- Medir quadros por segundo com 10 monstros e efeitos ativos, 3 vezes, e registrar a média no Playwright (limite de referência: 50 quadros por segundo no ambiente de teste; o valor real vem do seu aparelho).
- Tempo de carregamento inicial e tamanho total das imagens registrados a cada versão.

## 8. Critério para considerar a etapa 6 pronta
1. Todos os testes de dados, mapas, motor e navegador passam.
2. Você joga a região 1 inteira no celular, até o portal do nível 10, sem travar.
3. Créditos completos e atualizados.
