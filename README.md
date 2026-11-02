# Crônicas de Valdor

RPG de ação 2D de uso pessoal, no navegador do celular (tela deitada), com arte gratuita no estilo LPC.

**Jogar:** https://wwwilliansantosdias-gif.github.io/cronicas-de-valdor/ · **Mostruário de arte:** `.../mostruario/`

Estado: região 1 (Floresta) jogável com o Guerreiro ou o Arqueiro (escolha ao criar o personagem): cidade Pé-de-Lenha (mercador, ferreiro com melhoria até +5, quadro de missões, portal selado até o nível 10) e Mata do Javali (40 monstros em bandos, ataques com aviso, Javali Coroado). Atributos, habilidades (Guerreiro: Golpe, Estocada, Giro; Arqueiro: Disparo, Dispersão, Chuva), itens com qualidade que caem dos monstros e aparecem no personagem. Caverna e Ruínas ainda não existem. Progressão: `documentacao/etapa-6b-progressao.md`.

## Pastas
- `docs/` – o que o GitHub Pages publica (Settings → Pages → branch `main`, pasta `/docs`): jogo (`index.html`, `src/`, `dados/`, `mapas/`, `assets/`), `mostruario/` e `CREDITOS.md`.
- `documentacao/` – etapas 2 a 5 e 6b (história, arte, documentação técnica, testes, progressão) e `futuro-3d.md` (protótipo 3D para a versão 2).
- `data/` – metadados dos pacotes (`packs.json`, `meta.json`), especificação do mostruário, peças do gerador LPC usadas (`pecas_usadas.txt`) e `gerador/CREDITS.csv`.
- `tools/` – scripts de download, créditos e build. `tests/` – testes.

## Rodar
Abrir `docs/` num servidor estático (ex.: `python3 -m http.server -d docs`). Teclado: setas/WASD, espaço ataca, 1 e 2 habilidades, E fala, Q poção.

## Testes
```bash
pip install pytest pillow && python3 -m pytest -q tests     # dados e créditos
node --test tests/js/*.test.js                               # motor (mapas, combate, xp, atributos, salvar, ritmo)
node tools/simular.mjs 10 arqueiro                           # tempo estimado até o nível 10 (guerreiro ou arqueiro)
for t in fumaca fluxo atributos combate mochila arqueiro; do PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/nav/$t.mjs; done   # navegador, tela deitada
```

## Regenerar assets e créditos
```bash
python3 -I tools/meta_packs.py && python3 -I tools/download_packs.py   # pacotes do OpenGameArt (assets/raw, não versionado)
python3 -I tools/build_mostruario.py     # docs/mostruario + CREDITOS.md
python3 -I tools/build_jogo_assets.py    # baixa as peças dos itens (gerador LPC), gera pecas_usadas.txt, copia tiles/NPCs
```
Item novo: acrescente em `docs/dados/itens.json` (com `peca_lpc` e `visual`) e rode `build_jogo_assets.py` e depois `build_mostruario.py` (créditos).
