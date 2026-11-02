# Crônicas de Valdor

RPG de ação 2D de uso pessoal, no navegador do celular (tela deitada), com arte gratuita no estilo LPC.

**Jogar:** https://wwwilliansantosdias-gif.github.io/cronicas-de-valdor/ · **Mostruário de arte:** `.../mostruario/`

Estado: primeira fatia da etapa 6 — região 1 (Floresta) jogável com o Guerreiro: cidade Pé-de-Lenha (mercador, ferreiro, quadro de missões, portal selado até o nível 10) e Mata do Javali (4 tipos de monstro e o Javali Coroado). Caverna, Ruínas e o Arqueiro ainda não existem.

## Pastas
- `docs/` – o que o GitHub Pages publica (Settings → Pages → branch `main`, pasta `/docs`): jogo (`index.html`, `src/`, `dados/`, `mapas/`, `assets/`), `mostruario/` e `CREDITOS.md`.
- `documentacao/` – etapas 2 a 5 e 6b (história, arte, documentação técnica, testes, progressão).
- `data/` – metadados dos pacotes (`packs.json`, `meta.json`), especificação do mostruário, peças do gerador LPC usadas (`pecas_usadas.txt`) e `gerador/CREDITS.csv`.
- `tools/` – scripts de download, créditos e build. `tests/` – testes.

## Rodar
Abrir `docs/` num servidor estático (ex.: `python3 -m http.server -d docs`). Teclado: setas/WASD, espaço ataca, 1 Estocada, 2 Giro, E fala, Q poção.

## Testes
```bash
pip install pytest pillow && python3 -m pytest -q tests     # dados e créditos
node --test tests/js/*.test.js                               # motor (mapas, combate, xp, atributos, salvar, ritmo)
node tools/simular.mjs 10                                    # tempo estimado até o nível 10
for t in fumaca fluxo atributos combate; do PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/$t.mjs; done   # navegador, tela deitada
```

## Regenerar assets e créditos
```bash
python3 -I tools/meta_packs.py && python3 -I tools/download_packs.py   # pacotes do OpenGameArt (assets/raw, não versionado)
python3 -I tools/build_mostruario.py     # docs/mostruario + CREDITOS.md
python3 -I tools/build_jogo_assets.py    # compõe o Guerreiro e copia tiles/NPCs para docs/assets
```
Peça nova do gerador LPC: acrescente o caminho em `data/pecas_usadas.txt` e rode `build_mostruario.py`.
