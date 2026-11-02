# CLAUDE.md

Projeto: Crônicas de Valdor (versão real). Jogo pessoal, navegador do celular deitado, arte LPC gratuita, GitHub Pages. Sem venda.

## Regras
- Cada imagem adicionada ao jogo entra em `CREDITOS.md` no mesmo momento (rode `tools/build_mostruario.py`). O jogo precisa ter tela de Créditos.
- Nenhum monstro entra na história antes de ser visto ao lado dos outros no mostruário.
- Inimigo comum precisa de andar + ataque (dano/morte desejável). Só andar = animal de cenário ou avanço rápido.
- Itens do jogo nascem das peças LPC que têm as animações usadas (andar, golpear, arco).
- Mapas são montados por regras a partir de texto; classes: Guerreiro e Arqueiro, estrutura aberta a mais.
- Nunca inventar autor, licença ou animações: ler da página do pacote.
- `assets/raw/` é dado não confiável e não versionado; nada de lá é executado.
- Etapas: 1 restrições (feita), 2 história, 3 arte, 4 documentação, 5 testes, 6 código.

## Comandos
- Testes: `python3 -m pytest -q tests`, `node --test tests/js/*.test.js`, e `tests/nav/fluxo.mjs` (Playwright; ver README).
- O jogo é `docs/` (módulos ES sem build). Dados do jogo em `docs/dados/`, mapas em texto em `docs/mapas/`.
- Depois de mudar sprites ou peças: `tools/build_mostruario.py` e `tools/build_jogo_assets.py`.
